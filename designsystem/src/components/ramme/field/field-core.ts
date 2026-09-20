import type { FieldState, RequiredMarker } from "../../css/shared.js"
import { attributes } from "../../css/shared.js"

/**
 * Regner ut koblingen mellom ledetekst, felt, hjelpetekst og feilmelding.
 *
 * Dette er den ene implementasjonen av tilgjengelighetskontrakten i systemet.
 * `<fs-field>` bruker den på elementer som allerede står i DOM-en, og
 * `fs.field()` gir den samme utregningen som data til den som vil eie
 * markupen selv. Uten delingen ville kontrakten finnes to steder og kunne gå
 * fra hverandre.
 */

export type FieldOptions = {
  /** Id på kontrollen. Lages automatisk hvis den utelates. */
  id?: string
  /** Feltet har en hjelpetekst som skal kobles med `aria-describedby`. */
  help?: boolean
  /** Feltet har en feilmelding. Den skjules til feltet er ugyldig. */
  error?: boolean
  /** Egen id på hjelpeteksten. Utledes fra `id` hvis den utelates. */
  helpId?: string
  /** Egen id på feilmeldingen. Utledes fra `id` hvis den utelates. */
  errorId?: string
  /** Marker ledeteksten som påkrevd. */
  required?: RequiredMarker
  /** Marker ledeteksten som valgfri. */
  optional?: boolean
  /** Feltet er ugyldig: viser feilmeldingen og setter `aria-invalid`. */
  invalid?: boolean
  /** Kontrollen er slått av. */
  disabled?: boolean
  /** Ekstra id-er som skal med i `aria-describedby`. */
  describedBy?: string[]
}

export type FieldAttributes = {
  label: {
    class: "fs-label"
    for: string
    "data-required"?: RequiredMarker
    "data-optional"?: ""
    "aria-disabled"?: "true"
  }
  control: {
    id: string
    "aria-describedby"?: string
    "aria-invalid"?: "true"
    "data-state"?: "invalid"
    disabled?: true
  }
  help: { id: string }
  error: { id: string; hidden?: true }
  /** Tilstanden kontrollen skal ha, til `input()`, `textarea()` og `select()`. */
  state: FieldState
}

let counter = 0

/** Lager en id som er unik innenfor dokumentet. */
export function createFieldId(): string {
  counter += 1
  return `fs-field-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Setter sammen `aria-describedby` av hjelpetekst, feilmelding og det
 * kalleren har lagt til selv.
 *
 * Feilmeldingen tas bare med når feltet faktisk er ugyldig. Ellers ville
 * `aria-describedby` pekt på et skjult element, og skjermlesere melder da
 * enten ingenting eller noe som ikke står på skjermen.
 */
export function joinDescribedBy(
  ids: Array<string | undefined | false>,
): string | undefined {
  const unique = new Set<string>()
  for (const id of ids) {
    if (!id) continue
    for (const part of id.split(/\s+/)) {
      if (part) unique.add(part)
    }
  }
  return unique.size > 0 ? [...unique].join(" ") : undefined
}

export function computeFieldAttributes(
  options: FieldOptions = {},
): FieldAttributes {
  const {
    id = createFieldId(),
    help = false,
    error = false,
    required,
    optional,
    invalid = false,
    disabled = false,
    describedBy = [],
    helpId = `${id}-help`,
    errorId = `${id}-error`,
  } = options

  return {
    label: attributes({
      class: "fs-label" as const,
      for: id,
      "data-required": required,
      "data-optional": optional && !required ? ("" as const) : undefined,
      "aria-disabled": disabled ? ("true" as const) : undefined,
    }),
    control: attributes({
      id,
      "aria-describedby": joinDescribedBy([
        help && helpId,
        invalid && error && errorId,
        ...describedBy,
      ]),
      "aria-invalid": invalid ? ("true" as const) : undefined,
      // Fargen følger med her, ikke fra input()/textarea()/select(). Ellers
      // ville begge satt aria-invalid, og i maler som skriver ut attributtene
      // bokstavelig, som Astro og ren HTML, ble de stående dobbelt.
      "data-state": invalid ? ("invalid" as const) : undefined,
      disabled: disabled ? (true as const) : undefined,
    }),
    help: { id: helpId },
    error: attributes({
      id: errorId,
      hidden: invalid ? undefined : (true as const),
    }),
    state: invalid ? "invalid" : "default",
  }
}
