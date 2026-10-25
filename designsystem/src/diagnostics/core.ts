/**
 * Kjernen: LO-TEKs sjekk og temagenerator, skrevet i Rust og bygget til én
 * WebAssembly-modul.
 *
 * Den samme modulen kjøres her, i VS Code, på JVM-en (Chicory) og i IntelliJ,
 * og gir det samme svaret overalt. Modulen har ingen importer, så den trenger
 * ingen lim: lasteren skriver teksten inn som UTF-8 og leser svaret ut som
 * JSON, slik hvert vertsspråk gjør det.
 *
 * Kjernen bærer ingen data. Ordforrådet og fargekontrakten gis den med
 * `loadManifest` og `loadContract`, fra filene i pakken.
 *
 * `diagnoseMarkup` og `diagnosePage` i `index.ts` laster modulen og filene
 * fra pakken selv. `loadCore` er for den som har modulen på en annen måte,
 * som en utvidelse som pakker den med seg, eller en nettleser:
 *
 * ```ts
 * const kjerne = loadCore(await WebAssembly.compileStreaming(fetch(url)))
 * kjerne.loadManifest(await (await fetch(manifestUrl)).text())
 * kjerne.diagnosePage(html)
 * ```
 *
 * Synkron, fordi Node, Bun og VS Code tillater det. I nettleseren må modulen
 * kompileres med `WebAssembly.compile` først, og den kompilerte modulen gis
 * hit.
 */

export type Severity = "error" | "warning"

/** Én endring i en rettelse: bytt ut teksten fra `start` til `end` med `text`. */
export type Edit = {
  start: number
  end: number
  text: string
}

/**
 * En rettelse editoren kan tilby: én eller flere endringer som hører sammen,
 * som `id` på feltet og `for` på ledeteksten. De står i tekstens rekkefølge
 * og overlapper ikke; bruk dem bakfra, så posisjonene holder. `preferred` er
 * den sikre, som `onlinetext` til `online-text`: samme bokstaver, bare
 * skrevet annerledes. Et forslag på avstand er et forslag.
 */
export type Fix = {
  title: string
  edits: Edit[]
  preferred?: boolean
}

export type Finding = {
  /** Der funnet begynner, som indeks i teksten (UTF-16, som en `string`). */
  start: number
  end: number
  /** Linja funnet begynner på, fra 1. */
  line: number
  /** Kolonnen funnet begynner på, fra 1, i UTF-16-enheter. */
  column: number
  message: string
  severity: Severity
  /** Navnet på regelen, som `unknown-class`. Det er det `lotek-ignore-next` tar. */
  rule: string
  /** Komponentsiden, som lenke i meldingen. */
  link: string
  fix?: Fix
}

export type CoreVersion = {
  /** Versjonen av kjernen. */
  core: string
  /** Versjonen av `@lo-tek/interfaces` manifestet er skrevet fra, eller `null` uten manifest. */
  manifest: string | null
  /** Formen på manifestet kjernen forstår. */
  schemaVersion: number
}

/** Et løfte i fargekontrakten som ikke holder. */
export type Violation = {
  family: string
  promise: string
  ratio: number
  required: number
}

/** Temaet `buildTheme` gir: tokenene per utseende, løftene som ryker, og CSS-en. */
export type CoreTheme = {
  light: Record<string, string>
  dark: Record<string, string>
  /** Løfter som ikke holder. Tom når temaet er i orden. */
  violations: Violation[]
  css: string
}

/** Det `inspectTheme` fant i et tema konsumenten har skrevet selv. */
export type CoreThemeReport = {
  problems: { selector: string; message: string }[]
  /** Blokker som faktisk ble lest. */
  blocks: number
  /** Verdier konsumenten selv skrev, og som ble forstått. */
  declarations: number
  /** Løfter som faktisk ble kontrollert. */
  promises: number
}

/** Det `inspectStyles` fant i et stilark. */
export type CoreStyles = {
  /** Hver klasse som står i en selektor. */
  classes: string[]
  /** Hver klasse med et attributt, og verdien når selektoren krever en. */
  attributes: { class: string; attribute: string; value?: string }[]
  /** Adressene i `@import`. */
  imports: string[]
}

export type Core = {
  /** Sjekker en mal eller et fragment. Kaster uten manifest. */
  diagnoseMarkup(html: string): Finding[]
  /** Sjekker en hel side, med koblingene. Kaster uten manifest. */
  diagnosePage(html: string): Finding[]
  /** Gir kjernen ordforrådet. Kaster med kjernens forklaring hvis det ikke kan leses. */
  loadManifest(json: string): void
  /** Gir kjernen fargekontrakten. Kaster med kjernens forklaring hvis den ikke kan leses. */
  loadContract(json: string): void
  version(): CoreVersion
  /** Bygger et tema av oppskriften. Kaster uten fargekontrakt, eller når oppskriften ikke kan brukes. */
  buildTheme(recipe: unknown): CoreTheme
  /** Kontrollerer hvert løfte i et tema skrevet som CSS. Kaster uten fargekontrakt. */
  inspectTheme(css: string): CoreThemeReport
  /** Klassene og attributtverdiene et stilark styler, lest med kjernens CSS-leser. */
  inspectStyles(css: string): CoreStyles
  /**
   * Sjekken med stilarkene i tillegg: en klasse ingen av dem styler, og en
   * verdi uten regel. `page` sjekker som `diagnosePage`, ellers som
   * `diagnoseMarkup`. Kaster uten manifest.
   */
  diagnoseStyled(html: string, css: string[], page: boolean): Finding[]
}

type Exports = {
  memory: WebAssembly.Memory
  alloc(length: number): number
  diagnose_markup_raw(pointer: number, length: number): number
  diagnose_page_raw(pointer: number, length: number): number
  load_manifest_raw(pointer: number, length: number): number
  load_contract_raw(pointer: number, length: number): number
  version_raw(): void
  build_theme_raw(pointer: number, length: number): number
  inspect_theme_raw(pointer: number, length: number): number
  inspect_styles_raw(pointer: number, length: number): void
  diagnose_styled_raw(pointer: number, length: number): number
  result_ptr(): number
  result_len(): number
}

/** Laster kjernen fra modulens bytes eller en ferdig kompilert modul. */
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
  /** Svaret fra et kall som kan avvises: verdien, eller kjernens forklaring som feil. */
  const answer = <T>(status: number): T => {
    if (status !== 0) throw new Error(read<{ error: string }>().error)
    return read<T>()
  }

  return {
    diagnoseMarkup: (html) => answer(e.diagnose_markup_raw(...write(html))),
    diagnosePage: (html) => answer(e.diagnose_page_raw(...write(html))),
    loadManifest: (json) => {
      answer(e.load_manifest_raw(...write(json)))
    },
    loadContract: (json) => {
      answer(e.load_contract_raw(...write(json)))
    },
    version: () => {
      e.version_raw()
      return read()
    },
    buildTheme: (recipe) =>
      answer(e.build_theme_raw(...write(JSON.stringify(recipe)))),
    inspectTheme: (css) => answer(e.inspect_theme_raw(...write(css))),
    inspectStyles: (css) => {
      e.inspect_styles_raw(...write(css))
      return read()
    },
    diagnoseStyled: (html, css, page) =>
      answer(
        e.diagnose_styled_raw(...write(JSON.stringify({ html, css, page }))),
      ),
  }
}
