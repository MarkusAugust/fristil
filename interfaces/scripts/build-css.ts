/**
 * Writes `dist/lotek.css`, every stylesheet in one file.
 *
 * The calculation, and why the file exists, is in `css-bundle.ts`. Only the
 * writing and the output are here, since `agent-parts.ts` needs the same
 * calculation without writing anything.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildBundledCss, bundledSize } from "./css-bundle.js"

const PACKAGE = fileURLToPath(new URL("../", import.meta.url))
const OUT = join(PACKAGE, "dist", "lotek.css")

let bundled: ReturnType<typeof buildBundledCss>
try {
  bundled = buildBundledCss()
} catch (error) {
  console.error(`✗ build-css: ${(error as Error).message}.`)
  process.exit(1)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, bundled.css)

const { kb, gzipKb } = bundledSize(bundled.css)

console.log(
  `lotek.css: ${bundled.entries} entries and ${bundled.files} files, ` +
    `${bundled.imports} @import flattened, ${kb} kB (${gzipKb} kB with gzip).`,
)
