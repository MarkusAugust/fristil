/**
 * Kjernen i JavaScript: laster WebAssembly-modulen og gir de samme to
 * funksjonene som `@fristil/designsystem/diagnostics`.
 *
 * Modulen har ingen importer, så den trenger ingen lim. Lasteren skriver
 * HTML-en inn som UTF-8 og leser funnene ut som JSON, slik hvert annet
 * vertsspråk gjør det.
 *
 * ```ts
 * const kjerne = loadCore(readFileSync("fristil-kjerne.wasm"))
 * kjerne.diagnosePage(html)
 * ```
 *
 * Synkron, fordi Node, Bun og VS Code tillater det. I nettleseren må modulen
 * kompileres med `WebAssembly.compile` først, og den kompilerte modulen kan
 * så gis hit.
 */

import type { Finding } from "../../designsystem/src/diagnostics/index.js"

type Exports = {
  memory: WebAssembly.Memory
  alloc(lengde: number): number
  diagnose_markup_raw(peker: number, lengde: number): void
  diagnose_page_raw(peker: number, lengde: number): void
  result_ptr(): number
  result_len(): number
}

export type Core = {
  diagnoseMarkup(html: string): Finding[]
  diagnosePage(html: string): Finding[]
}

export function loadCore(source: BufferSource | WebAssembly.Module): Core {
  const module =
    source instanceof WebAssembly.Module
      ? source
      : new WebAssembly.Module(source)
  const e = new WebAssembly.Instance(module, {}).exports as unknown as Exports
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const run = (
    entry: "diagnose_markup_raw" | "diagnose_page_raw",
    html: string,
  ) => {
    const bytes = encoder.encode(html)
    const pointer = e.alloc(bytes.length)
    // Minnet kan vokse ved hvert kall, så visningen lages etter `alloc`.
    new Uint8Array(e.memory.buffer, pointer, bytes.length).set(bytes)
    e[entry](pointer, bytes.length)
    const result = new Uint8Array(
      e.memory.buffer,
      e.result_ptr(),
      e.result_len(),
    )
    return JSON.parse(decoder.decode(result)) as Finding[]
  }

  return {
    diagnoseMarkup: (html) => run("diagnose_markup_raw", html),
    diagnosePage: (html) => run("diagnose_page_raw", html),
  }
}
