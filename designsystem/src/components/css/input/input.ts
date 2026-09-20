import {
  attributes,
  createGuard,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const INPUT_CLASS = "fs-input" as const

export const inputTypes = [
  "text",
  "password",
  "email",
  "number",
  "date",
  "datetime-local",
  "week",
  "month",
  "tel",
  "url",
  "search",
  "time",
] as const

export type InputType = (typeof inputTypes)[number]

/** Typene som får et ikon i feltet, og som åpner nettleserens egen velger. */
const TYPER_MED_IKON = ["date", "time", "datetime-local"] as const
type TypeMedIkon = (typeof TYPER_MED_IKON)[number]

export type InputOptions = {
  /** HTML-typen. Settes som `type`, og styrer ikonet. Standard: `text`. */
  type?: InputType
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
}

export type InputAttributes = {
  class: typeof INPUT_CLASS
  type: InputType
  "data-variant"?: TypeMedIkon
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * Attributtene for et tekstfelt.
 *
 * `type` setter både HTML-typen og ikonvarianten, så de to kan ikke komme i
 * utakt. Skriver du dem for hånd, er det lett å få et datofelt som ser ut
 * som et datofelt, men der ingenting skjer når brukeren trykker på ikonet.
 *
 * ```ts
 * <input {...input({ type: "date", state: "invalid" })} />
 * ```
 */
export const input = Object.assign(
  ({ type = "text", state = "default" }: InputOptions = {}): InputAttributes =>
    attributes({
      class: INPUT_CLASS,
      type,
      "data-variant": (TYPER_MED_IKON as readonly string[]).includes(type)
        ? (type as TypeMedIkon)
        : undefined,
      "data-state": state === "default" ? undefined : state,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    types: inputTypes,
    isType: createGuard(inputTypes),
    states: fieldStates,
    isState: isFieldState,
  },
)
