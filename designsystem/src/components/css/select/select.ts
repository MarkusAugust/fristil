import {
  attributter,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const SELECT_CLASS = "fs-select" as const

export type SelectOptions = {
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
}

export type SelectAttributes = {
  class: typeof SELECT_CLASS
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * Attributtene for en nedtrekksliste.
 *
 * ```ts
 * <select {...select({ state: "invalid" })} />
 * ```
 */
export const select = Object.assign(
  ({ state = "default" }: SelectOptions = {}): SelectAttributes =>
    attributter({
      class: SELECT_CLASS,
      "data-state": state === "default" ? undefined : state,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    states: fieldStates,
    isState: isFieldState,
  },
)
