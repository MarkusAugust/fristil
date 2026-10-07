/**
 * Bygger WebAssembly-modulen og legger den i npm-pakken.
 *
 * Ordforrådet er ikke en del av Rust-koden. Kjernen leser manifestet
 * (`designsystem/manifest/manifest.json`) og bærer det innebygd som standard,
 * så en ny klasse eller variant i pakken når kjernen ved neste bygg av den.
 *
 * Modulen havner i `designsystem/kjerne/fristil-kjerne.wasm`, der
 * `@fristil/designsystem/diagnostics` leser den, både fra `src/` og fra
 * `dist/`. Den sjekkes ikke inn: den bygges av kildekoden ved siden av.
 *
 * Kjør med: bun kjerne/scripts/bygg.ts, eller bun run kjerne i designsystem/.
 * Krever Rust. `rust-toolchain.toml` henter versjonen og målet.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KJERNE = fileURLToPath(new URL("..", import.meta.url))
const WASM = join(
  KJERNE,
  "target/wasm32-unknown-unknown/release/fristil_kjerne.wasm",
)
export const MODUL = join(KJERNE, "../designsystem/kjerne/fristil-kjerne.wasm")

if (import.meta.main) {
  const cargo = Bun.spawnSync(
    ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
    { cwd: KJERNE, stdout: "inherit", stderr: "inherit" },
  )
  if (cargo.exitCode !== 0) process.exit(cargo.exitCode ?? 1)
  mkdirSync(dirname(MODUL), { recursive: true })
  copyFileSync(WASM, MODUL)

  const kb = (statSync(MODUL).size / 1024).toFixed(0)
  console.log(`Skrev ${MODUL} (${kb} kB).`)
}
