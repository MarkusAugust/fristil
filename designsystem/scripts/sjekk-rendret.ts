/**
 * Prøver `diagnoseRendered` mot en ekte nettleser: siden slik Chromium har
 * rendret den, med stilarkene den har lastet.
 *
 * Sidene serveres fra én port og stilarket fra en annen, som et CDN, så både
 * et stilark CSSOM kan lese og et som må hentes på nytt blir prøvd.
 *
 * Skriptet som leser siden finnes også i Fristil for Kotlin, som tekst, siden
 * pakken ikke avhenger av Playwright. Det kjøres her også, og skal gi det
 * samme svaret.
 *
 * Kjør med: bun scripts/sjekk-rendret.ts (etter bun run build)
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import {
  diagnoseRendered,
  READ_RENDERED_PAGE,
} from "../src/diagnostics/index.js"

const pakke = fileURLToPath(new URL("..", import.meta.url))
const fristilCss = readFileSync(join(pakke, "dist/fristil.css"), "utf8")

const cdn = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(fristilCss, {
      headers: {
        "content-type": "text/css",
        "access-control-allow-origin": "*",
      },
    }),
})

const side = (head: string, body: string) =>
  `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Prøve</title>${head}</head><body>${body}</body></html>`

const knapper =
  '<button class="fs-button" type="button" data-variant="ghost">Lagre</button><div class="fs-card">Kort</div>'

const sider: Record<string, string> = {
  "/med-stilark": side('<link rel="stylesheet" href="/fristil.css">', knapper),
  "/uten-stilark": side("", knapper),
  // Fra en annen opprinnelse, uten crossorigin: CSSOM kan ikke lese det.
  "/fra-cdn": side(
    `<link rel="stylesheet" href="${cdn.url}fristil.css">`,
    knapper,
  ),
  // En klasse satt av skript, etter at serveren sendte siden.
  "/skript": side(
    '<link rel="stylesheet" href="/fristil.css">',
    '<div id="x">Kort</div><script>document.getElementById("x").className = "fs-kort"</script>',
  ),
}

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const sti = new URL(request.url).pathname
    if (sti === "/fristil.css")
      return new Response(fristilCss, {
        headers: { "content-type": "text/css" },
      })
    const html = sider[sti]
    return html
      ? new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      : new Response("Finnes ikke", { status: 404 })
  },
})

const feil: string[] = []
const krev = (påstand: boolean, beskrivelse: string) => {
  if (!påstand) feil.push(beskrivelse)
}

const nettleser = await chromium.launch()
try {
  const page = await nettleser.newPage()
  const funn = async (sti: string) => {
    await page.goto(`${server.url}${sti.slice(1)}`)
    return diagnoseRendered(page)
  }

  const med = await funn("/med-stilark")
  krev(med.length === 0, `siden med stilarket ga funn: ${JSON.stringify(med)}`)

  const uten = await funn("/uten-stilark")
  krev(
    uten.filter((f) => f.rule === "ustylet-klasse").length === 2,
    `siden uten stilark skulle gitt to ustylede klasser: ${JSON.stringify(uten.map((f) => f.message))}`,
  )

  const fraCdn = await funn("/fra-cdn")
  krev(
    fraCdn.length === 0,
    `stilarket fra en annen opprinnelse ble ikke lest: ${JSON.stringify(fraCdn.map((f) => f.message))}`,
  )

  const skript = await funn("/skript")
  krev(
    skript.some(
      (f) => f.rule === "ukjent-klasse" && f.message.includes("fs-kort"),
    ),
    `klassen skriptet satte, ble ikke sjekket: ${JSON.stringify(skript.map((f) => f.message))}`,
  )

  // Kotlin-utgaven av skriptet gir det samme som TypeScript-utgaven.
  const kotlin = readFileSync(
    join(pakke, "../kotlin/src/main/kotlin/no/fristil/Fristil.kt"),
    "utf8",
  )
  const kotlinSkript = /READ_RENDERED_PAGE: String = """([\s\S]*?)"""/
    .exec(kotlin)?.[1]
    // `${'$'}` er et dollartegn i en Kotlin-streng.
    ?.replaceAll("$" + "{'$'}", "$")
  krev(kotlinSkript !== undefined, "fant ikke READ_RENDERED_PAGE i Fristil.kt")
  krev(
    kotlinSkript?.startsWith("async () => {") === true &&
      kotlinSkript.endsWith("}") &&
      !/^\s*\/\//m.test(kotlinSkript),
    "READ_RENDERED_PAGE i Fristil.kt skal være bare funksjonen, uten blanke tegn eller kommentarer rundt",
  )
  for (const sti of ["/med-stilark", "/fra-cdn"]) {
    await page.goto(`${server.url}${sti.slice(1)}`)
    const fraTs = await page.evaluate(READ_RENDERED_PAGE)
    // Playwright for Java sender teksten, og Playwright pakker den inn i
    // parenteser og kaller den. En kommentar på siste linje ville da slukt
    // parentesen, så teksten må være bare funksjonen.
    const fraKotlin = await page.evaluate(`(${kotlinSkript})()`)
    krev(
      JSON.stringify(fraTs) === JSON.stringify(fraKotlin),
      `skriptet i Fristil.kt leser ${sti} annerledes enn det i TypeScript`,
    )
  }
} finally {
  await nettleser.close()
  server.stop()
  cdn.stop()
}

if (feil.length > 0) {
  console.error(
    `✗ diagnoseRendered:\n\n${feil.map((f) => `  ${f}`).join("\n")}\n`,
  )
  process.exit(1)
}
console.log(
  "diagnoseRendered sjekker siden slik nettleseren rendret den, med stilarkene.",
)
