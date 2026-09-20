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

/**
 * Samme API som `fs`, men med `className` og `htmlFor`.
 *
 * Resten av systemet returnerer `class` og `for`, slik attributtene faktisk
 * heter i HTML. React godtar dem — de havner riktig i DOM-en — men
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
 * annen. Dette er ren omdøping av to nøkler — pakken får ingen avhengighet
 * til React av det.
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

export function tilReactAttributter<T extends Record<string, unknown>>(
  attributter: T,
): ReactAttributes<T> {
  const ut: Record<string, unknown> = {}
  for (const [navn, verdi] of Object.entries(attributter)) {
    ut[navn === "class" ? "className" : navn === "for" ? "htmlFor" : navn] =
      verdi
  }
  return ut as ReactAttributes<T>
}

/**
 * Pakker inn en byggefunksjon så returverdien får React-navnene.
 *
 * Signaturen er skrevet som en snitt-type for at TypeScript skal kunne utlede
 * både valgtypen og de ekstra feltene — `variants`, `isVariant` og de andre
 * som henger på funksjonen — i samme slengen.
 */
function forReact<Valg, Ut extends Record<string, unknown>, Ekstra>(
  fn: ((valg?: Valg) => Ut) & Ekstra,
): ((valg?: Valg) => ReactAttributes<Ut>) & Ekstra {
  const innpakket = (valg?: Valg) => tilReactAttributter(fn(valg))
  return Object.assign(innpakket, fn)
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
    return { ...felt, label: tilReactAttributter(felt.label) }
  },

  states: fieldStates,
  isState: isFieldState,
  markers: requiredMarkers,
  isMarker: isRequiredMarker,
} as const
