import {
  attributes,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const CHECKBOX_CLASS = "fs-checkbox" as const
/** Raden som holder boksen og teksten ved siden av hverandre. */
export const CHECKBOX_ROW_CLASS = "fs-checkbox-row" as const

export type CheckboxOptions = {
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
}

export type CheckboxAttributes = {
  class: typeof CHECKBOX_CLASS
  type: "checkbox"
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * Attributtene for en avkryssingsboks.
 *
 * `type` settes her, slik at boksen ikke kan bli et tekstfelt med en boks sin
 * stil. Delvis avkrysset settes med `element.indeterminate = true` i
 * JavaScript, ikke som et attributt, fordi HTML ikke har noe slikt attributt.
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
    /** Klassen på raden rundt boksen og teksten. */
    row: CHECKBOX_ROW_CLASS,
    states: fieldStates,
    isState: isFieldState,
  },
)
