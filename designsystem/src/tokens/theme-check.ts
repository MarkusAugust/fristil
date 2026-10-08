import { defaultCore } from "../diagnostics/default-core.js"

/**
 * Kontrollerer et tema en konsument har skrevet selv.
 *
 * Generatoren holder løftene av konstruksjon. Skriver noen inn egne verdier,
 * er løftene deres å holde, og da skylder vi dem et svar på hvilken celle som
 * ryker. Uten dette er «du kan overstyre hva som helst» en felle.
 *
 * Det eneste som betyr noe er hvilke `--fs-color-*` som står i hvilken blokk,
 * og om blokka er lys eller mørk, lest av `color-scheme` eller selektoren. En
 * verdi som ikke kan regnes på, meldes som nettopp det framfor å hoppes over,
 * og verdier som mangler fylles fra Fristils eget tema, så den som bare har
 * overstyrt én celle får den kontrollert mot resten av systemet.
 *
 * Sjekken er kjernen, skrevet i Rust, den samme som `fristil sjekk-tema`
 * bruker.
 */

export type ThemeReport = {
  problems: ThemeProblem[]
  /** Blokker som faktisk ble lest. */
  blocks: number
  /**
   * Verdier konsumenten selv skrev, og som ble forstått.
   *
   * Løftetallet alene duger ikke som mål på arbeid: standardverdiene fyller
   * hullene, så én linje gir like mange løfter som et helt tema. Dette tallet
   * teller det fila faktisk inneholdt.
   */
  declarations: number
  /** Løfter som faktisk ble kontrollert. */
  promises: number
}

export type ThemeProblem = {
  selector: string
  message: string
}

/** Leser et tema og kontrollerer hvert løfte i hver blokk. */
export function inspectTheme(css: string): ThemeReport {
  return defaultCore().inspectTheme(css)
}

/** Bare problemene, for den som ikke trenger tellingen. */
export function checkTheme(css: string): ThemeProblem[] {
  return inspectTheme(css).problems
}
