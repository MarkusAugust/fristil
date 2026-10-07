/**
 * Kjernen i JavaScript: laster WebAssembly-modulen og gir de samme to
 * funksjonene som `@fristil/designsystem/diagnostics`, og i tillegg
 * manifestet og versjonen.
 *
 * Modulen har ingen importer, så den trenger ingen lim. Lasteren skriver
 * teksten inn som UTF-8 og leser svaret ut som JSON, slik hvert annet
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
  alloc(length: number): number
  diagnose_markup_raw(pointer: number, length: number): void
  diagnose_page_raw(pointer: number, length: number): void
  load_manifest_raw(pointer: number, length: number): number
  reset_manifest(): void
  version_raw(): void
  result_ptr(): number
  result_len(): number
}

/** Et funn fra kjernen: det samme som `Finding`, med regel, linje og kolonne. */
export type CoreFinding = Finding & {
  /** Navnet på regelen, som `ukjent-klasse`. */
  rule: string
  /** Linja funnet begynner på, fra 1. */
  line: number
  /** Kolonnen funnet begynner på, fra 1, i UTF-16-enheter. */
  column: number
}

export type CoreVersion = {
  /** Versjonen av kjernen. */
  core: string
  /** Versjonen av `@fristil/designsystem` manifestet er skrevet fra. */
  manifest: string
  /** Formen på manifestet kjernen forstår. */
  schemaVersion: number
}

export type Core = {
  diagnoseMarkup(html: string): CoreFinding[]
  diagnosePage(html: string): CoreFinding[]
  /** Sjekker mot et annet manifest. Kaster med kjernens forklaring hvis det ikke kan leses. */
  loadManifest(json: string): void
  /** Går tilbake til manifestet kjernen er bygget med. */
  resetManifest(): void
  version(): CoreVersion
}

export function loadCore(source: BufferSource | WebAssembly.Module): Core {
  const module =
    source instanceof WebAssembly.Module
      ? source
      : new WebAssembly.Module(source)
  const e = new WebAssembly.Instance(module, {}).exports as unknown as Exports
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  /** Skriver teksten inn i modulens minne og gir pekeren og lengden. */
  const write = (text: string): [number, number] => {
    const bytes = encoder.encode(text)
    const pointer = e.alloc(bytes.length)
    // Minnet kan vokse ved hvert kall, så visningen lages etter `alloc`.
    new Uint8Array(e.memory.buffer, pointer, bytes.length).set(bytes)
    return [pointer, bytes.length]
  }
  const read = <T>(): T =>
    JSON.parse(
      decoder.decode(
        new Uint8Array(e.memory.buffer, e.result_ptr(), e.result_len()),
      ),
    ) as T

  return {
    diagnoseMarkup: (html) => {
      e.diagnose_markup_raw(...write(html))
      return read()
    },
    diagnosePage: (html) => {
      e.diagnose_page_raw(...write(html))
      return read()
    },
    loadManifest: (json) => {
      if (e.load_manifest_raw(...write(json)) !== 0)
        throw new Error(read<{ error: string }>().error)
    },
    resetManifest: () => e.reset_manifest(),
    version: () => {
      e.version_raw()
      return read()
    },
  }
}
