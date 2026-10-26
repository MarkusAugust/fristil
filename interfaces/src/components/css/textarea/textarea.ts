import {
  attributes,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const TEXTAREA_CLASS = "lt-textarea" as const

export type TextareaOptions = {
  /** Validation state. Default: `default`. */
  state?: FieldState
}

export type TextareaAttributes = {
  class: typeof TEXTAREA_CLASS
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * The attributes for a multi-line text field.
 *
 * ```ts
 * <textarea {...textarea({ state: "invalid" })} />
 * ```
 */
export const textarea = Object.assign(
  ({ state = "default" }: TextareaOptions = {}): TextareaAttributes =>
    attributes({
      class: TEXTAREA_CLASS,
      "data-state": state === "default" ? undefined : state,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    states: fieldStates,
    isState: isFieldState,
  },
)
