import type { FieldState, RequiredMarker } from "../../css/shared.js"
import { attributes, createFieldId, idEllerReserve } from "../../css/shared.js"

// Videreeksportert her, der den hørte hjemme før, så konsumenter som
// importerer fra `./field-core` ikke merker flyttingen.
export { createFieldId }

/**
 * Regner ut koblingen mellom ledetekst, felt, hjelpetekst og feilmelding.
 *
 * Dette er den ene implementasjonen av tilgjengelighetskontrakten i systemet.
 * `<fs-field>` bruker den på elementer som allerede står i DOM-en, og
 * `fs.field()` gir den samme utregningen som data, til den som skriver
 * markupen med JavaScript. Uten delingen ville kontrakten finnes to steder og kunne gå
 * fra hverandre.
 */

export type FieldOptions = {
  /**
   * Id på kontrollen. Påkrevd.
   *
   * I React kommer den fra `useId()`. Ellers er feltets eget navn som regel
   * det opplagte valget. Vet du sikkert at markupen rendres én gang, kall
   * `createFieldId()` selv.
   *
   * Den var valgfri, og funksjonen laget en når den manglet. Id-en er
   * tilfeldig, så to kjøringer gir to ulike, og rendres det samme feltet på
   * en server og så i nettleseren, peker `for` og `aria-describedby` på noe
   * annet enn det som står der. React melder avvik ved hydreringen, og
   * advarselen sier selv at avviket ikke blir rettet opp.
   *
   * Kravet står i typen, og det er ikke nok alene: en konsument uten
   * TypeScript ser ingen type. Utelates id-en likevel, lager funksjonen en og
   * sier fra i konsollen. Da virker feltet, og utvikleren får vite hvorfor
   * han likevel bør oppgi id-en. Uten reserven fikk han `for=""`,
   * `aria-describedby="undefined-help"` og ingen kobling i det hele tatt,
   * altså verre enn den ustabile id-en kravet skulle bli kvitt.
   */
  id: string
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

export function computeFieldAttributes(options: FieldOptions): FieldAttributes {
  const {
    id: oppgittId,
    help = false,
    error = false,
    required,
    optional,
    invalid = false,
    disabled = false,
    describedBy = [],
  } = options

  // Reserven gjelder bare den som ikke har en typesjekk. Se `idEllerReserve`.
  const id = idEllerReserve("fs.field()", oppgittId)
  const helpId = options.helpId ?? `${id}-help`
  const errorId = options.errorId ?? `${id}-error`

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
