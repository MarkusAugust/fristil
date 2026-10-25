import {
  attributes,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const CHECKBOX_CLASS = "lt-checkbox" as const
/** The row that holds the box and the text next to each other. */
export const CHECKBOX_ROW_CLASS = "lt-checkbox-row" as const

export type CheckboxOptions = {
  /** Validation state. Default: `default`. */
  state?: FieldState
}

export type CheckboxAttributes = {
  class: typeof CHECKBOX_CLASS
  type: "checkbox"
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * The attributes for a checkbox.
 *
 * `type` is set here, so the box cannot become a text field with a box's
 * styling. The indeterminate state is set with `element.indeterminate = true`
 * in JavaScript, not as an attribute, because HTML has no such attribute.
 *
 * ```ts
 * <input {...checkbox({ state: "invalid" })} />
 * ```
 */
export const checkbox = Object.assign(
  ({ state = "default" }: CheckboxOptions = {}): CheckboxAttributes =>
    attributes({
      class: CHECKBOX_CLASS,
      type: "checkbox" as const,
      "data-state": state === "default" ? undefined : state,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    /** The class on the row around the box and the text. */
    row: CHECKBOX_ROW_CLASS,
    states: fieldStates,
    isState: isFieldState,
  },
)
