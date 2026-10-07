/**
 * Bygger WebAssembly-modulen og skriver fasiten.
 *
 * Ordforrådet er ikke en del av Rust-koden. Kjernen leser manifestet
 * (`designsystem/manifest/manifest.json`) og bærer det innebygd som standard,
 * så en ny klasse eller variant i pakken når kjernen ved neste bygg av den.
 *
 * Fasiten er det TypeScript-versjonen svarer på hver fil i `paritet/`. JVM-
 * testen sammenligner med den. `sjekk-paritet.ts` sammenligner modulen med
 * TypeScript direkte, også på markupen i dokumentasjonen.
 *
 * Kjør med: bun kjerne/scripts/bygg.ts
 * Krever Rust med målet wasm32-unknown-unknown.
 */

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  diagnoseMarkup,
  diagnosePage,
} from "../../designsystem/src/diagnostics/index.js"

const KJERNE = fileURLToPath(new URL("..", import.meta.url))
const WASM = join(
  KJERNE,
  "target/wasm32-unknown-unknown/release/fristil_kjerne.wasm",
)
export const MODUL = join(KJERNE, "dist/fristil-kjerne.wasm")

if (import.meta.main) {
  const cargo = Bun.spawnSync(
    ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
    { cwd: KJERNE, stdout: "inherit", stderr: "inherit" },
  )
  if (cargo.exitCode !== 0) process.exit(cargo.exitCode ?? 1)
  mkdirSync(join(KJERNE, "dist"), { recursive: true })
  copyFileSync(WASM, MODUL)

  const PARITET = join(KJERNE, "paritet")
  for (const fil of readdirSync(PARITET).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(join(PARITET, fil), "utf8")
    const fasit = { markup: diagnoseMarkup(html), side: diagnosePage(html) }
    writeFileSync(
      join(PARITET, fil.replace(/\.html$/, ".json")),
      `${JSON.stringify(fasit, null, 2)}\n`,
    )
  }

  const kb = (statSync(MODUL).size / 1024).toFixed(0)
  console.log(`Skrev ${MODUL} (${kb} kB) og fasiten i paritet/.`)
}
