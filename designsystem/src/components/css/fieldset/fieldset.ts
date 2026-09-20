import {
  attributes,
  createGuard,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
  type RequiredMarker,
  requiredMarkers,
} from "../shared.js"

export const FIELDSET_CLASS = "fs-fieldset" as const
export const LEGEND_CLASS = "fs-legend" as const

export type FieldsetOptions = {
  /** Valideringstilstand for hele gruppen. Standard: `default`. */
  state?: FieldState
  /** Slår av alle kontrollene i gruppen. */
  disabled?: boolean
}

export type FieldsetAttributes = {
  class: typeof FIELDSET_CLASS
  "data-state"?: NonDefaultFieldState
  disabled?: true
}

export type LegendOptions = {
  /** Marker gruppen som påkrevd, med stjerne eller med ordet «(påkrevd)». */
  required?: RequiredMarker
  /** Marker gruppen som valgfri. Velg én av `required` og `optional`. */
  optional?: boolean
  /** Demper teksten når gruppen er slått av. */
  disabled?: boolean
}

export type LegendAttributes = {
  class: typeof LEGEND_CLASS
  "data-required"?: RequiredMarker
  "data-optional"?: ""
  "aria-disabled"?: "true"
}

/**
 * Attributtene for en gruppe med kontroller som hører sammen.
 *
 * `<fieldset>` med `<legend>` er den ene måten å gi et sett radioknapper eller
 * avkryssingsbokser en felles ledetekst som skjermlesere faktisk leser opp
 * før hvert valg.
 *
 * ```ts
 * <fieldset {...fieldset({ state: "invalid" })}>
 *   <legend {...legend({ required: "symbol" })}>Leveringsmåte</legend>
 * </fieldset>
 * ```
 */
export const fieldset = Object.assign(
  ({ state = "default", disabled }: FieldsetOptions = {}): FieldsetAttributes =>
    attributes({
      class: FIELDSET_CLASS,
      "data-state": state === "default" ? undefined : state,
      disabled: disabled ? (true as const) : undefined,
    }),
  {
    states: fieldStates,
    isState: isFieldState,
  },
)

/**
 * Attributtene for ledeteksten på en gruppe.
 *
 * Samme markering som `label()`, men på et `<legend>`.
 */
export const legend = Object.assign(
  ({ required, optional, disabled }: LegendOptions = {}): LegendAttributes =>
    attributes({
      class: LEGEND_CLASS,
      "data-required": required,
      "data-optional": optional && !required ? ("" as const) : undefined,
      "aria-disabled": disabled ? ("true" as const) : undefined,
    }),
  {
    markers: requiredMarkers,
    isMarker: createGuard(requiredMarkers),
  },
)
