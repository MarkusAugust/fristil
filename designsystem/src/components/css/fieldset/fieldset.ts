import {
  attributes,
  createGuard,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
  type RequiredMarker,
  requiredMarkers,
} from "../shared.js"

export const FIELDSET_CLASS = "lt-fieldset" as const
export const LEGEND_CLASS = "lt-legend" as const

export type FieldsetOptions = {
  /** Validation state for the whole group. Default: `default`. */
  state?: FieldState
  /** Disables all the controls in the group. */
  disabled?: boolean
}

export type FieldsetAttributes = {
  class: typeof FIELDSET_CLASS
  "data-state"?: NonDefaultFieldState
  disabled?: true
}

export type LegendOptions = {
  /** Marks the group as required, with an asterisk or with the word "(required)". */
  required?: RequiredMarker
  /** Marks the group as optional. Choose one of `required` and `optional`. */
  optional?: boolean
  /** Mutes the text when the group is disabled. */
  disabled?: boolean
}

export type LegendAttributes = {
  class: typeof LEGEND_CLASS
  "data-required"?: RequiredMarker
  "data-optional"?: ""
  "aria-disabled"?: "true"
}

/**
 * The attributes for a group of controls that belong together.
 *
 * `<fieldset>` with `<legend>` is the one way to give a set of radio buttons
 * or checkboxes a shared label that screen readers actually announce before
 * each choice.
 *
 * ```ts
 * <fieldset {...fieldset({ state: "invalid" })}>
 *   <legend {...legend({ required: "symbol" })}>Delivery method</legend>
 * </fieldset>
 * ```
 */
export const fieldset = Object.assign(
  ({ state = "default", disabled }: FieldsetOptions = {}): FieldsetAttributes =>
    attributes({
      class: FIELDSET_CLASS,
      "data-state": state === "default" ? undefined : state,
      disabled: disabled ? (true as const) : undefined,
    }),
  {
    states: fieldStates,
    isState: isFieldState,
  },
)

/**
 * The attributes for the label of a group.
 *
 * The same marker as `label()`, but on a `<legend>`.
 */
export const legend = Object.assign(
  ({ required, optional, disabled }: LegendOptions = {}): LegendAttributes =>
    attributes({
      class: LEGEND_CLASS,
      "data-required": required,
      "data-optional": optional && !required ? ("" as const) : undefined,
      "aria-disabled": disabled ? ("true" as const) : undefined,
    }),
  {
    markers: requiredMarkers,
    isMarker: createGuard(requiredMarkers),
  },
)
