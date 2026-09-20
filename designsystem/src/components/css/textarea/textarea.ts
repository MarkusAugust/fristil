import {
  attributter,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const TEXTAREA_CLASS = "fs-textarea" as const

export type TextareaOptions = {
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
}

export type TextareaAttributes = {
  class: typeof TEXTAREA_CLASS
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * Attributtene for et flerlinjet tekstfelt.
 *
 * ```ts
 * <textarea {...textarea({ state: "invalid" })} />
 * ```
 */
export const textarea = Object.assign(
  ({ state = "default" }: TextareaOptions = {}): TextareaAttributes =>
    attributter({
      class: TEXTAREA_CLASS,
      "data-state": state === "default" ? undefined : state,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    states: fieldStates,
    isState: isFieldState,
  },
)
