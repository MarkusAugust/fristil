/**
 * Kjører axe mot den bygde dokumentasjonssiden, i begge temaer.
 *
 * Komponenttestene i `designsystem` kjører mot komponentene isolert. Det er
 * bra, men det fanger ikke feil som oppstår først når komponentene settes inn
 * på en side. Dokumentasjonen for et designsystem er et produkt i seg selv.
 * En lysegrå brødtekst på hvit flate gikk rett gjennom nettopp fordi
 * ingenting testet den bygde siden.
 *
 * Kjør med: bun run test:docs (bygg først)
 */

import { readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { chromium } from "playwright"

const DIST = new URL("../dist/", import.meta.url).pathname
const PORT = 4173
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
const TEMAER = ["light", "dark"] as const

type Brudd = {
  side: string
  tema: string
  regel: string
  forklaring: string
  elementer: string[]
}

function finnSider(): string[] {
  const sider: string[] = []
  const glob = new Bun.Glob("**/index.html")
  for (const treff of glob.scanSync(DIST)) {
    const mappe = relative(".", treff).replace(/index\.html$/, "")
    sider.push(`/${mappe}`)
  }
  return sider.sort()
}

const MEDIETYPER: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  webp: "image/webp",
  png: "image/png",
  woff2: "font/woff2",
}

const tjener = Bun.serve({
  port: PORT,
  fetch(request) {
    const sti = decodeURIComponent(new URL(request.url).pathname)
    const filsti = sti.endsWith("/")
      ? join(DIST, sti, "index.html")
      : join(DIST, sti)
    const fil = Bun.file(filsti)
    const endelse = filsti.split(".").pop() ?? ""
    return fil.exists().then((finnes) =>
      finnes
        ? new Response(fil, {
            headers: {
              "content-type": MEDIETYPER[endelse] ?? "application/octet-stream",
            },
          })
        : new Response("Ikke funnet", { status: 404 }),
    )
  },
})

const axeKilde = readFileSync(
  new URL("../node_modules/axe-core/axe.min.js", import.meta.url).pathname,
  "utf8",
)

const sider = finnSider()
const nettleser = await chromium.launch()
const side = await (await nettleser.newContext()).newPage()
const brudd: Brudd[] = []

for (const url of sider) {
  for (const tema of TEMAER) {
    await side.goto(`http://localhost:${PORT}${url}`, {
      waitUntil: "networkidle",
    })
    await side.evaluate(
      (t) => document.documentElement.setAttribute("data-theme", t),
      tema,
    )

    /*
     * Vent til siden faktisk har tegnet ferdig i det nye temaet.
     *
     * Lit oppdaterer asynkront, og axe leser utregnet stil. Men den verste
     * kilden til ustabilitet var CSS-overganger: sidemenyens lenker har
     * `transition-colors`, så rett etter et temabytte målte axe en farge midt
     * i overgangen. Overganger og animasjoner slås derfor av før målingen.
     * En tilgjengelighetsport som feiler tilfeldig blir ignorert.
     */
    await side.addStyleTag({
      content: `*, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }`,
    })

    await side.evaluate(async () => {
      const komponenter = [...document.querySelectorAll("*")].filter(
        (el): el is HTMLElement & { updateComplete: Promise<unknown> } =>
          "updateComplete" in el,
      )
      await Promise.all(komponenter.map((el) => el.updateComplete))
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
      )
    })
    await side.addScriptTag({ content: axeKilde })

    const funn = await side.evaluate(async (regler) => {
      // biome-ignore lint/suspicious/noExplicitAny: axe injiseres i sidekonteksten
      const resultat = await (window as any).axe.run(document, {
        runOnly: { type: "tag", values: regler },
        resultTypes: ["violations"],
      })
      // biome-ignore lint/suspicious/noExplicitAny: axe sin egen resultattype
      return resultat.violations.map((v: any) => ({
        regel: v.id,
        forklaring: v.help,
        // biome-ignore lint/suspicious/noExplicitAny: axe sin egen nodetype
        elementer: v.nodes.map((n: any) => n.html.slice(0, 160)),
      }))
    }, WCAG_AA)

    for (const f of funn) brudd.push({ side: url, tema, ...f })
  }
}

await nettleser.close()
tjener.stop()

console.log(`Sjekket ${sider.length} sider i ${TEMAER.length} temaer.`)

if (brudd.length === 0) {
  console.log("✓ Ingen tilgjengelighetsbrudd.")
  process.exit(0)
}

for (const b of brudd) {
  console.log(`\n${b.side} [${b.tema}]  ${b.regel}`)
  console.log(`  ${b.forklaring}`)
  for (const el of b.elementer) console.log(`    ${el}`)
}

console.log(`\n✗ ${brudd.length} tilgjengelighetsbrudd.`)
process.exit(1)
