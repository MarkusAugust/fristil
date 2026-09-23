import { attributes } from "../../css/shared.js"

export const TABS_LIST_CLASS = "fs-tabs__list" as const
export const TABS_PANEL_CLASS = "fs-tabs__panel" as const

export type TabsOptions = {
  /** Felles id-stamme. Fanene blir `${id}-tab-0`, panelene `${id}-panel-0`. */
  id: string
  /** Antall faner. */
  count: number
  /** Indeksen på fanen som er valgt. Standard: 0. */
  selected?: number
  /** Tekst som sier hva fanene velger mellom. Blir `aria-label` på raden. */
  label?: string
}

export type TabsAttributes = {
  list: {
    class: typeof TABS_LIST_CLASS
    role: "tablist"
    "aria-label"?: string
  }
  tabs: Array<{
    id: string
    role: "tab"
    type: "button"
    "aria-selected": "true" | "false"
    "aria-controls": string
    tabindex: "0" | "-1"
  }>
  panels: Array<{
    id: string
    class: typeof TABS_PANEL_CLASS
    role: "tabpanel"
    "aria-labelledby": string
    tabindex: "0"
    hidden?: true
  }>
}

/**
 * Attributtene for en fanerad.
 *
 * Serveren skriver rollene og skjuler panelene som ikke er valgt. Gjorde
 * komponenten det, ville alle panelene vises til skriptet hadde kjørt, og
 * innholdet hoppe når det skjulte seg selv.
 *
 * Ingen bevaringsliste. Fanevalget er brukerens, og `<fs-tabs>` setter det
 * tilbake når en patch river det bort. Skal serveren kunne flytte fanen,
 * settes `server-controlled` på `<fs-tabs>`.
 *
 * ```ts
 * const faner = fs.tabs({ id: "sak", count: 2, selected: 1, label: "Velg visning" })
 * ```
 */
export const tabs = ({
  id,
  count,
  selected = 0,
  label,
}: TabsOptions): TabsAttributes => {
  // Er `selected` utenfor rekkevidde, rettes den her. Ellers ville markupen
  // sagt noe annet enn det brukeren ser.
  const valid = Math.min(Math.max(selected, 0), Math.max(count - 1, 0))
  const tabId = (index: number) => `${id}-tab-${index}`
  const panelId = (index: number) => `${id}-panel-${index}`
  const indices = Array.from({ length: count }, (_, index) => index)

  return {
    list: attributes({
      class: TABS_LIST_CLASS,
      role: "tablist" as const,
      "aria-label": label,
    }),
    tabs: indices.map((index) =>
      attributes({
        id: tabId(index),
        role: "tab" as const,
        type: "button" as const,
        "aria-selected": (index === valid ? "true" : "false") as
          | "true"
          | "false",
        "aria-controls": panelId(index),
        // Rullerende tabindex: bare den valgte fanen er en tabbestopp, så Tab
        // går fra raden og rett inn i panelet.
        tabindex: (index === valid ? "0" : "-1") as "0" | "-1",
        // Komponenten flytter valget når brukeren klikker. Morfingen ville
        // ellers satt det tilbake til det serveren sendte.
      }),
    ),
    panels: indices.map((index) =>
      attributes({
        id: panelId(index),
        class: TABS_PANEL_CLASS,
        role: "tabpanel" as const,
        "aria-labelledby": tabId(index),
        // Panelet får fokus når det ikke har noe å fokusere på selv, ellers
        // hopper Tab rett forbi innholdet som nettopp ble vist.
        tabindex: "0" as const,
        hidden: index === valid ? undefined : (true as const),
      }),
    ),
  }
}
