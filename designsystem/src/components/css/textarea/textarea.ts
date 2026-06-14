export const TEXTAREA_CLASS = "ds-textarea" as const

export const textareaStates = ["default", "invalid", "success"] as const

export type TextareaState = (typeof textareaStates)[number]
export type NonDefaultTextareaState = Exclude<TextareaState, "default">

export type TextareaStyleAttributes = {
  class: typeof TEXTAREA_CLASS
  "data-state"?: NonDefaultTextareaState
}

export function isTextareaState(value: string): value is TextareaState {
  return (textareaStates as readonly string[]).includes(value)
}

/**
 * Returns only the Fristil textarea style attributes.
 * Other HTML attributes (id, rows, aria-*, disabled, etc.) are owned by the app.
 */
export function getTextareaStyleAttributes(
  state: TextareaState = "default",
): TextareaStyleAttributes {
  if (state === "default") {
    return { class: TEXTAREA_CLASS }
  }

  return { class: TEXTAREA_CLASS, "data-state": state }
}
