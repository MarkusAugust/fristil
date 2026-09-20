import { attributes, createGuard } from "../shared.js"

export const TAG_CLASS = "fs-tag" as const

export const tagVariants = ["outline", "filled"] as const

export type TagVariant = (typeof tagVariants)[number]
export type NonDefaultTagVariant = Exclude<TagVariant, "outline">

export type TagOptions = {
  /** Omriss eller dempet flate. Standard: `outline`. */
  variant?: TagVariant
  /** Merkelappen kan slås av og på. Bruk bare på en `<button>`. */
  selectable?: boolean
}

export type TagAttributes = {
  class: typeof TAG_CLASS
  "data-variant"?: NonDefaultTagVariant
  "data-selectable"?: ""
}

/**
 * Attributtene for en merkelapp.
 *
 * En merkelapp merker innhold: emneord på en artikkel, valgte filtre over en
 * liste. Sier den hvilken tilstand noe er i, er [Badge](../badge/badge.js)
 * riktig i stedet.
 *
 * `selectable` gir hover og fokusmarkering, men gjør ingenting trykkbart.
 * Elementet må være en `<button>`, og du setter `aria-pressed` selv, siden
 * bare du vet om lappen er valgt.
 *
 * ```ts
 * <button {...tag({ selectable: true })} aria-pressed="true">Bostøtte</button>
 * ```
 */
export const tag = Object.assign(
  ({ variant = "outline", selectable }: TagOptions = {}): TagAttributes =>
    attributes({
      class: TAG_CLASS,
      "data-variant": variant === "outline" ? undefined : variant,
      "data-selectable": selectable ? ("" as const) : undefined,
    }),
  {
    variants: tagVariants,
    isVariant: createGuard(tagVariants),
  },
)
