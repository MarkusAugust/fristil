/**
 * Bygger WebAssembly-modulene til `core/dist/`.
 *
 * Kjernen bærer ingen data, så bygget leser ingenting utenfor `core/`.
 * Manifestet og fargekontrakten gis den av verten når den kjører.
 *
 * To moduler: `lotek-core.wasm`, sjekken og temaet, og `lotek.wasm`,
 * kommandolinja (`cli/`) som WASI-modul. Pakken henter dem derfra med
 * `bun run core` i `designsystem/`. Ingen av dem sjekkes inn.
 *
 * Kjør med: bun core/scripts/build.ts. Krever Rust. `rust-toolchain.toml`
 * henter versjonen og målene.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const KJERNE = fileURLToPath(new URL("..", import.meta.url))
const WASM = join(
  KJERNE,
  "target/wasm32-unknown-unknown/release/lotek_core.wasm",
)
export const MODUL = join(KJERNE, "dist/lotek-core.wasm")
const CLI = join(KJERNE, "target/wasm32-wasip1/release/lotek.wasm")
export const KOMMANDOLINJE = join(KJERNE, "dist/lotek.wasm")

if (import.meta.main) {
  const cargo = Bun.spawnSync(
    ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
    { cwd: KJERNE, stdout: "inherit", stderr: "inherit" },
  )
  if (cargo.exitCode !== 0) process.exit(cargo.exitCode ?? 1)
  const wasi = Bun.spawnSync(
    ["cargo", "build", "--release", "-p", "lotek", "--target", "wasm32-wasip1"],
    { cwd: KJERNE, stdout: "inherit", stderr: "inherit" },
  )
  if (wasi.exitCode !== 0) process.exit(wasi.exitCode ?? 1)
  mkdirSync(join(KJERNE, "dist"), { recursive: true })
  copyFileSync(WASM, MODUL)
  copyFileSync(CLI, KOMMANDOLINJE)

  const kb = (sti: string) => (statSync(sti).size / 1024).toFixed(0)
  console.log(
    `Skrev ${MODUL} (${kb(MODUL)} kB) og ${KOMMANDOLINJE} (${kb(KOMMANDOLINJE)} kB).`,
  )
}
