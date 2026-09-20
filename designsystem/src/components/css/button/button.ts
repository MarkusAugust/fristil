import { attributes, createGuard } from "../shared.js"

export const BUTTON_CLASS = "fs-button" as const

export const buttonVariants = [
  "primary",
  "secondary",
  "ghost",
  "danger",
] as const

export type ButtonVariant = (typeof buttonVariants)[number]
export type NonPrimaryButtonVariant = Exclude<ButtonVariant, "primary">

export type ButtonOptions = {
  /** Hvor tung handlingen er. Standard: `primary`. */
  variant?: ButtonVariant
}

export type ButtonAttributes = {
  class: typeof BUTTON_CLASS
  "data-variant"?: NonPrimaryButtonVariant
}

/**
 * Attributtene for en knapp.
 *
 * ```ts
 * <button {...button({ variant: "secondary" })}>Lagre utkast</button>
 * ```
 */
export const button = Object.assign(
  ({ variant = "primary" }: ButtonOptions = {}): ButtonAttributes =>
    attributes({
      class: BUTTON_CLASS,
      "data-variant": variant === "primary" ? undefined : variant,
    }),
  {
    /** De allowed variantene, for oppslag og forgrening. */
    variants: buttonVariants,
    /** Sjekker om en streng utenfra er en gyldig variant. */
    isVariant: createGuard(buttonVariants),
  },
)
