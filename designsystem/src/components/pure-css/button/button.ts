export const BUTTON_CLASS = "ds-button" as const

export const buttonVariants = ["primary", "secondary", "ghost", "danger"] as const

export type ButtonVariant = (typeof buttonVariants)[number]
export type NonPrimaryButtonVariant = Exclude<ButtonVariant, "primary">

export type ButtonStyleAttributes = {
  class: typeof BUTTON_CLASS
  "data-variant"?: NonPrimaryButtonVariant
}

export function isButtonVariant(value: string): value is ButtonVariant {
  return (buttonVariants as readonly string[]).includes(value)
}

/**
 * Returns only the Fristil button style attributes.
 * Other HTML attributes (id, aria-*, disabled, etc.) are owned by the app.
 */
export function getButtonStyleAttributes(
  variant: ButtonVariant = "primary",
): ButtonStyleAttributes {
  if (variant === "primary") {
    return { class: BUTTON_CLASS }
  }

  return { class: BUTTON_CLASS, "data-variant": variant }
}
