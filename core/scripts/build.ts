/**
 * Builds the WebAssembly modules into `core/dist/`.
 *
 * The core carries no data, so the build reads nothing outside `core/`.
 * The host gives it the manifest and the colour contract when it runs.
 *
 * Two modules: `lotek-core.wasm`, the check and the theme, and `lotek.wasm`,
 * the command line (`cli/`) as a WASI module. The package fetches them from
 * there with `bun run core` in `interfaces/`. Neither is checked in.
 *
 * Run with: bun core/scripts/build.ts. Requires Rust. `rust-toolchain.toml`
 * fetches the version and the targets.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const CORE = fileURLToPath(new URL("..", import.meta.url))
const WASM = join(CORE, "target/wasm32-unknown-unknown/release/lotek_core.wasm")
export const MODULE = join(CORE, "dist/lotek-core.wasm")
const CLI = join(CORE, "target/wasm32-wasip1/release/lotek.wasm")
export const COMMAND_LINE = join(CORE, "dist/lotek.wasm")

if (import.meta.main) {
  const cargo = Bun.spawnSync(
    ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
    { cwd: CORE, stdout: "inherit", stderr: "inherit" },
  )
  if (cargo.exitCode !== 0) process.exit(cargo.exitCode ?? 1)
  const wasi = Bun.spawnSync(
    ["cargo", "build", "--release", "-p", "lotek", "--target", "wasm32-wasip1"],
    { cwd: CORE, stdout: "inherit", stderr: "inherit" },
  )
  if (wasi.exitCode !== 0) process.exit(wasi.exitCode ?? 1)
  mkdirSync(join(CORE, "dist"), { recursive: true })
  copyFileSync(WASM, MODULE)
  copyFileSync(CLI, COMMAND_LINE)

  const kb = (path: string) => (statSync(path).size / 1024).toFixed(0)
  console.log(
    `Wrote ${MODULE} (${kb(MODULE)} kB) and ${COMMAND_LINE} (${kb(COMMAND_LINE)} kB).`,
  )
}
