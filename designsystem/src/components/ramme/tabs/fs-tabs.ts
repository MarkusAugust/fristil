import {
  defineElement,
  HostElement,
  warnAboutMarkup,
} from "../../host-element.js"
export const FS_TABS_TAG = "fs-tabs" as const

/**
 * Tastaturet i en fanerad.
 *
 * Serveren skriver rollene, `aria-controls` og `hidden` med `fs.tabs()`.
 * Gjorde komponenten det, ville alle panelene vises til skriptet hadde kjørt,
 * og innholdet hoppe når panelene skjulte seg selv. I en Datastar-app ville
 * de dessuten komme tilbake ved hver patch.
 *
 * Det komponenten gjør er det nettleseren ikke gjør selv: Tab hopper forbi
 * hele raden og inn i panelet, mens piltastene flytter mellom fanene. Et sett
 * knapper uten dette gir én tabbestopp per fane, og skjermleseren sier
 * «knapp» der den skulle sagt «fane, 2 av 3, valgt».
 *
 * Attributtene som endrer seg når brukeren velger, altså `aria-selected`,
 * `tabindex` og `hidden`, står i `data-preserve-attr` fra byggeren.
 *
 * ```html
 * <fs-tabs>
 *   <div class="fs-tabs__list" role="tablist">
 *     <button id="sak-tab-0" role="tab" aria-selected="true" aria-controls="sak-panel-0"
 *             tabindex="0" data-preserve-attr="aria-selected tabindex">Søknaden</button>
 *   </div>
 *   <div id="sak-panel-0" class="fs-tabs__panel" role="tabpanel"
 *        aria-labelledby="sak-tab-0" tabindex="0" data-preserve-attr="hidden">…</div>
 * </fs-tabs>
 * ```
 */
export class FsTabs extends HostElement {
  /**
   * Ingen attributter. Hvilken fane som er valgt står i markupen serveren
   * sendte, som `aria-selected` på fanen og `hidden` på panelene, og leses
   * derfra. Et eget `selected` ville vært en parallell utgave av det samme.
   */
  static observedAttributes: string[] = []

  private readonly bound = new Set<HTMLButtonElement>()
  private observer?: MutationObserver

  connectedCallback(): void {
    this.observer = new MutationObserver(() => this.bind())
    this.observer.observe(this, { childList: true, subtree: true })
    this.bind()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    for (const tab of this.bound) {
      tab.removeEventListener("click", this.handleClick)
      tab.removeEventListener("keydown", this.handleKeydown)
    }
    this.bound.clear()
  }

  private get tabs(): HTMLButtonElement[] {
    return [...this.querySelectorAll<HTMLButtonElement>("[role='tab']")]
  }

  private get panels(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("[role='tabpanel']")]
  }

  /** Indeksen på fanen serveren har markert som valgt. */
  get selected(): number {
    const index = this.tabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    )
    return index < 0 ? 0 : index
  }

  private bind(): void {
    const tabs = this.tabs

    if (tabs.length === 0) {
      warnAboutMarkup(
        this,
        'fant ingen faner. Knappene i raden må ha role="tab", ellers ' +
          "sier skjermleseren «knapp» der den skulle sagt «fane, 2 av 3, " +
          "valgt», og piltastene gjør ingenting.",
        // En tom `<fs-tabs>` er et område serveren ikke har fylt ennå, og
        // det er ikke en feil i markupen.
        () => this.childElementCount > 0 && this.tabs.length === 0,
      )
      return
    }

    // Uten tallene i meldingen. Interpolerer den et tall, er hver runde en
    // ny melding, og advarselen kommer på nytt for hvert panel som dukker
    // opp framfor én gang.
    warnAboutMarkup(
      this,
      'har flere faner enn paneler med role="tabpanel". Fanene uten et ' +
        "panel kan velges uten at noe vises.",
      () => this.tabs.length > 0 && this.panels.length < this.tabs.length,
    )

    for (const tab of tabs) {
      if (this.bound.has(tab)) continue
      tab.addEventListener("click", this.handleClick)
      tab.addEventListener("keydown", this.handleKeydown)
      this.bound.add(tab)
    }
  }

  private handleClick = (event: Event): void => {
    const index = this.tabs.indexOf(event.currentTarget as HTMLButtonElement)
    if (index >= 0) this.select(index)
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    const tabs = this.tabs
    const current = tabs.indexOf(event.currentTarget as HTMLButtonElement)
    if (current < 0) return

    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 1,
      ArrowUp: -1,
    }

    let next: number | undefined

    if (event.key in steps) {
      next = (current + steps[event.key] + tabs.length) % tabs.length
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = tabs.length - 1
    }

    if (next === undefined) return

    event.preventDefault()
    this.select(next)
    tabs[next].focus()
  }

  /** Velger en fane og melder fra. */
  select(index: number): void {
    const tabs = this.tabs
    const panels = this.panels
    if (index < 0 || index >= tabs.length) return
    if (index === this.selected) return

    tabs.forEach((tab, i) => {
      const valgt = i === index
      tab.setAttribute("aria-selected", String(valgt))
      tab.tabIndex = valgt ? 0 : -1
      const panel = panels[i]
      if (panel) panel.hidden = !valgt
    })

    this.dispatchEvent(
      new CustomEvent("tab-select", {
        detail: { index },
        bubbles: true,
        composed: true,
      }),
    )
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-tabs": FsTabs
  }
}

export function defineFsTabs(tagName = FS_TABS_TAG): void {
  defineElement(tagName, FsTabs)
}
