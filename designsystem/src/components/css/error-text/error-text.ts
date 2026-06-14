export const ERROR_TEXT_CLASS = "ds-error-text" as const

export const errorTextVariants = ["error", "warning"] as const

export type ErrorTextVariant = (typeof errorTextVariants)[number]
export type NonDefaultErrorTextVariant = Exclude<ErrorTextVariant, "error">

export type ErrorTextStyleAttributes = {
  class: typeof ERROR_TEXT_CLASS
  "data-variant"?: NonDefaultErrorTextVariant
}

export function isErrorTextVariant(value: string): value is ErrorTextVariant {
  return (errorTextVariants as readonly string[]).includes(value)
}

/**
 * Returns only the Fristil error-text style attributes.
 * Other HTML attributes (id, aria-*, etc.) are owned by the app.
 */
export function getErrorTextStyleAttributes(
  variant: ErrorTextVariant = "error",
): ErrorTextStyleAttributes {
  if (variant === "error") {
    return { class: ERROR_TEXT_CLASS }
  }

  return { class: ERROR_TEXT_CLASS, "data-variant": variant }
}
