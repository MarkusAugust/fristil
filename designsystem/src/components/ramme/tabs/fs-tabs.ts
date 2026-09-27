import {
  defineElement,
  HostElement,
  isServerControlled,
  SERVER_CONTROLLED,
  setAttr,
  setFlag,
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
   * Bare `server-controlled`. Hvilken fane som er valgt står i markupen
   * serveren sendte, som `aria-selected` på fanen og `hidden` på panelene, og
   * leses derfra. Et eget `selected` ville vært en parallell utgave av det
   * samme.
   */
  static observedAttributes = [SERVER_CONTROLLED] as const

  private readonly bound = new Set<HTMLButtonElement>()
  private observer?: MutationObserver
  /**
   * Fanen brukeren valgte, husket så en patch ikke kan ta den.
   *
   * Selve noden, ikke indeksen og ikke id-en. En indeks er ingen identitet:
   * setter serveren inn en fane først i lista, peker den samme indeksen på
   * noe annet, og valget hopper til en fane brukeren aldri trykket på. Id-en
   * er heller ikke nok, for håndskrevet markup har ofte ingen, og da ble den
   * tomme strengen en identitet som traff den første fanen. Det var verre enn
   * indeksen: brukeren fikk ikke byttet fane i det hele tatt.
   *
   * En attributtmorfing beholder nodene, så referansen overlever den. Bytter
   * patchen ut selve knappen, er fanen en annen, og da glemmer komponenten
   * valget framfor å gjette.
   *
   * `undefined` betyr at brukeren ikke har valgt noe ennå, og da er det
   * serverens markup som gjelder.
   */
  private chosenTab?: HTMLButtonElement

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

  attributeChangedCallback(name: string): void {
    // `server-controlled` slått på midt i: da skal komponenten slippe taket,
    // og neste patch bestemmer.
    if (name === SERVER_CONTROLLED && isServerControlled(this)) {
      this.chosenTab = undefined
    }
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

  /**
   * Fanene som hører til denne raden, og bare dem.
   *
   * Faner i faner er vanlig markup. Uten avgrensningen ble en indre rad en
   * del av den ytre: et klikk på en indre fane skjulte det ytre panelet den
   * sto i, og begge komponentene festet lyttere på de samme knappene.
   */
  private get tabs(): HTMLButtonElement[] {
    return [...this.querySelectorAll<HTMLButtonElement>("[role='tab']")].filter(
      (tab) => tab.closest(this.localName) === this,
    )
  }

  /** Panelene som står inni denne raden. Reserven når koblingen mangler. */
  private get ownPanels(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("[role='tabpanel']")].filter(
      (panel) => panel.closest(this.localName) === this,
    )
  }

  /**
   * Panelet en fane styrer.
   *
   * Koblingen står i markupen som `aria-controls`, og leses derfra. Da kan
   * panelene stå i en annen rekkefølge enn fanene, og utenfor verten. Et
   * panel utenfor ligger likevel ikke i det komponenten observerer, så river
   * en patch `hidden` av det, kommer det ikke tilbake av seg selv. Markup
   * uten id-er faller tilbake på rekkefølgen.
   */
  private panelFor(tab: HTMLElement, index: number): HTMLElement | null {
    const id = tab.getAttribute("aria-controls")
    if (id) {
      const root = this.getRootNode() as Document | ShadowRoot
      const panel = root.getElementById?.(id)
      if (panel) return panel
    }
    return this.ownPanels[index] ?? null
  }

  /** En fane som ikke kan velges, verken med mus eller tastatur. */
  private isDisabled(tab: HTMLElement): boolean {
    return (
      tab.hasAttribute("disabled") ||
      tab.getAttribute("aria-disabled") === "true"
    )
  }

  /**
   * Indeksen på fanen som er markert, eller `-1` når ingen er det.
   *
   * `selected` svarer 0 i det tilfellet, fordi den er offentlig API og en
   * fanerad i praksis alltid har en valgt fane. Men den løgnen kan ikke
   * brukes internt: sa den 0 når ingenting var markert, returnerte
   * `select(0)` med en gang, og raden svarte ikke på et klikk i det hele
   * tatt.
   */
  private get markedIndex(): number {
    return this.tabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    )
  }

  /** Indeksen på fanen som er valgt. */
  get selected(): number {
    const index = this.markedIndex
    return index < 0 ? 0 : index
  }

  set selected(index: number) {
    // React 19 skriver egenskapen når den finnes, og dokumentasjonen viser
    // `faner.selected` som API. En getter alene kastet ved tilordning.
    this.select(index)
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
   *
   * `apply()` kalles uansett om fanene ser riktige ut, for en patch kan ha
   * rørt bare panelene. Det er den smale patchen dokumentasjonen selv
   * anbefaler, og en sjekk på `aria-selected` alene så den ikke: fanen sa én
   * ting og skjermen en annen.
   */
  private repair(): void {
    if (!this.chosenTab || isServerControlled(this)) return

    const index = this.tabs.indexOf(this.chosenTab)
    if (index < 0) {
      /*
       * Fanen finnes ikke lenger. Serveren har sendt noe annet, og da er det
       * serverens markup som gjelder.
       *
       * Med ett unntak, og det er verdt å vite om: markupen må henge sammen
       * etterpå. Fjernet patchen fanen som var markert, står raden igjen uten
       * en eneste `aria-selected="true"`, alle panelene er skjult, og et
       * klikk gjør ingenting. Da velger komponenten den første, som er det en
       * fanerad uansett starter på. Sendte serveren med vilje en rad uten
       * markering, blir den altså overkjørt, men bare når brukeren hadde
       * valgt noe fra før.
       *
       * Valget meldes, for dette er komponentens eget og ikke brukerens.
       * Uten hendelsen ville en app som laster innholdet i panelet eller
       * skriver valget i adressen aldri fått vite at det flyttet seg.
       */
      this.chosenTab = undefined
      if (this.markedIndex < 0 && this.tabs.length > 0) {
        this.apply(0)
        this.notify(0)
      }
      return
    }

    this.apply(index)
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
      () => this.tabs.some((tab, i) => this.panelFor(tab, i) === null),
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

    // I en side som leses fra høyre står neste fane til venstre. Uten dette
    // flyttet høyrepil fokus visuelt bakover.
    const rtl = getComputedStyle(this).direction === "rtl"
    const steps: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
      ArrowDown: 1,
      ArrowUp: -1,
    }

    let next: number | undefined

    if (event.key in steps) {
      next = this.nextEnabled(current, steps[event.key])
    } else if (event.key === "Home") {
      next = this.nextEnabled(-1, 1)
    } else if (event.key === "End") {
      next = this.nextEnabled(tabs.length, -1)
    }

    if (next === undefined) return

    event.preventDefault()
    this.select(next)
    tabs[next].focus()
  }

  /**
   * Neste fane som kan velges, i en retning, rundt om nødvendig.
   *
   * En deaktivert fane hoppes over. Ble den valgt, gjorde `focus()` på en
   * deaktivert knapp ingenting, og raden sto uten en eneste fane som kunne
   * få fokus. Tastaturbrukeren var låst ute av raden.
   */
  private nextEnabled(from: number, step: number): number | undefined {
    const tabs = this.tabs
    for (let i = 1; i <= tabs.length; i++) {
      const index = (from + step * i + tabs.length * i) % tabs.length
      if (!this.isDisabled(tabs[index])) return index
    }
    return undefined
  }

  /** Velger en fane og melder fra. */
  select(index: number): void {
    const tabs = this.tabs
    if (index < 0 || index >= tabs.length) return
    if (this.isDisabled(tabs[index])) return
    // `markedIndex` og ikke `selected`: den siste svarer 0 også når ingenting
    // er markert, og da lot den første fanen seg aldri velge.
    if (index === this.markedIndex) return

    // Ingen hukommelse når serveren eier valget. Uten dette ville et valg
    // gjort mens attributtet sto der blitt satt tilbake i det noen fjernet
    // det igjen.
    if (!isServerControlled(this)) this.chosenTab = tabs[index]
    this.apply(index)
    this.notify(index)
  }

  /** Sier fra om hvilken fane som er valgt nå. */
  private notify(index: number): void {
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
    this.tabs.forEach((tab, i) => {
      const chosen = i === index
      setAttr(tab, "aria-selected", String(chosen))
      setAttr(tab, "tabindex", chosen ? "0" : "-1")

      const panel = this.panelFor(tab, i)
      if (panel) setFlag(panel, "hidden", !chosen)
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
