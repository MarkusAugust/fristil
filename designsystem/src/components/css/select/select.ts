export const SELECT_CLASS = "fs-select" as const

export const selectStates = ["default", "invalid", "success"] as const

export type SelectState = (typeof selectStates)[number]
export type NonDefaultSelectState = Exclude<SelectState, "default">

export type SelectStyleAttributes = {
  class: typeof SELECT_CLASS
  "data-state"?: NonDefaultSelectState
}

export function isSelectState(value: string): value is SelectState {
  return (selectStates as readonly string[]).includes(value)
}

/**
 * Returns only the Fristil select style attributes.
 * Other HTML attributes (id, multiple, aria-*, disabled, etc.) are owned by the app.
 */
export function getSelectStyleAttributes(
  state: SelectState = "default",
): SelectStyleAttributes {
  if (state === "default") {
    return { class: SELECT_CLASS }
  }

  return { class: SELECT_CLASS, "data-state": state }
}
