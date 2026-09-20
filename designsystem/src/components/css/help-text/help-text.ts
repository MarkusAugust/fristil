import { attributter, lagVakt } from "../shared.js"

export const HELP_TEXT_CLASS = "fs-help-text" as const

export const helpTextVariants = [
  "muted",
  "default",
  "success",
  "warning",
] as const

export type HelpTextVariant = (typeof helpTextVariants)[number]
export type NonDefaultHelpTextVariant = Exclude<HelpTextVariant, "muted">

export type HelpTextOptions = {
  /** Hvor mye teksten skal rope. Standard: `muted`. */
  variant?: HelpTextVariant
}

export type HelpTextAttributes = {
  class: typeof HELP_TEXT_CLASS
  "data-variant"?: NonDefaultHelpTextVariant
}

/**
 * Attributtene for hjelpetekst under et felt.
 *
 * ```ts
 * <p {...helpText({ variant: "warning" })}>…</p>
 * ```
 */
export const helpText = Object.assign(
  ({ variant = "muted" }: HelpTextOptions = {}): HelpTextAttributes =>
    attributter({
      class: HELP_TEXT_CLASS,
      "data-variant": variant === "muted" ? undefined : variant,
    }),
  {
    variants: helpTextVariants,
    isVariant: lagVakt(helpTextVariants),
  },
)
