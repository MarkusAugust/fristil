import { attributes } from "../shared.js"

export const LINK_CLASS = "fs-link" as const

export type LinkOptions = {
  /**
   * Lenken er ikke klikkbar ennå. Gir `aria-disabled`, `role="link"` og
   * `tabindex="0"`, så skjermlesere fortsatt finner den som en lenke og kan
   * si fra. `href` må tas bort ved siden av: ellers følger Enter den.
   */
  disabled?: boolean
}

export type LinkAttributes = {
  class: typeof LINK_CLASS
  role?: "link"
  tabindex?: "0"
  "aria-disabled"?: "true"
}

/**
 * Attributtene for en lenke.
 *
 * ```ts
 * <a {...link()} href="/kvittering">Se kvittering</a>
 * <a {...link({ disabled: true })}>Se årsoppgave</a>
 * ```
 *
 * En `<a>` uten `href` er ingen lenke for skjermleseren og står ikke i
 * tabrekkefølgen. `role` og `tabindex` gir den begge tilbake mens den er
 * deaktivert.
 */
export const link = ({ disabled = false }: LinkOptions = {}): LinkAttributes =>
  attributes({
    class: LINK_CLASS,
    role: disabled ? ("link" as const) : undefined,
    tabindex: disabled ? ("0" as const) : undefined,
    "aria-disabled": disabled ? ("true" as const) : undefined,
  })
