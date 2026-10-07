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

import type { Finding } from "./core.js"
import { defaultCore } from "./default-core.js"

export {
  type Core,
  type CoreTheme,
  type CoreThemeReport,
  type CoreVersion,
  type Finding,
  type Fix,
  loadCore,
  type Severity,
  type Violation,
} from "./core.js"

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
