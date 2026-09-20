/**
 * Kontrollerer at alt `package.json` lover, faktisk ligger i pakken.
 *
 * Et inkrementelt `tsc -b` går ut fra at `tsconfig.tsbuildinfo` forteller
 * sannheten om hva som allerede er skrevet. Blir `dist` slettet uten at
 * buildinfo-fila følger med, hopper bygget over filer det tror finnes, og
 * pakken kan komme ut med JavaScript men uten `.d.ts`. Da forsvinner
 * typesikkerheten stille hos konsumenten, som er det siste vi vil.
 *
 * Kjør med: bun scripts/sjekk-eksport.ts, eller som en del av `bun run build`.
 */

import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

const rot = dirname(new URL("..", import.meta.url).pathname)
const pakke = join(rot, "designsystem")

type Exports = Record<string, string | Record<string, string>>

const manifest = (await Bun.file(join(pakke, "package.json")).json()) as {
  exports: Exports
}

const mangler: string[] = []

for (const [navn, verdi] of Object.entries(manifest.exports)) {
  const stier = typeof verdi === "string" ? [verdi] : Object.values(verdi)

  for (const sti of stier) {
    if (!existsSync(join(pakke, sti))) {
      mangler.push(`${navn} → ${sti}`)
    }
  }
}

if (mangler.length > 0) {
  console.error(
    `Pakken lover ${mangler.length} filer som ikke finnes:\n\n` +
      mangler.map((linje) => `  ${linje}`).join("\n") +
      "\n\nKjør `bun run build` på nytt. Holder ikke det, slett" +
      " designsystem/tsconfig.tsbuildinfo og prøv igjen.\n",
  )
  process.exit(1)
}

console.log(
  `Pakken leverer alle ${Object.keys(manifest.exports).length} inngangspunktene.`,
)
