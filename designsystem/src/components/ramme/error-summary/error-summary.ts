import { attributes } from "../../css/shared.js"

export const ERROR_SUMMARY_CLASS = "fs-error-summary" as const
export const ERROR_SUMMARY_TITLE_CLASS = "fs-error-summary__title" as const

export type ErrorSummaryOptions = {
  /** Antall feil serveren fant. Er det null, skjules boksen. */
  count?: number
  /** Id på boksen, slik at skjemaet kan flytte fokus hit etter innsending. */
  id?: string
}

export type ErrorSummaryAttributes = {
  container: {
    class: typeof ERROR_SUMMARY_CLASS
    role: "alert"
    tabindex: "-1"
    id?: string
    hidden?: true
  }
  title: {
    class: typeof ERROR_SUMMARY_TITLE_CLASS
  }
}

/**
 * Attributtene for en feiloppsummering.
 *
 * Serveren skriver hele boksen, også overskriften og lista. `<fs-error-summary>`
 * flytter bare fokus og håndterer klikk på lenkene. Tidligere lagde komponenten
 * overskriften selv, og da forsvant den ved hver morfing i Datastar.
 *
 * ```ts
 * const feil = fs.errorSummary({ count: errors.length, id: "feil" })
 * ```
 * ```html
 * <fs-error-summary {...feil.container}>
 *   <h2 {...feil.title}>Du må rette 2 feil</h2>
 *   <ul><li><a href="#epost">E-posten mangler @</a></li></ul>
 * </fs-error-summary>
 * ```
 */
export const errorSummary = ({
  count = 0,
  id,
}: ErrorSummaryOptions = {}): ErrorSummaryAttributes => ({
  container: attributes({
    class: ERROR_SUMMARY_CLASS,
    role: "alert" as const,
    tabindex: "-1" as const,
    id,
    hidden: count === 0 ? (true as const) : undefined,
  }),
  title: { class: ERROR_SUMMARY_TITLE_CLASS },
})
