import { badge } from "./components/css/badge/badge.js"
import { button } from "./components/css/button/button.js"
import { errorText } from "./components/css/error-text/error-text.js"
import { helpText } from "./components/css/help-text/help-text.js"
import { input } from "./components/css/input/input.js"
import { label } from "./components/css/label/label.js"
import { link } from "./components/css/link/link.js"
import { select } from "./components/css/select/select.js"
import {
  fieldStates,
  isFieldState,
  isRequiredMarker,
  requiredMarkers,
} from "./components/css/shared.js"
import { textarea } from "./components/css/textarea/textarea.js"
import {
  computeFieldAttributes,
  type FieldOptions,
} from "./components/ramme/field/field-core.js"
import { setAttributes } from "./dom.js"

/**
 * Samme API som `fs`, men med `className` og `htmlFor`.
 *
 * Resten av systemet returnerer `class` og `for`, slik attributtene faktisk
 * heter i HTML. React godtar dem, og de havner riktig i DOM-en, men
 * utviklingsbygget skriver «Invalid DOM property `class`. Did you mean
 * `className`?» i konsollen for hvert element. Med et helt felt blir det to
 * advarsler per felt, og det er ikke en utvikleropplevelse vi kan by på.
 *
 * ```ts
 * import { fs } from "@fristil/designsystem/react"
 *
 * <button {...fs.button({ variant: "secondary" })}>Lagre utkast</button>
 * ```
 *
 * Kallstedene er identiske med resten av systemet; bare importstien er en
 * annen. Dette er ren omdøping av to nøkler, så pakken får ingen
 * avhengighet til React av det.
 *
 * Vue, Svelte, Solid og Preact tar `class` og `for` som de er. Der bruker du
 * `@fristil/designsystem` direkte.
 */

/** Gir nøklene navnene React forventer. */
export type ReactAttributes<T> = {
  [K in keyof T as K extends "class"
    ? "className"
    : K extends "for"
      ? "htmlFor"
      : K]: T[K]
}

export function toReactAttributes<T extends Record<string, unknown>>(
  attributes: T,
): ReactAttributes<T> {
  const result: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(attributes)) {
    result[name === "class" ? "className" : name === "for" ? "htmlFor" : name] =
      value
  }
  return result as ReactAttributes<T>
}

/**
 * Pakker inn en byggefunksjon så returverdien får React-navnene.
 *
 * Signaturen er skrevet som en snitt-type for at TypeScript skal kunne utlede
 * både valgtypen og de ekstra feltene som henger på funksjonen, altså
 * `variants`, `isVariant` og de andre, i samme slengen.
 */
function forReact<Valg, Ut extends Record<string, unknown>, Ekstra>(
  fn: ((valg?: Valg) => Ut) & Ekstra,
): ((valg?: Valg) => ReactAttributes<Ut>) & Ekstra {
  const wrapped = (valg?: Valg) => toReactAttributes(fn(valg))
  return Object.assign(wrapped, fn)
}

export const fs = {
  badge: forReact(badge),
  button: forReact(button),
  errorText: forReact(errorText),
  helpText: forReact(helpText),
  input: forReact(input),
  label: forReact(label),
  link: forReact(link),
  select: forReact(select),
  textarea: forReact(textarea),

  /**
   * Kobler et helt felt, med `className` og `htmlFor` på ledeteksten.
   *
   * `control`, `help` og `error` har ingen nøkler som må døpes om, og er
   * derfor like i begge inngangene.
   */
  field: (options: FieldOptions = {}) => {
    const felt = computeFieldAttributes(options)
    return { ...felt, label: toReactAttributes(felt.label) }
  },

  setAttributes,

  states: fieldStates,
  isState: isFieldState,
  markers: requiredMarkers,
  isMarker: isRequiredMarker,
} as const
