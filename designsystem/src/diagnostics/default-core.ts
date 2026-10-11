/**
 * Kjernen fra pakken selv, lastet første gang den trengs, med pakkens eget
 * manifest og fargekontrakt, som ligger ved siden av modulen.
 *
 * Både sjekken (`@fristil/designsystem/diagnostics`) og temaet
 * (`@fristil/designsystem/tema` og `tema-sjekk`) bruker den samme instansen.
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
        : "Fristil leser kjernen fra pakken, og det krever Node, Bun eller Deno. I nettleseren: last fristil-kjerne.wasm selv, gi den til loadCore, og gi kjernen manifest.json med loadManifest og fargekontrakt.json med loadContract.",
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
  // Manifestet trengs bare av sjekken, og fargekontrakten bare av temaet.
  // Hver av dem leses første gang et kall trenger den.
  const loaded = loadCore(bytes)
  let manifest = false
  let contract = false
  const withManifest = () => {
    if (!manifest) loaded.loadManifest(fs.readFileSync(MANIFEST, "utf8"))
    manifest = true
    return loaded
  }
  const withContract = () => {
    if (!contract) loaded.loadContract(fs.readFileSync(CONTRACT, "utf8"))
    contract = true
    return loaded
  }
  core = {
    ...loaded,
    diagnoseMarkup: (html) => withManifest().diagnoseMarkup(html),
    diagnosePage: (html) => withManifest().diagnosePage(html),
    diagnoseStyled: (html, css, page) =>
      withManifest().diagnoseStyled(html, css, page),
    version: () => withManifest().version(),
    buildTheme: (recipe) => withContract().buildTheme(recipe),
    inspectTheme: (css) => withContract().inspectTheme(css),
  }
  return core
}
