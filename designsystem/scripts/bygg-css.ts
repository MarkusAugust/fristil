/**
 * Skriver `dist/fristil.css`, alle stilarkene i én fil.
 *
 * Regnestykket, og hvorfor fila finnes, står i `css-samlet.ts`. Her er bare
 * skrivingen og utskriften, siden `agent-deler.ts` trenger det samme
 * regnestykket uten å skrive noe.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { byggSamletCss, samletStørrelse } from "./css-samlet.js"

const PAKKE = fileURLToPath(new URL("../", import.meta.url))
const UT = join(PAKKE, "dist", "fristil.css")

let samlet: ReturnType<typeof byggSamletCss>
try {
  samlet = byggSamletCss()
} catch (feil) {
  console.error(`✗ bygg-css: ${(feil as Error).message}.`)
  process.exit(1)
}

mkdirSync(dirname(UT), { recursive: true })
writeFileSync(UT, samlet.css)

const { kb, gzipKb } = samletStørrelse(samlet.css)

console.log(
  `fristil.css: ${samlet.oppføringer} oppføringer og ${samlet.filer} filer, ` +
    `${samlet.importer} @import flatet ut, ${kb} kB (${gzipKb} kB med gzip).`,
)
