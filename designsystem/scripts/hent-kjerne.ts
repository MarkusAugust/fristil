/**
 * Henter WebAssembly-modulene fra kjernens `dist/` inn i `kjerne/` her.
 *
 * Kjernen bygger til sin egen mappe (`kjerne/scripts/bygg.ts`), og pakken
 * leser modulene som filer den får: `src/diagnostics/default-core.ts` og
 * `src/cli.ts` laster dem herfra, `files` i `package.json` sender to av dem
 * med i tarballen, og `generate-matrise.ts` regner fargene med temaet.
 *
 * Kjør med: bun scripts/hent-kjerne.ts, eller som del av `bun run kjerne`.
 * Med `--tema` hentes bare temaet, som er det `generate` trenger.
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const FRA = fileURLToPath(new URL("../../kjerne/dist/", import.meta.url))
const HIT = fileURLToPath(new URL("../kjerne/", import.meta.url))

const bareTema = process.argv.includes("--tema")

/** Temaet alene, sjekken med temaet og manifestet, og kommandolinja. */
const ønsket = bareTema
  ? ["fristil-tema.wasm"]
  : ["fristil-tema.wasm", "fristil-kjerne.wasm", "fristil.wasm"]

const mangler = ønsket.filter((navn) => !existsSync(join(FRA, navn)))
if (mangler.length > 0) {
  const bygg = bareTema
    ? "bun kjerne/scripts/bygg.ts --tema"
    : "bun kjerne/scripts/bygg.ts"
  console.error(
    `Kjernen er ikke bygget: ${mangler.join(", ")} finnes ikke i ${FRA}. Kjør ${bygg} først.`,
  )
  process.exit(1)
}

mkdirSync(HIT, { recursive: true })
for (const navn of ønsket) copyFileSync(join(FRA, navn), join(HIT, navn))
console.log(`Hentet ${ønsket.join(", ")} inn i designsystem/kjerne/.`)
