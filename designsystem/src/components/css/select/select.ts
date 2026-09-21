import {
  attributes,
  createGuard,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const SELECT_CLASS = "fs-select" as const

/**
 * Hvem som tegner nedtrekkslista.
 *
 * `auto` er nettleserens egen liste, et vindu fra operativsystemet som ikke
 * kan styles. `styled` ber nettleseren tegne den inne i siden i stedet, slik
 * at den får designsystemets farger, avstander og skygge.
 */
export const selectPickers = ["auto", "styled"] as const
export type SelectPicker = (typeof selectPickers)[number]
export type NonDefaultSelectPicker = Exclude<SelectPicker, "auto">
export const isSelectPicker = createGuard(selectPickers)

export type SelectOptions = {
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
  /** Hvem som tegner nedtrekkslista. Standard: `auto`. */
  picker?: SelectPicker
}

export type SelectAttributes = {
  class: typeof SELECT_CLASS
  "data-state"?: NonDefaultFieldState
  "data-picker"?: NonDefaultSelectPicker
  "aria-invalid"?: "true"
}

/**
 * Attributtene for en nedtrekksliste.
 *
 * ```ts
 * <select {...select({ state: "invalid" })} />
 * <select {...select({ picker: "styled" })} />
 * ```
 */
export const select = Object.assign(
  ({
    state = "default",
    picker = "auto",
  }: SelectOptions = {}): SelectAttributes =>
    attributes({
      class: SELECT_CLASS,
      "data-state": state === "default" ? undefined : state,
      "data-picker": picker === "auto" ? undefined : picker,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    states: fieldStates,
    isState: isFieldState,
    pickers: selectPickers,
    isPicker: isSelectPicker,
  },
)
