/**
 * Kjernen i JavaScript: laster WebAssembly-modulen og gir de samme to
 * funksjonene som `@fristil/designsystem/diagnostics`.
 *
 * Modulen har ingen importer, så den trenger ingen lim. Lasteren skriver
 * HTML-en inn som UTF-8 og leser funnene ut som JSON, slik hvert annet
 * vertsspråk gjør det.
 *
 * ```ts
 * const kjerne = lastKjerne(readFileSync("fristil-kjerne.wasm"))
 * kjerne.diagnosePage(html)
 * ```
 *
 * Synkron, fordi Node, Bun og VS Code tillater det. I nettleseren må modulen
 * kompileres med `WebAssembly.compile` først, og den kompilerte modulen kan
 * så gis hit.
 */

import type { Finding } from "../../designsystem/src/diagnostics/index.js"

type Eksporter = {
  memory: WebAssembly.Memory
  alloc(lengde: number): number
  diagnose_markup_raw(peker: number, lengde: number): void
  diagnose_page_raw(peker: number, lengde: number): void
  result_ptr(): number
  result_len(): number
}

export type Kjerne = {
  diagnoseMarkup(html: string): Finding[]
  diagnosePage(html: string): Finding[]
}

export function lastKjerne(kilde: BufferSource | WebAssembly.Module): Kjerne {
  const modul =
    kilde instanceof WebAssembly.Module ? kilde : new WebAssembly.Module(kilde)
  const e = new WebAssembly.Instance(modul, {}).exports as unknown as Eksporter
  const inn = new TextEncoder()
  const ut = new TextDecoder()

  const kjør = (
    funksjon: "diagnose_markup_raw" | "diagnose_page_raw",
    html: string,
  ) => {
    const bytes = inn.encode(html)
    const peker = e.alloc(bytes.length)
    // Minnet kan vokse ved hvert kall, så visningen lages etter `alloc`.
    new Uint8Array(e.memory.buffer, peker, bytes.length).set(bytes)
    e[funksjon](peker, bytes.length)
    const svar = new Uint8Array(e.memory.buffer, e.result_ptr(), e.result_len())
    return JSON.parse(ut.decode(svar)) as Finding[]
  }

  return {
    diagnoseMarkup: (html) => kjør("diagnose_markup_raw", html),
    diagnosePage: (html) => kjør("diagnose_page_raw", html),
  }
}
