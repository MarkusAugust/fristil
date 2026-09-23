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
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))
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
  fileURLToPath(
    new URL("../node_modules/axe-core/axe.min.js", import.meta.url),
  ),
  "utf8",
)

const sider = finnSider()
const nettleser = await chromium.launch()
const side = await (await nettleser.newContext()).newPage()
const brudd: Brudd[] = []

/*
 * Advarslene komponentene skriver ut, samlet på hver eneste side.
 *
 * Komponentene sier fra med `console.warn` når markupen de fikk ikke henger
 * sammen. Kommer en slik advarsel på våre egne sider, betyr det enten at et
 * eksempel er galt, eller at advarselen slår ut på markup som er i orden. En
 * advarsel som også kommer når alt er riktig blir slått av, og da er den
 * verdiløs, så begge deler må felle sjekken.
 *
 * Her og ikke bare i `sjekk-komponentdemoer.ts`: dette skriptet besøker hver
 * bygde side, mønstersidene og forsiden medregnet.
 */
const advarsler: string[] = []
let naavaerende = ""

side.on("console", (melding) => {
  const type = melding.type()
  if (type !== "warning" && type !== "error") return
  advarsler.push(`${naavaerende}  ${type}: ${melding.text()}`)
})

for (const url of sider) {
  naavaerende = url
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

      /*
       * Kodefeltene får tastaturtilgang av et skript, ikke av markupen.
       * Expressive Code setter `tabindex` på de feltene som kan rulles, og
       * gjør det etter at siden er tegnet. Målte axe før det, meldte den
       * «Scrollable region must have keyboard access» på et felt som fikk
       * tilgangen et øyeblikk senere, og sjekken feilet tilfeldig.
       *
       * Skriftene må også være lastet: det er bredden på tegnene som avgjør
       * om feltet i det hele tatt kan rulles.
       */
      await document.fonts.ready

      const uten = () =>
        [...document.querySelectorAll("pre")].filter(
          (felt) =>
            felt.scrollWidth > felt.clientWidth &&
            !felt.hasAttribute("tabindex"),
        )

      const frist = Date.now() + 3000
      while (uten().length > 0 && Date.now() < frist) {
        await new Promise((r) => setTimeout(r, 50))
      }

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

if (advarsler.length > 0) {
  console.log(`\n✗ ${advarsler.length} meldinger i konsollen:`)
  for (const a of [...new Set(advarsler)]) console.log(`  ${a}`)
  process.exit(1)
}

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
