import { attributes, checkedKeys, idOrFallback } from "../../css/shared.js"
import {
  computeFieldAttributes,
  type FieldOptions,
} from "../field/field-core.js"

export const SUGGESTION_CLASS = "fs-suggestion" as const
export const SUGGESTION_LIST_CLASS = "fs-suggestion__list" as const
export const SUGGESTION_OPTION_CLASS = "fs-suggestion__option" as const
export const SUGGESTION_EMPTY_CLASS = "fs-suggestion__empty" as const
export const SUGGESTION_VALUE_CLASS = "fs-suggestion__value" as const
export const SUGGESTION_STATUS_CLASS = "fs-sr-only" as const

export type SuggestionOptions = Omit<FieldOptions, "id"> & {
  /**
   * Felles id-stamme. Kontrollen blir `${id}`, lista `${id}-list`, og
   * alternativene `${id}-option-${nøkkel}`.
   */
  id: string
  /**
   * Én nøkkel per alternativ serveren sender med, fra dataene, som
   * kommunenummeret. Nøkkelen gir alternativet id, så en oppdatering som
   * sender lista på nytt, kjenner alternativene igjen. Tom nøkkel,
   * mellomrom og to like kaster. Standard: ingen alternativer.
   */
  keys?: string[]
  /** Alternativet som er markert med piltastene. Standard: ingen. */
  activeIndex?: number
  /** Lista er åpen. Standard: lukket. */
  open?: boolean
  /**
   * Svaret på søket er ikke kommet ennå. Tommeldingen holdes da skjult, så
   * et asynkront søk ikke sier «Ingen treff» i oppholdet mellom tastetrykket
   * og svaret.
   */
  pending?: boolean
}

/**
 * Attributtene for et felt med forslagsliste.
 *
 * Serveren skriver både feltet og lista. Komponenten filtrerer, tar
 * piltastene og holder `aria-activedescendant` i synk. Den rendrer ingenting:
 * tidligere lagde den hele feltet selv, og da fantes det ikke noe å fylle ut
 * før skriptet hadde kjørt.
 *
 * Ingen bevaringsliste. Attributtene som endrer seg mens brukeren skriver er
 * komponentens egne, og den setter dem tilbake når en patch river dem bort.
 * Har noen andre alt filtrert, settes `prefiltered` på `<fs-suggestion>`, og
 * komponenten lar både alternativene og tommeldingen være i fred. Skal
 * serveren i tillegg bestemme om lista er utvidet og hvilket alternativ som er
 * markert, settes `server-controlled` ved siden av.
 */
export const suggestion = ({
  id: givenId,
  keys: givenKeys = [],
  activeIndex = -1,
  open = false,
  pending = false,
  ...field
}: SuggestionOptions) => {
  // Reserven gjelder bare den som ikke har en typesjekk.
  const id = idOrFallback("fs.suggestion()", givenId)
  const keys = checkedKeys("fs.suggestion()", givenKeys)
  const count = keys.length
  const computed = computeFieldAttributes({ ...field, id })
  const listId = `${id}-list`
  const statusId = `${id}-status`
  const optionId = (index: number) => `${id}-option-${keys[index]}`
  // Markeringen skrives bare når lista er åpen, begge halvdelene sammen.
  // Komponenten fjerner begge i det lista lukkes, og en lukket liste med et
  // markert alternativ ville pekt `aria-activedescendant` inn i noe skjult.
  const marked =
    open &&
    Number.isInteger(activeIndex) &&
    activeIndex >= 0 &&
    activeIndex < count

  return {
    label: computed.label,
    control: attributes(
      {
        ...computed.control,
        class: "fs-input" as const,
        type: "text" as const,
        role: "combobox" as const,
        autocomplete: "off" as const,
        "aria-expanded": (open ? "true" : "false") as "true" | "false",
        "aria-controls": listId,
        "aria-describedby": [computed.control["aria-describedby"], statusId]
          .filter(Boolean)
          .join(" "),
        "aria-autocomplete": "list" as const,
        "aria-activedescendant": marked ? optionId(activeIndex) : undefined,
      },
      computed.control,
    ),
    list: attributes({
      class: SUGGESTION_LIST_CLASS,
      id: listId,
      role: "listbox" as const,
      hidden: open ? undefined : (true as const),
    }),
    options: keys.map((_, index) =>
      attributes({
        class: SUGGESTION_OPTION_CLASS,
        id: optionId(index),
        role: "option" as const,
        "aria-selected": (marked && index === activeIndex ? "true" : "false") as
          | "true"
          | "false",
      }),
    ),
    /**
     * Teksten som vises når ingenting passer.
     *
     * Den følger lista: synlig bare når lista er åpen og tom. At lista er
     * lukket, tar stilarket seg av, med en regel som skjuler tommeldingen
     * etter en liste med `hidden`. Byggefunksjonen sier derfor bare om det
     * finnes treff, og om svaret er kommet (`pending`). Den leste `open`
     * før, og med `prefiltered` styrer appen tommeldingen uten å vite om lista
     * er åpen: den tilstanden er komponentens, så meldingen kunne aldri
     * vises.
     */
    empty: attributes({
      class: SUGGESTION_EMPTY_CLASS,
      hidden: count === 0 && !pending ? undefined : (true as const),
    }),
    /**
     * Området som melder antall treff til skjermlesere.
     *
     * Teksten skrives av komponenten mens brukeren taster, så den finnes ikke
     * i serverens utgave. Tømmer en oppdatering elementet, skriver
     * komponenten teksten på nytt. Elementet må likevel stå i markupen
     * serveren sender, ellers finnes det ikke noe å melde i før skriptet har
     * kjørt. `role="status"` gir `aria-live="polite"` av seg selv.
     */
    status: attributes({
      class: SUGGESTION_STATUS_CLASS,
      id: statusId,
      role: "status" as const,
    }),
    /**
     * Det skjulte feltet som får koden til alternativet brukeren valgte.
     *
     * Feltet viser teksten, og uten JavaScript er det teksten som sendes.
     * Med JavaScript skriver komponenten `data-value` fra alternativet hit,
     * eller teksten når alternativet ikke har `data-value`, og tømmer det når
     * brukeren endrer teksten. `name` skriver du selv; det
     * hører til skjemaet ditt.
     */
    value: attributes({
      class: SUGGESTION_VALUE_CLASS,
      type: "hidden" as const,
    }),
    help: computed.help,
    error: computed.error,
    state: computed.state,
  }
}
