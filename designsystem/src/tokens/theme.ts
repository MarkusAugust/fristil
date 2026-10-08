import type { Violation } from "../diagnostics/core.js"
import { defaultCore } from "../diagnostics/default-core.js"
import type { Family } from "./matrix.js"

export type { Violation }

/**
 * Bygger et helt fargetema av noen få merkefarger.
 *
 * Temaet er kontrakten anvendt på konsumentens kulører. Kuløren er deres,
 * lysheten er rollens, og løftene holder av konstruksjon. Derfor finnes det
 * ikke noe justeringspass her: det er ingenting å flytte på.
 *
 * ```ts
 * const tema = buildTheme({ accent: "#7c3aed", danger: "#b3261e" })
 * console.log(tema.css)
 * ```
 */

export type ThemeTypography = {
  /** Skriftstakken hele temaet skal bruke, skrevet som i CSS. */
  fontFamily?: string
  /** Vektene, som tall eller nøkkelord. */
  weights?: {
    regular?: string | number
    medium?: string | number
    semibold?: string | number
    bold?: string | number
  }
  /** Linjeavstand for kontroller, overskrifter, brødtekst og små flater. */
  lineHeights?: {
    default?: string | number
    heading?: string | number
    article?: string | number
    compact?: string | number
  }
}

/**
 * Formen i temaet: hjørner og rammer.
 *
 * Knappen står for seg, feltet for seg, og flatene for seg. Skillet er verdt
 * å holde: et annet norsk designsystem har helt runde knapper, mens feltene
 * har nesten rette hjørner, og ett felles tall ville gjort feltene til
 * kapsler.
 *
 * Avkryssingsboksen, merket, etiketten, valggruppa, avataren og skjelettet
 * står med vilje utenfor. Der er hjørnet ikke et stilvalg, men
 * selve formen: en avkryssingsboks som blir rund, ser ut som en radioknapp,
 * og et merke som blir firkantet, ser ut som en knapp.
 */
export type ThemeShape = {
  /** Hjørner på knappen, paginering og hopplenken. */
  buttonRadius?: string
  /** Hjørner på feltet, tekstområdet og nedtrekkslista. */
  fieldRadius?: string
  /**
   * Hjørner på kort, dialog, sprettoppvindu, varsel, trekkspill,
   * feiloppsummering, filopplasting, økttidsvarsel, forslagslista,
   * meldingen og hjelpeboblen.
   */
  surfaceRadius?: string
  /** Rammetykkelsen på knappen. */
  buttonBorderWidth?: string
  /** Vekten på knappeteksten. */
  buttonFontWeight?: string | number
}

/**
 * Merkefargene.
 *
 * Hver familie er valgfri for seg, og en du utelater arver Fristils egen
 * kulør. Utelater du alle, blir temaet et som bare setter skrift og form.
 */
export type ThemeColors = Partial<Record<Family, string>>

export type ThemeInput = ThemeColors & {
  /** Skrift og linjeavstand. Utelates den, står Fristils egen typografi. */
  typography?: ThemeTypography
  /** Hjørner og rammer. Utelates den, står Fristils egen form. */
  shape?: ThemeShape
}

export type Theme = {
  light: Record<string, string>
  dark: Record<string, string>
  /** Løfter som ikke holder. Tom når temaet er i orden. */
  violations: Violation[]
  css: string
}

/**
 * Bygger temaet, og kontrollerer hvert løfte mens det bygges.
 *
 * Regningen skjer i kjernen, skrevet i Rust, som `fristil tema` og Fristil for
 * Kotlin bruker. Verdiene i typografi og form skrives rett inn i en
 * CSS-regel, så en verdi som kan bryte ut av den, som `4px; } html {`, en
 * ulukket parentes eller `</style>`, avvises med en forklaring som navngir
 * feltet i oppskriften.
 */
export function buildTheme(input: ThemeInput): Theme {
  return defaultCore().buildTheme(input)
}
