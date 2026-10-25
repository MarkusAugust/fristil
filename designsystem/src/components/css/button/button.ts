import { attributes, createGuard } from "../shared.js"

export const BUTTON_CLASS = "lt-button" as const

export const buttonVariants = [
  "primary",
  "secondary",
  "ghost",
  "danger",
] as const

export type ButtonVariant = (typeof buttonVariants)[number]
export type NonPrimaryButtonVariant = Exclude<ButtonVariant, "primary">

export type ButtonOptions = {
  /** How weighty the action is. Default: `primary`. */
  variant?: ButtonVariant
}

export type ButtonAttributes = {
  class: typeof BUTTON_CLASS
  "data-variant"?: NonPrimaryButtonVariant
}

/**
 * The attributes for a button.
 *
 * ```ts
 * <button {...button({ variant: "secondary" })}>Save draft</button>
 * ```
 */
export const button = Object.assign(
  ({ variant = "primary" }: ButtonOptions = {}): ButtonAttributes =>
    attributes({
      class: BUTTON_CLASS,
      "data-variant": variant === "primary" ? undefined : variant,
    }),
  {
    /** The valid variants, for lookup and branching. */
    variants: buttonVariants,
    /** Checks whether a string from outside is a valid variant. */
    isVariant: createGuard(buttonVariants),
  },
)
