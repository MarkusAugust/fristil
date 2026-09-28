/**
 * At ingen markup for nettleseren importerer et pakkenavn.
 *
 * `import … from "@fristil/designsystem/field"` i en `<script type="module">`
 * slår ikke opp i en nettleser: uten byggesteg eller importmap finnes ikke
 * pakkenavnet, og importen feiler stille. Koden ser riktig ut, og virker ikke
 * limt inn.
 *
 * Regelen fantes allerede i `sjekk-oppskrifter.ts`, men den leser bare
 * komponentsidene og velger regel ut fra navnet på fanen. To sider utenfor det
 * søket sto derfor med feilen i flere runder: Datastar-sporet i `rammeverk.mdx`
 * og dialogen i `monster/bekreftelse.mdx`. Denne sjekken er enklere og dekker
 * alt: en `html`-blokk er markup for nettleseren uansett hvilken side den står
 * på, og uansett hva fanen rundt heter.
 *
 * `ts`, `tsx`, `js` og `astro` sjekkes ikke. Der finnes det et byggesteg, og da
 * er pakkenavnet riktig.
 *
 * Kjør med: bun documentation/scripts/sjekk-nettleserimport.ts
 */

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const SIDER = "documentation/src/content/docs/**/*.{mdx,md}"

/** Sidene i mappa, talt uten glob, så de to kildene er uavhengige. */
function tellSider(mappe: string): number {
  let antall = 0

  for (const oppf of readdirSync(mappe, { withFileTypes: true })) {
    if (oppf.isDirectory()) antall += tellSider(`${mappe}/${oppf.name}`)
    else if (/\.(mdx|md)$/.test(oppf.name)) antall += 1
  }

  return antall
}

const funn: string[] = []

let leste = 0
let blokker = 0

/*
 * Gjerdet kan ha mer enn språket i seg, som ```html title="index.html", og
 * språket kan stå med store bokstaver. Avslutningen må stå i starten av en
 * linje: uten det kuttet en ``` inne i blokka, som i `<pre>```</pre>`, resten
 * av den bort, og importene under ble aldri lest mens telleren gikk opp.
 *
 * Importen kan skrives på flere måter enn `from "…"`: en bivirkningsimport uten
 * `from`, enkle anførselstegn, og `import("…")`. Alle feiler like stille i en
 * nettleser.
 */
const GJERDE = /^[ \t]*```html[^\n]*\n([\s\S]*?)^[ \t]*```/gim
const IMPORT = /(?:from|import)\s*\(?\s*\n?\s*["'](@fristil\/[^"']*)["']/g

/*
 * En hardkodet CDN-adresse skal peke på en fil pakken faktisk sender ut, på den
 * versjonen som er utgitt.
 *
 * `sjekk-oppskrifter.ts` har den samme regelen, men leser bare komponentsidene.
 * De to adressene denne endringen legger inn står utenfor den mappa, sammen med
 * to som sto der fra før, og en skrivefeil som `fs-fields.js` ville passert
 * hver eneste vaktpost i repoet og gitt 404 i nettleseren. Vakten har adressen
 * i hånda uansett, så den kontrollerer den.
 */
const CDN =
  /cdn\.jsdelivr\.net\/npm\/@fristil\/designsystem@([^/]+)\/([^"'\s]+)/g
const VERSJON = (
  JSON.parse(readFileSync(`${ROT}designsystem/package.json`, "utf8")) as {
    version: string
  }
).version

const linjen = (tekst: string, indeks: number) =>
  tekst.slice(0, indeks).split("\n").length

for (const rel of new Glob(SIDER).scanSync(ROT)) {
  const tekst = readFileSync(ROT + rel, "utf8")

  for (const blokk of tekst.matchAll(GJERDE)) {
    // Innholdet begynner etter gjerdelinja, ikke på den.
    const start = (blokk.index ?? 0) + blokk[0].indexOf("\n") + 1

    for (const treff of blokk[1].matchAll(IMPORT)) {
      funn.push(
        `${rel}:${linjen(tekst, start + (treff.index ?? 0))} importerer «${treff[1]}» i markup for nettleseren. Bruk hele URL-en.`,
      )
    }

    blokker += 1
  }

  for (const treff of tekst.matchAll(CDN)) {
    const [, versjon, filsti] = treff
    const hvor = `${rel}:${linjen(tekst, treff.index ?? 0)}`

    if (versjon !== VERSJON) {
      funn.push(
        `${hvor} peker på @fristil/designsystem@${versjon}, mens pakken er ${VERSJON}.`,
      )
    }

    if (!existsSync(`${ROT}designsystem/${filsti}`)) {
      funn.push(`${hvor} peker på ${filsti}, som pakken ikke sender ut.`)
    }
  }

  leste += 1
}

/*
 * Tell hva som faktisk ble gjort, og krev at tallet er både likt det forventede
 * og større enn null. Det forventede kommer fra en annen mekanisme enn køen:
 * globben fylte lista, og en vanlig gjennomgang av mappa teller den. Faller
 * mønsteret fra 58 sider til 1, sier de to ulike tall.
 */
const ventet = [...new Glob(SIDER).scanSync(ROT)].length
const fraMappa = tellSider(`${ROT}documentation/src/content/docs`)

if (leste === 0 || blokker === 0 || leste !== ventet || leste !== fraMappa) {
  console.error(
    `Sjekken så ikke på det den skulle: ${leste} sider lest, ${ventet} fra globben, ${fraMappa} i mappa, og ${blokker} markupblokker.\n`,
  )
  process.exit(1)
}

if (funn.length > 0) {
  console.error(
    `Fant ${funn.length} adresser som ikke virker i en nettleser:\n${funn
      .map((linje) => `  - ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Ingen av ${blokker} markupblokker i ${leste} sider importerer et pakkenavn, og hver CDN-adresse peker på ${VERSJON} og en fil som finnes.`,
)
