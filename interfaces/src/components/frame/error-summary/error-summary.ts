import { attributes } from "../../css/shared.js"

export const ERROR_SUMMARY_CLASS = "lt-error-summary" as const
export const ERROR_SUMMARY_TITLE_CLASS = "lt-error-summary__title" as const

export type ErrorSummaryOptions = {
  /** The number of errors the server found. When it is zero, the box is hidden. */
  count?: number
  /** The id of the box, so the form can move focus here after submission. */
  id?: string
  /**
   * The id of the heading. The box takes its name from it with
   * `aria-labelledby`. Without it, `<lt-error-summary>` gives the heading an id
   * and writes the wiring in the browser. An empty one counts as none.
   */
  titleId?: string
}

export type ErrorSummaryAttributes = {
  host: {
    class: typeof ERROR_SUMMARY_CLASS
    role: "alert"
    tabindex: "-1"
    id?: string
    hidden?: true
    "aria-labelledby"?: string
  }
  title: {
    class: typeof ERROR_SUMMARY_TITLE_CLASS
    id?: string
  }
}

/**
 * The attributes for an error summary.
 *
 * The server writes the whole box, including the heading and the list.
 * `<lt-error-summary>` only moves focus and handles clicks on the links. The
 * component used to create the heading itself, and then it disappeared on
 * every morph in Datastar.
 *
 * ```ts
 * const summary = lt.errorSummary({
 *   count: errors.length,
 *   id: "errors",
 *   titleId: "errors-title",
 * })
 * ```
 * ```html
 * <lt-error-summary {...summary.host}>
 *   <h2 {...summary.title}>You need to fix 2 errors</h2>
 *   <ul><li><a href="#email">The email address is missing an @</a></li></ul>
 * </lt-error-summary>
 * ```
 */
export const errorSummary = ({
  count = 0,
  id,
  titleId: givenTitleId,
}: ErrorSummaryOptions = {}): ErrorSummaryAttributes => {
  // `aria-labelledby=""` names nothing, and the web component would take it
  // as the server's word and leave the box without a name.
  const titleId = givenTitleId?.trim() ? givenTitleId : undefined
  return {
    host: attributes({
      class: ERROR_SUMMARY_CLASS,
      role: "alert" as const,
      tabindex: "-1" as const,
      id,
      hidden: count === 0 ? (true as const) : undefined,
      "aria-labelledby": titleId,
    }),
    title: attributes({ class: ERROR_SUMMARY_TITLE_CLASS, id: titleId }),
  }
}
