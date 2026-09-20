import { attributes, createGuard } from "../shared.js"

export const DIVIDER_CLASS = "fs-divider" as const

export const dividerVariants = ["default", "subtle", "strong"] as const

export type DividerVariant = (typeof dividerVariants)[number]
export type NonDefaultDividerVariant = Exclude<DividerVariant, "default">

export type DividerOptions = {
  /** Hvor tydelig streken er. Standard: `default`. */
  variant?: DividerVariant
}

export type DividerAttributes = {
  class: typeof DIVIDER_CLASS
  "data-variant"?: NonDefaultDividerVariant
}

/**
 * Attributtene for en skillelinje.
 *
 * Klassen hører på et `<hr>`. Skiller streken to deler av innholdet, er den
 * en opplysning skjermlesere skal få. Er den bare pynt mellom to bokser som
 * allerede er atskilt, sett `aria-hidden="true"` på den.
 *
 * ```ts
 * <hr {...divider({ variant: "subtle" })} />
 * ```
 */
export const divider = Object.assign(
  ({ variant = "default" }: DividerOptions = {}): DividerAttributes =>
    attributes({
      class: DIVIDER_CLASS,
      "data-variant": variant === "default" ? undefined : variant,
    }),
  {
    variants: dividerVariants,
    isVariant: createGuard(dividerVariants),
  },
)
