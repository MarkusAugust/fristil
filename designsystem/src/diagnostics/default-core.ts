/**
 * Kjernen fra pakken selv, lastet første gang den trengs.
 *
 * Både sjekken (`@fristil/designsystem/diagnostics`) og temaet
 * (`@fristil/designsystem/tema` og `tema-sjekk`) bruker den samme instansen.
 */

import { type Core, loadCore } from "./core.js"

/** Modulen i pakken, sett fra både `src/diagnostics/` og `dist/diagnostics/`. */
const MODULE = new URL("../../kjerne/fristil-kjerne.wasm", import.meta.url)

let core: Core | undefined

/*
 * Lastes første gang den trengs, ikke når modulen importeres: den som bare
 * vil ha typene, eller `loadCore`, skal ikke betale for den.
 *
 * `node:fs` hentes med `process.getBuiltinModule` i stedet for en import, så
 * fila kan pakkes for nettleseren uten at pakkeverktøyet leter etter `fs`.
 */
export function defaultCore(): Core {
  if (core) return core
  const fs = globalThis.process?.getBuiltinModule?.("node:fs") as
    | typeof import("node:fs")
    | undefined
  if (!fs)
    throw new Error(
      "Fristil leser kjernen fra pakken, og det krever Node, Bun eller Deno. I nettleseren: last fristil-kjerne.wasm selv og gi den til loadCore.",
    )
  let bytes: Uint8Array
  try {
    bytes = fs.readFileSync(MODULE)
  } catch {
    throw new Error(
      `Fant ikke kjernen i ${MODULE.pathname}. I repoet bygges den med «bun run kjerne» i designsystem/, som krever Rust.`,
    )
  }
  core = loadCore(bytes)
  return core
}
