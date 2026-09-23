import {
  defineElement,
  HostElement,
  isServerControlled,
  SERVER_CONTROLLED,
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
 * Fanevalget er brukerens, og komponenten setter det tilbake når en patch
 * river det bort. Malen trenger derfor ingen `data-preserve-attr`. Skal
 * serveren kunne flytte fanen, som i «gå videre til steg 2», settes
 * `server-controlled` på verten, og da bestemmer hver patch.
 *
 * ```html
 * <fs-tabs>
 *   <div class="fs-tabs__list" role="tablist">
 *     <button id="sak-tab-0" role="tab" aria-selected="true"
 *             aria-controls="sak-panel-0" tabindex="0">Søknaden</button>
 *   </div>
 *   <div id="sak-panel-0" class="fs-tabs__panel" role="tabpanel"
 *        aria-labelledby="sak-tab-0" tabindex="0">…</div>
 * </fs-tabs>
 * ```
 */
export class FsTabs extends HostElement {
  /**
   * Ingen attributter. Hvilken fane som er valgt står i markupen serveren
   * sendte, som `aria-selected` på fanen og `hidden` på panelene, og leses
   * derfra. Et eget `selected` ville vært en parallell utgave av det samme.
   */
  static observedAttributes: string[] = [SERVER_CONTROLLED]

  private readonly bound = new Set<HTMLButtonElement>()
  private observer?: MutationObserver
  /**
   * Fanen brukeren valgte, husket så en patch ikke kan ta den.
   *
   * `undefined` betyr at brukeren ikke har valgt noe ennå, og da er det
   * serverens markup som gjelder. Så snart hun har valgt, er det hennes valg
   * som settes tilbake når en morfing river `aria-selected` bort.
   */
  private chosen?: number

  connectedCallback(): void {
    /*
     * Attributtene er med, ikke bare barna. En morfing river bort det som
     * ikke står i serverens HTML, og fanevalget er nettopp det: noe brukeren
     * gjorde etter at siden kom. Hver skriving sammenligner først, ellers
     * ville observatøren utløst seg selv.
     */
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected", "tabindex", "hidden"],
    })
    this.sync()
  }

  attributeChangedCallback(): void {
    // `server-controlled` slått på midt i: da skal komponenten slippe taket,
    // og neste patch bestemmer.
    if (isServerControlled(this)) this.chosen = undefined
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

  private sync(): void {
    this.bind()
    this.repair()
  }

  /**
   * Setter brukerens valg tilbake etter en patch.
   *
   * Uten dette måtte malen skrive `data-preserve-attr="aria-selected tabindex"`
   * på hver fane og `hidden` på hvert panel, altså liste opp attributtene
   * komponenten kom til å røre. Ingen kompilator så på den lista.
   */
  private repair(): void {
    if (this.chosen === undefined || isServerControlled(this)) return
    if (this.chosen >= this.tabs.length) return
    if (this.selected === this.chosen) return
    this.apply(this.chosen)
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
    if (index < 0 || index >= tabs.length) return
    if (index === this.selected) return

    this.chosen = index
    this.apply(index)

    this.dispatchEvent(
      new CustomEvent("tab-select", {
        detail: { index },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * Skriver valget ut i markupen.
   *
   * Hver skriving sammenligner først. Komponenten observerer nå de samme
   * attributtene den setter, så en skriving uten sammenligning ville utløst
   * observatøren, som ville skrevet på nytt, i det uendelige.
   */
  private apply(index: number): void {
    const tabs = this.tabs
    const panels = this.panels

    tabs.forEach((tab, i) => {
      const valgt = i === index
      const selected = String(valgt)
      if (tab.getAttribute("aria-selected") !== selected) {
        tab.setAttribute("aria-selected", selected)
      }
      const tabindex = valgt ? 0 : -1
      if (tab.tabIndex !== tabindex) tab.tabIndex = tabindex

      const panel = panels[i]
      if (panel && panel.hidden === valgt) panel.hidden = !valgt
    })
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
