/**
 * At ingen markup for nettleseren importerer et pakkenavn.
 *
 * `import … from "@fristil/designsystem/field"` i en `<script type="module">`
 * slår ikke opp i en nettleser: uten bundles eller importmap finnes ikke
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

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const SIDER = "documentation/src/content/docs/**/*.{mdx,md}"

const funn: string[] = []

/*
 * Tellerne står sist i løkka. Uten dem skrev sjekken det samme grønne svaret
 * etter null blokker som etter nitti, og en flyttet innholdsmappe eller en side
 * skrevet som `.md` ville gjort den til en sjekk som ikke ser på noe.
 */
let leste = 0
let blokker = 0

/*
 * Gjerdet kan ha mer enn språket i seg, som ```html title="index.html", og
 * importen kan skrives på flere måter enn `from "…"`: en bivirkningsimport uten
 * `from`, enkle anførselstegn, og `import("…")`. Alle feiler like stille i en
 * nettleser.
 */
const GJERDE = /```html[^\n]*\n([\s\S]*?)```/g
const IMPORT = /(?:from|import)\s*\(?\s*\n?\s*["'](@fristil\/[^"']*)["']/g

for (const rel of new Glob(SIDER).scanSync(ROT)) {
  const tekst = readFileSync(ROT + rel, "utf8")
  leste += 1

  for (const blokk of tekst.matchAll(GJERDE)) {
    blokker += 1

    for (const treff of blokk[1].matchAll(IMPORT)) {
      const før = tekst.slice(
        0,
        (blokk.index ?? 0) + blokk[1].indexOf(treff[0]),
      )
      funn.push(
        `${rel}:${før.split("\n").length} importerer «${treff[1]}» i markup for nettleseren. Bruk hele URL-en.`,
      )
    }
  }
}

if (leste === 0 || blokker === 0) {
  console.error(
    `Sjekken så ikke på noe: ${leste} sider og ${blokker} markupblokker. Står innholdet fortsatt i ${SIDER}?\n`,
  )
  process.exit(1)
}

if (funn.length > 0) {
  console.error(
    `Fant ${funn.length} import som ikke virker i en nettleser:\n${funn
      .map((linje) => `  - ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Ingen av ${blokker} markupblokker i ${leste} sider importerer et pakkenavn.`,
)
