/**
 * Sjekker markup mot Fristil, utenfor nettleseren.
 *
 * `diagnoseMarkup(html)` er den samme sjekken som editorutvidelsen kjører
 * mens du skriver, og som `fristil sjekk` kjører på kommandolinjen. Den
 * finnes her fordi markup som blir til uten JavaScript, i en Go-mal, en
 * Kotlin-streng eller en Razor-visning, ikke har noen kompilator som ser
 * på attributtene. En test i appen kan da kjøre den over HTML-en serveren
 * faktisk sender:
 *
 * ```ts
 * import { diagnoseMarkup } from "@fristil/designsystem/diagnostics"
 *
 * const funn = diagnoseMarkup(html)
 * expect(funn).toEqual([])
 * ```
 *
 * Elementene og klassene den sjekker mot genereres fra komponentene, og
 * følger pakken. `diagnose(text, elements, classes)` tar egne lister.
 */
export { classes } from "./classes.js"
export {
  type Attribute,
  type ClassAttribute,
  type Classes,
  type ClassInfo,
  closest,
  diagnose,
  type Element,
  type Elements,
  type Finding,
  type Fix,
  type Severity,
  tagEnd,
  withoutHidden,
} from "./diagnostics.js"
export { elements } from "./elements.js"

import { classes } from "./classes.js"
import { diagnose, type Finding } from "./diagnostics.js"
import { elements } from "./elements.js"

/** Alle funn i teksten, mot pakkens egne elementer og klasser. */
export function diagnoseMarkup(text: string): Finding[] {
  return diagnose(text, elements, classes)
}
