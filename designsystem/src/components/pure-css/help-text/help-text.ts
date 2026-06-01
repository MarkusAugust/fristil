export const HELP_TEXT_CLASS = "ds-help-text" as const

export const helpTextVariants = ["muted", "default", "success", "warning"] as const

export type HelpTextVariant = (typeof helpTextVariants)[number]
export type NonDefaultHelpTextVariant = Exclude<HelpTextVariant, "muted">

export type HelpTextStyleAttributes = {
  class: typeof HELP_TEXT_CLASS
  "data-variant"?: NonDefaultHelpTextVariant
}

export function isHelpTextVariant(value: string): value is HelpTextVariant {
  return (helpTextVariants as readonly string[]).includes(value)
}

/**
 * Returns only the Fristil help-text style attributes.
 * Other HTML attributes (id, aria-*, etc.) are owned by the app.
 */
export function getHelpTextStyleAttributes(
  variant: HelpTextVariant = "muted",
): HelpTextStyleAttributes {
  if (variant === "muted") {
    return { class: HELP_TEXT_CLASS }
  }

  return { class: HELP_TEXT_CLASS, "data-variant": variant }
}
