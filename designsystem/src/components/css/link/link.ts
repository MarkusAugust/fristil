import { attributes } from "../shared.js"

export const LINK_CLASS = "fs-link" as const

export type LinkOptions = {
  /**
   * Lenken er ikke klikkbar ennå. Gir `aria-disabled` framfor å fjerne
   * `href`, slik at skjermlesere fortsatt finner den og kan si fra.
   */
  disabled?: boolean
}

export type LinkAttributes = {
  class: typeof LINK_CLASS
  "aria-disabled"?: "true"
}

/**
 * Attributtene for en lenke.
 *
 * ```ts
 * <a {...link()} href="/kvittering">Se kvittering</a>
 * ```
 */
export const link = ({ disabled = false }: LinkOptions = {}): LinkAttributes =>
  attributes({
    class: LINK_CLASS,
    "aria-disabled": disabled ? ("true" as const) : undefined,
  })
