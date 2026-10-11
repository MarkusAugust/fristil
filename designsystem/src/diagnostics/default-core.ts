/**
 * Kjernen fra pakken selv, lastet første gang den trengs, med pakkens eget
 * manifest og fargekontrakt.
 *
 * Både sjekken (`@fristil/designsystem/diagnostics`) og temaet
 * (`@fristil/designsystem/tema` og `tema-sjekk`) bruker den samme instansen.
 * Kjernen bærer ingen data, så det er denne fila som gir den dataene: de
 * ligger i pakken ved siden av modulen.
 */

import { type Core, loadCore } from "./core.js"

/** Filene i pakken, sett fra både `src/diagnostics/` og `dist/diagnostics/`. */
const MODULE = new URL("../../kjerne/fristil-kjerne.wasm", import.meta.url)
const MANIFEST = new URL("../../manifest/manifest.json", import.meta.url)
const CONTRACT = new URL("../../src/tokens/fargekontrakt.json", import.meta.url)

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
  if (!fs) {
    // `getBuiltinModule` kom i Node 20.16 og 22.3. En eldre Node er Node,
    // og skal få vite at det er versjonen som er feil.
    const node = globalThis.process?.versions?.node
    throw new Error(
      node
        ? `Fristil krever Node 20.16 eller nyere, og dette er Node ${node}.`
        : "Fristil leser kjernen fra pakken, og det krever Node, Bun eller Deno. I nettleseren: last fristil-kjerne.wasm selv og gi den til loadCore.",
    )
  }
  let bytes: Uint8Array
  try {
    bytes = fs.readFileSync(MODULE)
  } catch {
    throw new Error(
      `Fant ikke kjernen i ${MODULE.pathname}. I repoet bygges den med «bun run kjerne» i designsystem/, som krever Rust.`,
    )
  }
  const loaded = loadCore(bytes)
  loaded.loadManifest(fs.readFileSync(MANIFEST, "utf8"))
  loaded.loadContract(fs.readFileSync(CONTRACT, "utf8"))
  core = loaded
  return core
}
