export const INPUT_CLASS = "fs-input" as const

export const inputStates = ["default", "invalid", "success"] as const
export const inputVariants = [
  "text",
  "password",
  "email",
  "number",
  "date",
  "datetime-local",
  "week",
  "month",
  "tel",
  "url",
  "search",
  "time",
] as const

export type InputState = (typeof inputStates)[number]
export type NonDefaultInputState = Exclude<InputState, "default">
export type InputVariant = (typeof inputVariants)[number]
export type NonTextInputVariant = Exclude<InputVariant, "text">

export type InputStyleAttributes = {
  class: typeof INPUT_CLASS
  "data-state"?: NonDefaultInputState
  "data-variant"?: NonTextInputVariant
}

export type InputAttributes = InputStyleAttributes & {
  type: InputVariant
}

export function isInputState(value: string): value is InputState {
  return (inputStates as readonly string[]).includes(value)
}

export function isInputVariant(value: string): value is InputVariant {
  return (inputVariants as readonly string[]).includes(value)
}

export type InputStyleOptions = {
  state?: InputState
  variant?: InputVariant
}

/**
 * Returns only the Fristil input style attributes.
 * Other HTML attributes (id, type, aria-*, disabled, etc.) are owned by the app.
 */
export function getInputStyleAttributes(
  input: InputState | InputStyleOptions = "default",
): InputStyleAttributes {
  const state = typeof input === "string" ? input : (input.state ?? "default")
  const variant = typeof input === "string" ? "text" : (input.variant ?? "text")

  const attrs: InputStyleAttributes = { class: INPUT_CLASS }

  if (state !== "default") {
    attrs["data-state"] = state
  }

  if (variant !== "text") {
    attrs["data-variant"] = variant
  }

  return attrs
}

/**
 * Returns Fristil style attributes plus native input type.
 */
export function getInputAttributes(
  options: InputStyleOptions = {},
): InputAttributes {
  const variant = options.variant ?? "text"
  return {
    ...getInputStyleAttributes(options),
    type: variant,
  }
}
