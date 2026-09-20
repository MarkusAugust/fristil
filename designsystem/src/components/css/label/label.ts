import {
  attributes,
  createGuard,
  type RequiredMarker,
  requiredMarkers,
} from "../shared.js"

export const LABEL_CLASS = "fs-label" as const

export type { RequiredMarker }
export { requiredMarkers }

export type LabelOptions = {
  /** Marker feltet som påkrevd, med stjerne eller med ordet «(påkrevd)». */
  required?: RequiredMarker
  /** Marker feltet som valgfritt. Velg én av `required` og `optional`. */
  optional?: boolean
  /** Demper teksten når kontrollen er slått av. */
  disabled?: boolean
}

export type LabelAttributes = {
  class: typeof LABEL_CLASS
  "data-required"?: RequiredMarker
  "data-optional"?: ""
  "aria-disabled"?: "true"
}

/**
 * Attributtene for en ledetekst.
 *
 * Markeringen er bare visuell — sett `required` på selve feltet i tillegg,
 * ellers får skjermleseren ikke vite at det må fylles result.
 *
 * ```ts
 * <label {...label({ required: "symbol" })} htmlFor="epost">E-postadresse</label>
 * ```
 */
export const label = Object.assign(
  ({ required, optional, disabled }: LabelOptions = {}): LabelAttributes =>
    attributes({
      class: LABEL_CLASS,
      "data-required": required,
      "data-optional": optional && !required ? ("" as const) : undefined,
      "aria-disabled": disabled ? ("true" as const) : undefined,
    }),
  {
    markers: requiredMarkers,
    isMarker: createGuard(requiredMarkers),
  },
)
