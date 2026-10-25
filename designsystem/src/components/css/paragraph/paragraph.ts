import { attributes, createGuard } from "../shared.js"

export const PARAGRAPH_CLASS = "lt-paragraph" as const

export const paragraphSizes = ["small", "medium", "large"] as const
export const paragraphVariants = ["default", "lead"] as const

export type ParagraphSize = (typeof paragraphSizes)[number]
export type ParagraphVariant = (typeof paragraphVariants)[number]
export type NonDefaultParagraphSize = Exclude<ParagraphSize, "medium">
export type NonDefaultParagraphVariant = Exclude<ParagraphVariant, "default">

export type ParagraphOptions = {
  /** Text size. Default: `medium`. */
  size?: ParagraphSize
  /** `lead` is the introduction right below the heading. Default: `default`. */
  variant?: ParagraphVariant
}

export type ParagraphAttributes = {
  class: typeof PARAGRAPH_CLASS
  "data-size"?: NonDefaultParagraphSize
  "data-variant"?: NonDefaultParagraphVariant
}

/**
 * The attributes for a paragraph.
 *
 * The width is limited to 70 characters. Longer lines make it hard to find
 * the start of the next one, and that is the most common reason a text is
 * hard to read even when the type is large enough.
 *
 * ```ts
 * <p {...paragraph({ variant: "lead" })}>A short summary of what the page is about.</p>
 * ```
 */
export const paragraph = Object.assign(
  ({
    size = "medium",
    variant = "default",
  }: ParagraphOptions = {}): ParagraphAttributes =>
    attributes({
      class: PARAGRAPH_CLASS,
      "data-size": size === "medium" ? undefined : size,
      "data-variant": variant === "default" ? undefined : variant,
    }),
  {
    sizes: paragraphSizes,
    isSize: createGuard(paragraphSizes),
    variants: paragraphVariants,
    isVariant: createGuard(paragraphVariants),
  },
)
