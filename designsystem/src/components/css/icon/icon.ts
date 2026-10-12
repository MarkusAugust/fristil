import { attributes } from "../shared.js"

export const ICON_CLASS = "fs-icon" as const

export type IconOptions = {
  /**
   * Hva ikonet betyr, når det står alene og betyr noe, som et varseltegn uten
   * tekst ved siden av. Blir `aria-label` med `role="img"`. Uten det er
   * ikonet pynt, og skjules for skjermlesere.
   */
  label?: string
}

export type IconAttributes = {
  class: typeof ICON_CLASS
  role?: "img"
  "aria-label"?: string
  "aria-hidden"?: "true"
}

/**
 * Attributtene for et ikon. Klassen hører på en `<svg>`, og svg-en kommer fra
 * appens eget ikonsett: Fristil sender ingen ikoner.
 *
 * Ikonet er like stort som teksten rundt, og tegnes i fargen svg-en sier,
 * som bør være `currentColor`. Uten `label` er det pynt, og står det alene i
 * en knapp, må knappen få navnet sitt et annet sted: `aria-label` på knappen,
 * eller en tekst med `fs-sr-only`. Kjernen sier fra om en knapp som mangler
 * det.
 *
 * ```ts
 * <button {...button()} aria-label="Slett søknaden">
 *   <svg {...icon()} viewBox="0 0 24 24">…</svg>
 * </button>
 * ```
 */
export const icon = ({ label }: IconOptions = {}): IconAttributes =>
  attributes({
    class: ICON_CLASS,
    role: label ? ("img" as const) : undefined,
    "aria-label": label || undefined,
    "aria-hidden": label ? undefined : ("true" as const),
  })
