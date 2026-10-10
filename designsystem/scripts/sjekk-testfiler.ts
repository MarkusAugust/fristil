/**
 * At hver komponentmappe har minst én nettlesertest.
 *
 * Progress fikk sin første test i revisjonen etter 0.32.1, og ingenting hadde
 * sagt fra om at den manglet. Mappene listes direkte, ikke gjennom filene i
 * dem: en sjekk som fant mappene gjennom `*.ts`, ville talt testfila selv, og
 * en mappe med bare CSS ville aldri blitt sett.
 *
 * Kjør med: bun designsystem/scripts/sjekk-testfiler.ts
 */

import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const COMPONENTS = fileURLToPath(new URL("../src/components", import.meta.url))
const CATEGORIES = ["css", "ramme", "frittstaende"]

const missing: string[] = []
let checked = 0
for (const category of CATEGORIES) {
  for (const name of readdirSync(join(COMPONENTS, category)).sort()) {
    const folder = join(COMPONENTS, category, name)
    if (!statSync(folder).isDirectory()) continue
    if (!readdirSync(folder).some((file) => file.endsWith(".browser.test.ts")))
      missing.push(`${category}/${name}`)
    checked += 1
  }
}

// Vakten står til slutt, etter rapporten, og krever at noe ble sett.
if (missing.length > 0) {
  console.error(
    `✗ ${missing.length} av ${checked} komponentmapper har ingen *.browser.test.ts:\n\n${missing.map((m) => `  ${m}`).join("\n")}\n`,
  )
  process.exit(1)
}
if (checked === 0) {
  console.error(`✗ fant ingen komponentmapper i ${COMPONENTS}`)
  process.exit(1)
}
console.log(`Alle ${checked} komponentmappene har en nettlesertest.`)
