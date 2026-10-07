/**
 * Sjekker markup mot Fristil, utenfor nettleseren.
 *
 * `diagnoseMarkup(html)` er den samme sjekken som editorutvidelsene kjører
 * mens du skriver, og som `fristil sjekk` kjører på kommandolinjen. Den
 * finnes her fordi markup som blir til uten JavaScript, i en Go-mal, en
 * Kotlin-streng eller en Razor-visning, ikke har noen kompilator som ser
 * på attributtene. En test i appen kan da kjøre den over HTML-en serveren
 * faktisk sender:
 *
 * ```ts
 * import { diagnosePage } from "@fristil/designsystem/diagnostics"
 *
 * expect(diagnosePage(html)).toEqual([])
 * ```
 *
 * Sjekken er kjernen, skrevet i Rust og bygget til WebAssembly (se
 * `core.ts`). Modulen følger pakken, og lastes første gang en av funksjonene
 * kalles, i Node, Bun og Deno. I nettleseren, eller der modulen er pakket med
 * på en annen måte, laster `loadCore` den.
 */

import { type Core, type Finding, loadCore } from "./core.js"

export {
  type Core,
  type CoreVersion,
  type Finding,
  type Fix,
  loadCore,
  type Severity,
} from "./core.js"

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
function defaultCore(): Core {
  if (core) return core
  const fs = globalThis.process?.getBuiltinModule?.("node:fs") as
    | typeof import("node:fs")
    | undefined
  if (!fs)
    throw new Error(
      "diagnoseMarkup og diagnosePage leser kjernen fra pakken, og det krever Node, Bun eller Deno. I nettleseren: last fristil-kjerne.wasm selv og gi den til loadCore.",
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

/** Alle funn i teksten: ordforrådet, for en mal eller en bit av en side. */
export function diagnoseMarkup(text: string): Finding[] {
  return defaultCore().diagnoseMarkup(text)
}

/**
 * Alle funn på en hel side: det `diagnoseMarkup` finner, og i tillegg at
 * hver `for`, `aria-describedby`, `aria-labelledby` og `aria-controls` peker
 * på en id som finnes, at ingen id står to ganger, og at hvert Fristil-felt
 * og hver hjelpetekst og feilmelding er koblet.
 *
 * Bruk den på HTML-en serveren sender, ikke på en mal: i en mal som er delt
 * i biter, kan id-en stå i en annen fil.
 *
 * ```ts
 * const html = await (await fetch("http://localhost:8080/skjema")).text()
 * expect(diagnosePage(html)).toEqual([])
 * ```
 */
export function diagnosePage(text: string): Finding[] {
  return defaultCore().diagnosePage(text)
}
