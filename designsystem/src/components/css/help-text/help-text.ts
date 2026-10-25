import { attributes, createGuard } from "../shared.js"

export const HELP_TEXT_CLASS = "lt-help-text" as const

export const helpTextVariants = [
  "muted",
  "strong",
  "success",
  "warning",
] as const

export type HelpTextVariant = (typeof helpTextVariants)[number]
export type NonDefaultHelpTextVariant = Exclude<HelpTextVariant, "muted">

export type HelpTextOptions = {
  /** How loudly the text should speak. Default: `muted`. */
  variant?: HelpTextVariant
}

export type HelpTextAttributes = {
  class: typeof HELP_TEXT_CLASS
  "data-variant"?: NonDefaultHelpTextVariant
}

/**
 * The attributes for help text below a field.
 *
 * ```ts
 * <p {...helpText({ variant: "warning" })}>…</p>
 * ```
 */
export const helpText = Object.assign(
  ({ variant = "muted" }: HelpTextOptions = {}): HelpTextAttributes =>
    attributes({
      class: HELP_TEXT_CLASS,
      "data-variant": variant === "muted" ? undefined : variant,
    }),
  {
    variants: helpTextVariants,
    isVariant: createGuard(helpTextVariants),
  },
)
