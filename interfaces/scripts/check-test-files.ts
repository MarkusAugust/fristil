/**
 * Checks that every component folder has at least one browser test.
 *
 * Progress got its first test in the audit after 0.32.1, and nothing had
 * reported that it was missing. The folders are listed directly, not through
 * the files in them: a check that found the folders through `*.ts` would
 * have counted the test file itself, and a folder with only CSS would never
 * have been seen.
 *
 * Run with: bun interfaces/scripts/check-test-files.ts
 */

import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const COMPONENTS = fileURLToPath(new URL("../src/components", import.meta.url))

const missing: string[] = []
let checked = 0
// The categories are read from the folder, so a new category cannot be missed.
const categories = readdirSync(COMPONENTS).filter((name) =>
  statSync(join(COMPONENTS, name)).isDirectory(),
)
for (const category of categories) {
  for (const name of readdirSync(join(COMPONENTS, category)).sort()) {
    const folder = join(COMPONENTS, category, name)
    if (!statSync(folder).isDirectory()) continue
    if (!readdirSync(folder).some((file) => file.endsWith(".browser.test.ts")))
      missing.push(`${category}/${name}`)
    checked += 1
  }
}

// The guard comes last, after the report, and requires that something was seen.
if (missing.length > 0) {
  console.error(
    `✗ ${missing.length} of ${checked} component folders have no *.browser.test.ts:\n\n${missing.map((m) => `  ${m}`).join("\n")}\n`,
  )
  process.exit(1)
}
if (checked === 0) {
  console.error(`✗ found no component folders in ${COMPONENTS}`)
  process.exit(1)
}
console.log(`All ${checked} component folders have a browser test.`)
