/**
 * Bygger JavaScript-en JVM-biblioteket kjører, og fasiten paritetstesten
 * sammenligner med.
 *
 * Diagnostikken skrives ikke på nytt i Kotlin. Den samme koden som
 * editorutvidelsen og `fristil sjekk` bruker, pakkes til én fil og kjøres i
 * QuickJS, kompilert til WebAssembly og videre til Java-bytekode av
 * QuickJs4J. Da finnes det én implementasjon, og ingen to som kan gli fra
 * hverandre.
 *
 * Fasiten er det TypeScript-versjonen svarer på hver fil i
 * `src/test/resources/paritet/`. Kotlin-testen krever at JVM-versjonen svarer
 * nøyaktig det samme, tegn for tegn.
 *
 * Kjør med: bun jvm/scripts/bygg.ts
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  diagnoseMarkup,
  diagnosePage,
} from "../../designsystem/src/diagnostics/index.js"

const JVM = fileURLToPath(new URL("..", import.meta.url))
const RESSURS = join(JVM, "src/main/resources/no/fristil/sjekk/diagnostikk.js")
const PARITET = join(JVM, "src/test/resources/paritet")

const bygget = await Bun.build({
  entrypoints: [join(JVM, "scripts/inngang.ts")],
  format: "iife",
  target: "browser",
})
if (!bygget.success) {
  for (const melding of bygget.logs) console.error(melding)
  process.exit(1)
}
writeFileSync(
  RESSURS,
  `// Generert av jvm/scripts/bygg.ts. Ikke rediger.\n${await bygget.outputs[0].text()}`,
)

for (const fil of readdirSync(PARITET).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(PARITET, fil), "utf8")
  const fasit = { markup: diagnoseMarkup(html), side: diagnosePage(html) }
  writeFileSync(
    join(PARITET, fil.replace(/\.html$/, ".json")),
    `${JSON.stringify(fasit, null, 2)}\n`,
  )
}

console.log(`Skrev ${RESSURS} og fasiten i ${PARITET}.`)
