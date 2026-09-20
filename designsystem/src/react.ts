import { accordion } from "./components/css/accordion/accordion.js"
import { alert } from "./components/css/alert/alert.js"
import { avatar } from "./components/css/avatar/avatar.js"
import { badge } from "./components/css/badge/badge.js"
import { breadcrumbs } from "./components/css/breadcrumbs/breadcrumbs.js"
import { button } from "./components/css/button/button.js"
import { card } from "./components/css/card/card.js"
import { checkbox } from "./components/css/checkbox/checkbox.js"
import { dialog } from "./components/css/dialog/dialog.js"
import { divider } from "./components/css/divider/divider.js"
import { errorText } from "./components/css/error-text/error-text.js"
import { fieldset, legend } from "./components/css/fieldset/fieldset.js"
import { fileUpload } from "./components/css/file-upload/file-upload.js"
import { heading } from "./components/css/heading/heading.js"
import { helpText } from "./components/css/help-text/help-text.js"
import { input } from "./components/css/input/input.js"
import { label } from "./components/css/label/label.js"
import { link } from "./components/css/link/link.js"
import { list } from "./components/css/list/list.js"
import { pagination } from "./components/css/pagination/pagination.js"
import { paragraph } from "./components/css/paragraph/paragraph.js"
import { radio } from "./components/css/radio/radio.js"
import { search } from "./components/css/search/search.js"
import { select } from "./components/css/select/select.js"
import {
  fieldStates,
  isFieldState,
  isRequiredMarker,
  requiredMarkers,
} from "./components/css/shared.js"
import { skeleton } from "./components/css/skeleton/skeleton.js"
import { skipLink } from "./components/css/skip-link/skip-link.js"
import { spinner } from "./components/css/spinner/spinner.js"
import { srOnly } from "./components/css/sr-only/sr-only.js"
import { switchControl } from "./components/css/switch/switch.js"
import { table } from "./components/css/table/table.js"
import { tag } from "./components/css/tag/tag.js"
import { textarea } from "./components/css/textarea/textarea.js"
import { toggleGroup } from "./components/css/toggle-group/toggle-group.js"
import { tooltip } from "./components/css/tooltip/tooltip.js"
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
function forReact<Options, Result extends Record<string, unknown>, Extra>(
  fn: ((options?: Options) => Result) & Extra,
): ((options?: Options) => ReactAttributes<Result>) & Extra {
  const wrapped = (options?: Options) => toReactAttributes(fn(options))
  return Object.assign(wrapped, fn)
}

export const fs = {
  accordion: forReact(accordion),
  alert: forReact(alert),
  avatar: forReact(avatar),
  badge: forReact(badge),
  breadcrumbs: forReact(breadcrumbs),
  button: forReact(button),
  card: forReact(card),
  checkbox: forReact(checkbox),
  dialog: forReact(dialog),
  divider: forReact(divider),
  errorText: forReact(errorText),
  fieldset: forReact(fieldset),
  heading: forReact(heading),
  fileUpload: forReact(fileUpload),
  helpText: forReact(helpText),
  input: forReact(input),
  label: forReact(label),
  legend: forReact(legend),
  link: forReact(link),
  list: forReact(list),
  pagination: forReact(pagination),
  paragraph: forReact(paragraph),
  radio: forReact(radio),
  search: forReact(search),
  select: forReact(select),
  skeleton: forReact(skeleton),
  skipLink: forReact(skipLink),
  spinner: forReact(spinner),
  srOnly: forReact(srOnly),
  switch: forReact(switchControl),
  toggleGroup: forReact(toggleGroup),
  tooltip: forReact(tooltip),
  table: forReact(table),
  tag: forReact(tag),
  textarea: forReact(textarea),

  /**
   * Kobler et helt felt, med `className` og `htmlFor` på ledeteksten.
   *
   * `control`, `help` og `error` har ingen nøkler som må døpes om, og er
   * derfor like i begge inngangene.
   */
  field: (options: FieldOptions = {}) => {
    const field = computeFieldAttributes(options)
    return { ...field, label: toReactAttributes(field.label) }
  },

  setAttributes,

  states: fieldStates,
  isState: isFieldState,
  markers: requiredMarkers,
  isMarker: isRequiredMarker,
} as const
