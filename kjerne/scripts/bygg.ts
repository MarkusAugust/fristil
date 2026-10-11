/**
 * Bygger WebAssembly-modulene og legger dem i `kjerne/dist/`.
 *
 * Tre moduler:
 *
 * - `fristil-tema.wasm`: temaet alene, fra crate-en `tema/`. Pakken regner
 *   fargematrisen sin med den, og den trenger ikke manifestet.
 * - `fristil-kjerne.wasm`: sjekken og temaet, med manifestet innebygd. Det er
 *   den `@fristil/designsystem/diagnostics`, VS Code, JVM-en og IntelliJ
 *   kjører.
 * - `fristil.wasm`: kommandolinja (`cli/`) som WASI-modul, som
 *   `npx @fristil/designsystem` kjører.
 *
 * Ordforrådet er ikke en del av Rust-koden. Kjernen leser manifestet
 * (`designsystem/manifest/manifest.json`) og bærer det innebygd som standard,
 * så en ny klasse eller variant i pakken når kjernen ved neste bygg av den.
 *
 * Skriptet skriver bare til sin egen mappe. Pakken henter modulene inn i
 * `designsystem/kjerne/` med `scripts/hent-kjerne.ts`, slik at den leser
 * dem som filer den får, og ikke som et bygg i en annen mappe. Ingen av dem
 * sjekkes inn.
 *
 * Kjør med: bun kjerne/scripts/bygg.ts, eller `bun run kjerne` i
 * designsystem/. Med `--tema` bygges bare temaet, som er det `generate`
 * trenger. Krever Rust. `rust-toolchain.toml` henter versjonen og målene.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const KJERNE = fileURLToPath(new URL("..", import.meta.url))
const DIST = join(KJERNE, "dist")
const WASM32 = join(KJERNE, "target/wasm32-unknown-unknown/release")

export const TEMA = join(DIST, "fristil-tema.wasm")
export const MODUL = join(DIST, "fristil-kjerne.wasm")
export const KOMMANDOLINJE = join(DIST, "fristil.wasm")

/** Alt skriptet kan skrive, med kilden i `target/`. */
export const MODULER: Record<string, string> = {
  [TEMA]: join(WASM32, "fristil_tema.wasm"),
  [MODUL]: join(WASM32, "fristil_kjerne.wasm"),
  [KOMMANDOLINJE]: join(KJERNE, "target/wasm32-wasip1/release/fristil.wasm"),
}

function cargo(...arguments_: string[]): void {
  const run = Bun.spawnSync(["cargo", "build", "--release", ...arguments_], {
    cwd: KJERNE,
    stdout: "inherit",
    stderr: "inherit",
  })
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1)
}

if (import.meta.main) {
  const onlyTheme = process.argv.includes("--tema")
  const written: string[] = onlyTheme ? [TEMA] : [TEMA, MODUL, KOMMANDOLINJE]

  if (onlyTheme) {
    cargo("--target", "wasm32-unknown-unknown", "-p", "fristil-tema")
  } else {
    cargo(
      "--target",
      "wasm32-unknown-unknown",
      "-p",
      "fristil-tema",
      "-p",
      "fristil-kjerne",
    )
    cargo("-p", "fristil", "--target", "wasm32-wasip1")
  }

  mkdirSync(DIST, { recursive: true })
  for (const target of written) copyFileSync(MODULER[target], target)

  const kb = (sti: string) => (statSync(sti).size / 1024).toFixed(0)
  console.log(
    `Skrev ${written.map((sti) => `${sti} (${kb(sti)} kB)`).join(", ")}.`,
  )
}
