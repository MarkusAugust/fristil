import { attributes } from "../shared.js"

export const SWITCH_CLASS = "fs-switch" as const
/** Raden som holder bryteren og teksten ved siden av hverandre. */
export const SWITCH_ROW_CLASS = "fs-switch-row" as const

export type SwitchOptions = {
  /** Kontrollen er slått av. */
  disabled?: boolean
}

export type SwitchAttributes = {
  class: typeof SWITCH_CLASS
  type: "checkbox"
  role: "switch"
  disabled?: true
}

/**
 * Attributtene for en av- og på-bryter.
 *
 * Bryteren er en avkryssingsboks med `role="switch"`. Da leser skjermlesere
 * den opp som «på» og «av» framfor «avkrysset», mens tastaturet og
 * `FormData` virker som for en vanlig boks.
 *
 * Bryteren har ingen valideringstilstand. Et valg som er på eller av kan ikke
 * være ugyldig i seg selv; er det påkrevd å slå den på, hører kravet hjemme i
 * en avkryssingsboks med `required`.
 *
 * ```ts
 * <input {...switchControl()} />
 * ```
 */
export const switchControl = Object.assign(
  ({ disabled }: SwitchOptions = {}): SwitchAttributes =>
    attributes({
      class: SWITCH_CLASS,
      type: "checkbox" as const,
      role: "switch" as const,
      disabled: disabled ? (true as const) : undefined,
    }),
  {
    /** Klassen på raden rundt bryteren og teksten. */
    row: SWITCH_ROW_CLASS,
  },
)
