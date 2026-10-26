import { attributes } from "../shared.js"

export const SWITCH_CLASS = "lt-switch" as const
/** The row that holds the switch and the text next to each other. */
export const SWITCH_ROW_CLASS = "lt-switch-row" as const

export type SwitchOptions = {
  /**
   * The control is disabled. Do not use it to lock the switch while a save
   * is in progress: `disabled` takes focus away from it, and focus does not
   * come back.
   */
  disabled?: boolean
}

export type SwitchAttributes = {
  class: typeof SWITCH_CLASS
  type: "checkbox"
  role: "switch"
  disabled?: true
}

/**
 * The attributes for an on/off switch.
 *
 * The switch is a checkbox with `role="switch"`. Screen readers then
 * announce it as "on" and "off" rather than "checked", while the keyboard
 * and `FormData` work as for a plain checkbox.
 *
 * The switch has no validation state. A choice that is on or off cannot be
 * invalid in itself; if turning it on is required, the requirement belongs
 * in a checkbox with `required`.
 *
 * ```ts
 * <input {...switchControl()} />
 * ```
 */
export const switchControl = Object.assign(
  ({ disabled }: SwitchOptions = {}): SwitchAttributes =>
    attributes({
      class: SWITCH_CLASS,
      type: "checkbox" as const,
      role: "switch" as const,
      disabled: disabled ? (true as const) : undefined,
    }),
  {
    /** The class on the row around the switch and the text. */
    row: SWITCH_ROW_CLASS,
  },
)
