import { accordion } from "./components/css/accordion/accordion.js"
import { alert } from "./components/css/alert/alert.js"
import { avatar } from "./components/css/avatar/avatar.js"
import { badge } from "./components/css/badge/badge.js"
import { breadcrumbs } from "./components/css/breadcrumbs/breadcrumbs.js"
import { button } from "./components/css/button/button.js"
import { card } from "./components/css/card/card.js"
import { checkbox } from "./components/css/checkbox/checkbox.js"
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
import { connectionStatus } from "./components/frittstaende/connection-status/connection-status.js"
import { sessionTimeout } from "./components/frittstaende/session-timeout/session-timeout.js"
import { toast } from "./components/frittstaende/toast/toast.js"
import { dialog } from "./components/ramme/dialog/dialog.js"
import { errorSummary } from "./components/ramme/error-summary/error-summary.js"
import {
  computeFieldAttributes,
  createFieldId,
  type FieldOptions,
} from "./components/ramme/field/field-core.js"
import { popover } from "./components/ramme/popover/popover.js"
import { suggestion } from "./components/ramme/suggestion/suggestion.js"
import { tabs } from "./components/ramme/tabs/tabs.js"
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

/**
 * Gir nøklene navnene React forventer, og verdiene typene React forventer.
 *
 * `tabindex` er ikke bare et annet navn: i HTML er verdien en streng, og i
 * React er `tabIndex` et tall. Lot vi strengen stå, kom `fs.tabs()` ut med
 * `tabIndex: "0"`, og TypeScript avviste den i enhver React-app. Den virket
 * i nettleseren, siden React gjør om verdien selv, så feilen viste seg bare
 * som en typefeil hos konsumenten.
 */
export type ReactAttributes<T> = {
  [K in keyof T as K extends "class"
    ? "className"
    : K extends "for"
      ? "htmlFor"
      : K extends "tabindex"
        ? "tabIndex"
        : K extends "autocomplete"
          ? "autoComplete"
          : K]: K extends "tabindex" ? number : T[K]
}

/**
 * Attributtene som heter noe annet i React.
 *
 * `tabindex` kom med de sammensatte byggefunksjonene, og `autocomplete` med
 * forslagsfeltet. Uten omdøpingen advarer React om hver eneste av dem.
 *
 * `aria-*` og `data-*` skal derimot stå som de er. React sender dem videre
 * uendret, og en omdøping ville gitt ugyldige attributter.
 *
 * `react.browser.test.ts` kaller hver byggefunksjon her med hver lovlige
 * verdi den selv oppgir, samler alle attributtnavn i svaret, også de som
 * ligger i lister og undernivåer, og avviser hvert navn React staver
 * annerledes. Lista der er Reacts egen og er lengre enn de fire vi døper om,
 * så en byggefunksjon som en dag sender ut `readonly` eller `maxlength`
 * stopper der og ikke i konsollen hos en konsument.
 */
const NAVN: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  autocomplete: "autoComplete",
}

export function toReactAttributes<T extends Record<string, unknown>>(
  attributes: T,
): ReactAttributes<T> {
  const result: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(attributes)) {
    // `tabindex` er en streng i HTML og et tall i React. Alt annet går rett
    // gjennom: det er navnene som er ulike, ikke verdiene.
    result[NAVN[name] ?? name] = name === "tabindex" ? Number(value) : value
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

/**
 * Videreeksportert fra hovedinngangen.
 *
 * `field.mdx` peker på den i en seksjon som ber leseren importere fra
 * `@fristil/designsystem/react`, og uten dette får en React-konsument som
 * følger rådet «createFieldId is not exported». Den er trygg bare når
 * markupen rendres én gang; i en React-komponent er `useId()` svaret, også i
 * en app uten server.
 */
export { createFieldId }

export const fs = {
  accordion: forReact(accordion),
  alert: forReact(alert),
  avatar: forReact(avatar),
  badge: forReact(badge),
  breadcrumbs: forReact(breadcrumbs),
  button: forReact(button),
  card: forReact(card),
  checkbox: forReact(checkbox),
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
  field: (options: FieldOptions) => {
    const field = computeFieldAttributes(options)
    return { ...field, label: toReactAttributes(field.label) }
  },

  /**
   * De sammensatte byggerne gir ett attributtsett per element, og hvert sett
   * må døpes om for seg. `host` har `tabindex`, fanene har både
   * `tabindex` og `class`.
   */
  errorSummary: (options: Parameters<typeof errorSummary>[0] = {}) => {
    const boks = errorSummary(options)
    return {
      host: toReactAttributes(boks.host),
      title: toReactAttributes(boks.title),
    }
  },

  dialog: Object.assign(
    (options: Parameters<typeof dialog>[0]) => {
      const boks = dialog(options)
      return {
        host: boks.host,
        dialog: toReactAttributes(boks.dialog),
        title: toReactAttributes(boks.title),
        body: toReactAttributes(boks.body),
        footer: toReactAttributes(boks.footer),
      }
    },
    {
      dialog: dialog.dialog,
      title: dialog.title,
      body: dialog.body,
      footer: dialog.footer,
    },
  ),

  popover: (options: Parameters<typeof popover>[0]) => {
    const boks = popover(options)
    return {
      host: boks.host,
      trigger: toReactAttributes(boks.trigger),
      panel: toReactAttributes(boks.panel),
    }
  },

  tabs: (options: Parameters<typeof tabs>[0]) => {
    const faner = tabs(options)
    return {
      list: toReactAttributes(faner.list),
      tabs: faner.tabs.map(toReactAttributes),
      panels: faner.panels.map(toReactAttributes),
    }
  },

  suggestion: (options: Parameters<typeof suggestion>[0]) => {
    const forslag = suggestion(options)
    return {
      ...forslag,
      label: toReactAttributes(forslag.label),
      field: toReactAttributes(forslag.field),
      control: toReactAttributes(forslag.control),
      list: toReactAttributes(forslag.list),
      options: forslag.options.map(toReactAttributes),
      empty: toReactAttributes(forslag.empty),
      status: toReactAttributes(forslag.status),
    }
  },

  toast: (options: Parameters<typeof toast>[0] = {}) => {
    const varsler = toast(options)
    return {
      host: varsler.host,
      toast: toReactAttributes(varsler.toast),
      close: toReactAttributes(varsler.close),
    }
  },

  sessionTimeout: forReact(sessionTimeout),
  connectionStatus: forReact(connectionStatus),

  setAttributes,

  states: fieldStates,
  isState: isFieldState,
  markers: requiredMarkers,
  isMarker: isRequiredMarker,
} as const
