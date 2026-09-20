import { attributes, createGuard } from "../shared.js"

export const ERROR_TEXT_CLASS = "fs-error-text" as const

export const errorTextVariants = ["error", "warning"] as const

export type ErrorTextVariant = (typeof errorTextVariants)[number]
export type NonDefaultErrorTextVariant = Exclude<ErrorTextVariant, "error">

export type ErrorTextOptions = {
  /** Om feilen stopper innsending eller bare advarer. Standard: `error`. */
  variant?: ErrorTextVariant
}

export type ErrorTextAttributes = {
  class: typeof ERROR_TEXT_CLASS
  "data-variant"?: NonDefaultErrorTextVariant
}

/**
 * Attributtene for en feilmelding under et felt.
 *
 * ```ts
 * <p {...errorText({ variant: "warning" })}>…</p>
 * ```
 */
export const errorText = Object.assign(
  ({ variant = "error" }: ErrorTextOptions = {}): ErrorTextAttributes =>
    attributes({
      class: ERROR_TEXT_CLASS,
      "data-variant": variant === "error" ? undefined : variant,
    }),
  {
    variants: errorTextVariants,
    isVariant: createGuard(errorTextVariants),
  },
)
