/**
 * Henter WebAssembly-modulene fra kjernens `dist/` inn i `kjerne/` her.
 *
 * Kjernen bygger til sin egen mappe (`kjerne/scripts/bygg.ts`), og pakken
 * leser modulene som filer den får: `src/diagnostics/default-core.ts` og
 * `src/cli.ts` laster dem herfra, `files` i `package.json` sender to av dem
 * med i tarballen, og `generate-matrise.ts` regner fargene med temaet.
 *
 * Mappa modulene hentes fra er `kjerne/dist/` ved siden av, eller den
 * `FRISTIL_KJERNE_DIST` peker på, for den som har modulene fra en utgivelse
 * i stedet for fra et bygg.
 *
 * Kjør med: bun scripts/hent-kjerne.ts, eller som del av `bun run kjerne`.
 * Med `--tema` hentes bare temaet, som er det `generate` trenger.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const FRA =
  process.env.FRISTIL_KJERNE_DIST ??
  fileURLToPath(new URL("../../kjerne/dist/", import.meta.url))
const HIT = fileURLToPath(new URL("../kjerne/", import.meta.url))

/** Temaet alene, sjekken med temaet og manifestet, og kommandolinja. */
export const TEMA = "fristil-tema.wasm"
export const MODUL = "fristil-kjerne.wasm"
export const KOMMANDOLINJE = "fristil.wasm"

const ønsket = process.argv.includes("--tema")
  ? [TEMA]
  : [TEMA, MODUL, KOMMANDOLINJE]

const mangler = ønsket.filter((navn) => !existsSync(join(FRA, navn)))
if (mangler.length > 0) {
  console.error(
    `Kjernen er ikke bygget: ${mangler.join(", ")} finnes ikke i ${FRA}. Kjør bun kjerne/scripts/bygg.ts først.`,
  )
  process.exit(1)
}

mkdirSync(HIT, { recursive: true })
for (const navn of ønsket) copyFileSync(join(FRA, navn), join(HIT, navn))
console.log(`Hentet ${ønsket.join(", ")} inn i designsystem/kjerne/.`)
