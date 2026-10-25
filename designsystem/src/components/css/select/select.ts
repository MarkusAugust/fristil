import {
  attributes,
  createGuard,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const SELECT_CLASS = "lt-select" as const

/**
 * Who draws the dropdown list.
 *
 * `auto` is the browser's own list, a window from the operating system that
 * cannot be styled. `styled` asks the browser to draw it inside the page
 * instead, so it gets the design system's colours, spacing and shadow.
 */
export const selectPickers = ["auto", "styled"] as const
export type SelectPicker = (typeof selectPickers)[number]
export type NonDefaultSelectPicker = Exclude<SelectPicker, "auto">
export const isSelectPicker = createGuard(selectPickers)

export type SelectOptions = {
  /** Validation state. Default: `default`. */
  state?: FieldState
  /** Who draws the dropdown list. Default: `auto`. */
  picker?: SelectPicker
}

export type SelectAttributes = {
  class: typeof SELECT_CLASS
  "data-state"?: NonDefaultFieldState
  "data-picker"?: NonDefaultSelectPicker
  "aria-invalid"?: "true"
}

/**
 * The attributes for a dropdown list.
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
