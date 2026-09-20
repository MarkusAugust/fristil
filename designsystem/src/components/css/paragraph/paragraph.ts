import { attributes, createGuard } from "../shared.js"

export const PARAGRAPH_CLASS = "fs-paragraph" as const

export const paragraphSizes = ["small", "medium", "large"] as const
export const paragraphVariants = ["default", "lead"] as const

export type ParagraphSize = (typeof paragraphSizes)[number]
export type ParagraphVariant = (typeof paragraphVariants)[number]
export type NonDefaultParagraphSize = Exclude<ParagraphSize, "medium">
export type NonDefaultParagraphVariant = Exclude<ParagraphVariant, "default">

export type ParagraphOptions = {
  /** Tekststørrelse. Standard: `medium`. */
  size?: ParagraphSize
  /** `lead` er ingressen rett under overskriften. Standard: `default`. */
  variant?: ParagraphVariant
}

export type ParagraphAttributes = {
  class: typeof PARAGRAPH_CLASS
  "data-size"?: NonDefaultParagraphSize
  "data-variant"?: NonDefaultParagraphVariant
}

/**
 * Attributtene for et avsnitt.
 *
 * Bredden er begrenset til 70 tegn. Lengre linjer gjør det vanskelig å finne
 * tilbake til starten av neste, og det er den vanligste grunnen til at en
 * tekst er tung å lese selv når skriften er stor nok.
 *
 * ```ts
 * <p {...paragraph({ variant: "lead" })}>Kort om hva siden handler om.</p>
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
