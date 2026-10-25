import { attributes, checkedKeys, idOrFallback } from "../../css/shared.js"

export const TABS_LIST_CLASS = "lt-tabs__list" as const
export const TABS_PANEL_CLASS = "lt-tabs__panel" as const

export type TabsOptions = {
  /**
   * Felles id-stamme. Panelene blir `${id}-${nøkkel}`, overskriftene i dem
   * `${id}-${nøkkel}-heading`.
   */
  id: string
  /**
   * Én nøkkel per fane, fra dataene, som `["soknaden", "vedlegg"]`. Nøkkelen
   * gir panelet id, og lenken peker på den. En indeks er ingen nøkkel:
   * setter serveren inn en fane først, peker den samme indeksen på et annet
   * panel. Tom nøkkel, mellomrom og to like kaster.
   */
  keys: string[]
  /**
   * Hva fanene velger mellom. Blir `aria-label` på raden, som må ha et navn.
   * Tom, eller bare mellomrom, kaster.
   */
  label: string
}

export type TabsAttributes = {
  /** Raden, en `<ul>`. */
  list: { class: typeof TABS_LIST_CLASS; "aria-label": string }
  /** Hver fane, en lenke til panelet sitt. */
  tabs: Array<{ href: string }>
  /** Hvert panel, med id-en lenken peker på. */
  panels: Array<{ id: string; class: typeof TABS_PANEL_CLASS }>
  /** Overskriften i hvert panel. */
  headings: Array<{ id: string }>
}

/** Det felles for begge utgavene: nøklene sjekket, og id-ene laget av dem. */
function prepare(
  builder: string,
  options: { id: string; keys: string[]; label: string },
) {
  // Reserven gjelder bare den som ikke har en typesjekk.
  const id = idOrFallback(builder, options.id)
  // Stammen blir en del av hver id, og `aria-controls` deler på mellomrom:
  // `"a b"` ga `aria-controls="a b-x"`, som er to id-er. Nøklene kaster på
  // det samme.
  if (/\s/.test(id)) {
    throw new Error(
      `${builder}: id-en «${id}» har mellomrom. Den blir en del av hver id, og en id kan ikke ha mellomrom.`,
    )
  }
  // Før nøklene, som i Kotlin, så de to kaster med samme melding.
  if (typeof options.label !== "string" || options.label.trim() === "") {
    throw new Error(
      `${builder}: label mangler eller er tom. Raden må ha et navn som sier hva fanene velger mellom, ellers sier skjermleseren bare «faneliste».`,
    )
  }
  const keys = checkedKeys(builder, options.keys)
  return { id, keys, panelId: (key: string) => `${id}-${key}` }
}

/**
 * Attributtene for en fanerad der fanene er lenker til panelene.
 *
 * Bare lenker, id-er og klasser. Uten JavaScript er raden da en vanlig liste
 * med lenker, og panelene står etter hverandre: en innholdsfortegnelse som
 * virker for alle. Rollene, hvilken fane som er valgt og hvilke paneler som
 * er skjult skriver `<lt-tabs>`. Sto de her, ville markupen uten JavaScript
 * sagt «fane» om en lenke som ikke virker som en, og skjult panelene.
 *
 * Den første fanen er valgt når siden lastes. En annen kommer fra adressen,
 * som `#sak-vedlegg`, eller fra `selected` og `select()` på `<lt-tabs>`.
 *
 * React-appen bruker `lt.tabs()` fra `@lo-tek/interfaces/react`, som gir
 * hele tilstanden, så React hydrerer uten avvik.
 *
 * ```ts
 * const faner = lt.tabs({ id: "sak", keys: ["soknaden", "vedlegg"], label: "Deler av saken" })
 * ```
 */
export const tabs = (options: TabsOptions): TabsAttributes => {
  const { id, keys, panelId } = prepare("lt.tabs()", options)
  return {
    list: attributes({ class: TABS_LIST_CLASS, "aria-label": options.label }),
    tabs: keys.map((key) => attributes({ href: `#${panelId(key)}` })),
    panels: keys.map((key) =>
      attributes({ id: panelId(key), class: TABS_PANEL_CLASS }),
    ),
    headings: keys.map((key) => attributes({ id: `${id}-${key}-heading` })),
  }
}

export type TabsWithStateOptions = TabsOptions & {
  /** Indeksen på fanen som er valgt. Standard: 0. */
  selected?: number
}

export type TabsWithStateAttributes = {
  list: {
    class: typeof TABS_LIST_CLASS
    role: "tablist"
    "aria-label": string
  }
  item: { role: "presentation" }
  tabs: Array<{
    id: string
    href: string
    role: "tab"
    "aria-selected": "true" | "false"
    "aria-controls": string
    tabindex: "0" | "-1"
  }>
  panels: Array<{
    id: string
    class: typeof TABS_PANEL_CLASS
    role: "tabpanel"
    "aria-labelledby": string
    tabindex?: "0"
    hidden?: true
  }>
}

/**
 * Hele tilstanden, slik `<lt-tabs>` ville skrevet den. For React.
 *
 * React sammenligner attributtene på elementene den rendrer med det som står
 * i siden, og melder et avvik for hvert attributt den ikke rendret selv.
 * Skrev komponenten rollene og valget før React hydrerte, ga det ett avvik
 * per element. Her står alt fra start, så komponenten har ingenting å skrive.
 *
 * Lenkene får id fra serveren, og panelet peker på lenken sin, slik APG gjør.
 * En id serveren skriver er stabil; det er en id komponenten lager selv, som
 * får en oppdatering til å bytte ut elementet.
 *
 * `hidden` er boolsk: React 19 skriver `hidden="until-found"` som
 * `hidden=""`. Søk i siden åpner derfor ikke et skjult panel i en React-app.
 */
export const tabsWithState = (
  options: TabsWithStateOptions,
): TabsWithStateAttributes => {
  const { id, keys, panelId } = prepare("lt.tabs()", options)
  // Er `selected` utenfor rekkevidde, rettes den her. Ellers ville markupen
  // sagt noe annet enn det brukeren ser.
  // Et tall som ikke er et heltall, som `NaN` eller 1,5, ga ingen valgt fane,
  // alle panelene skjult og ingen tabbestopp.
  const selected = Number.isInteger(options.selected)
    ? (options.selected as number)
    : 0
  const valid = Math.min(Math.max(selected, 0), Math.max(keys.length - 1, 0))
  const tabId = (key: string) => `${id}-${key}-tab`
  return {
    list: attributes({
      class: TABS_LIST_CLASS,
      role: "tablist" as const,
      "aria-label": options.label,
    }),
    item: attributes({ role: "presentation" as const }),
    tabs: keys.map((key, index) =>
      attributes({
        id: tabId(key),
        href: `#${panelId(key)}`,
        role: "tab" as const,
        "aria-selected": (index === valid ? "true" : "false") as
          | "true"
          | "false",
        "aria-controls": panelId(key),
        // Rullerende tabindex: bare den valgte fanen er en tabbestopp.
        tabindex: (index === valid ? "0" : "-1") as "0" | "-1",
      }),
    ),
    panels: keys.map((key, index) =>
      attributes({
        id: panelId(key),
        class: TABS_PANEL_CLASS,
        role: "tabpanel" as const,
        "aria-labelledby": tabId(key),
        // Bare det valgte panelet er en tabbestopp. Et skjult panel som kan
        // få fokus, er et usynlig stopp for tastaturet.
        tabindex: index === valid ? ("0" as const) : undefined,
        hidden: index === valid ? undefined : (true as const),
      }),
    ),
  }
}
