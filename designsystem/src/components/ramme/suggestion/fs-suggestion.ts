import {
  defineElement,
  HostElement,
  isServerControlled,
  SERVER_CONTROLLED,
  setAttr,
  setFlag,
  setText,
  warnAboutMarkup,
} from "../../host-element.js"
import {
  SUGGESTION_EMPTY_CLASS,
  SUGGESTION_OPTION_CLASS,
} from "./suggestion.js"

export const FS_SUGGESTION_TAG = "fs-suggestion" as const

/**
 * Tastaturet og filtreringen i et felt med forslagsliste.
 *
 * Serveren skriver feltet og lista med `fs.suggestion()`. Komponenten rendrer
 * ingenting. Den lagde tidligere hele feltet selv, og da fantes det verken
 * ledetekst eller inndatafelt før skriptet hadde kjørt, og ingenting ble med
 * i innsendingen.
 *
 * Det komponenten gjør er det nettleseren ikke gjør: filtrerer alternativene
 * mens brukeren skriver, flytter markeringen med piltastene, og holder
 * `aria-activedescendant` i synk slik at skjermleseren leser opp alternativet
 * uten at fokus forlater feltet.
 *
 * Har noen andre alt filtrert, en server eller en React-komponent som
 * rendrer bare treffene, sier `prefiltered` fra, og komponenten lar
 * alternativene være i fred.
 *
 * ```html
 * <fs-suggestion>
 *   <label class="fs-label" for="kommune">Kommune</label>
 *   <div class="fs-suggestion__field">
 *     <input class="fs-input" id="kommune" role="combobox" aria-controls="kommune-list"
 *            aria-expanded="false">
 *     <ul class="fs-suggestion__list" id="kommune-list" role="listbox" hidden>
 *       <li class="fs-suggestion__option" id="kommune-option-0" role="option">Bergen</li>
 *     </ul>
 *   </div>
 * </fs-suggestion>
 * ```
 */
export class FsSuggestion extends HostElement {
  static observedAttributes = ["prefiltered", SERVER_CONTROLLED] as const

  private observer?: MutationObserver
  private control?: HTMLInputElement
  /** Alternativene som alt har fått lytteren sin. */
  private readonly bundne = new WeakSet<HTMLElement>()
  /** Sant mens komponenten selv sender hendelser, så den ikke svarer seg selv. */
  private choosing = false
  /**
   * Om lista står åpen, og hvilket alternativ som er markert.
   *
   * Begge deler er brukerens: hun skrev noe, og hun blar med piltastene.
   * Ingenting av det står i HTML-en serveren sendte, så en morfing river det
   * bort. Før måtte malen liste opp `aria-expanded`,
   * `aria-activedescendant` og `hidden` i `data-preserve-attr`. Nå setter
   * komponenten det tilbake.
   */
  private wantOpen?: boolean
  /**
   * Alternativet som er markert, husket med både id og tekst.
   *
   * Id-ene fra `fs.suggestion()` er posisjonelle, så en ny liste fra serveren
   * gjenbruker dem. Med id alene satte komponenten markeringen tilbake på
   * alternativ nummer to i en helt annen liste, og skjermleseren leste opp en
   * kommune brukeren aldri navigerte til. Teksten er identiteten; id-en er
   * bare der `aria-activedescendant` skal peke.
   */
  private active?: { id: string; label: string }
  /**
   * Antallet som sist ble lest opp, når noen andre filtrerer.
   *
   * Bare endringer skal leses opp, og det første antallet er
   * utgangspunktet og ikke en nyhet. Se `announceFiltered`.
   */
  private announcedCount?: number

  connectedCallback(): void {
    /*
     * Attributtene er med, ikke bare barna. Hver skriving under sammenligner
     * først, ellers ville observatøren utløst seg selv i det uendelige.
     */
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "aria-expanded",
        "aria-selected",
        "aria-activedescendant",
      ],
    })
    this.sync()
    document.addEventListener("click", this.handleOutsideClick, true)
  }

  attributeChangedCallback(navn: string): void {
    if (navn === SERVER_CONTROLLED && isServerControlled(this)) {
      this.wantOpen = undefined
      this.active = undefined
    }

    /*
     * Attributtet kan komme og gå mens siden lever, og da skal lista rettes
     * opp med en gang framfor ved neste tastetrykk. `this.observer` er
     * beskjeden om at komponenten står i dokumentet: tilbakekallet kommer
     * også under oppgraderingen, før barna finnes.
     */
    if (navn === "prefiltered" && this.observer) {
      // Antallet som står der i det attributtet settes er utgangspunktet, og
      // ikke noe å lese opp. Uten dette ble den første endringen etterpå
      // regnet som utgangspunktet, og gikk tapt.
      this.announcedCount = this.prefiltered ? this.visible.length : undefined
      this.filter()
    }
  }

  private sync(): void {
    this.bind()
    this.repair()
    this.announceFiltered()
  }

  /**
   * Setter brukerens tilstand tilbake etter en patch.
   *
   * Filtreringen regnes ut på nytt av det som står i feltet, så den trenger
   * ingen hukommelse. Det lista viser og hva som er markert gjør det.
   */
  private repair(): void {
    if (isServerControlled(this) || !this.control) return

    if (this.wantOpen !== undefined) {
      /*
       * Begge delene sjekkes hver for seg. En patch som bare rører feltet lot
       * `aria-expanded="false"` stå mens alternativene var synlige, og
       * skjermleseren meldte at lista var lukket mens den sto på skjermen.
       */
      const list = this.listElement
      const expanded = this.control.getAttribute("aria-expanded")
      if (
        (list && list.hidden === this.wantOpen) ||
        expanded !== String(this.wantOpen)
      ) {
        this.applyOpen(this.wantOpen)
      }
      if (this.wantOpen) this.filter()
    }

    if (this.active) {
      /*
       * Teksten må stemme, ikke bare id-en, og alternativet må være synlig.
       * Ellers markerte komponenten noe serveren nettopp hadde filtrert bort,
       * og `aria-activedescendant` pekte på et skjult element.
       */
      const aktiv = this.visible.find(
        (o) =>
          o.id === this.active?.id &&
          (o.textContent ?? "").trim() === this.active?.label,
      )
      if (!aktiv) {
        // Pekeren må bort sammen med markeringen. Uten dette pekte
        // `aria-activedescendant` på et alternativ som nå heter noe annet, og
        // skjermleseren leste opp en kommune brukeren aldri navigerte til.
        this.active = undefined
        this.control.removeAttribute("aria-activedescendant")
      } else if (
        aktiv.getAttribute("aria-selected") !== "true" ||
        this.control.getAttribute("aria-activedescendant") !== aktiv.id
      ) {
        // Begge sidene av koblingen sjekkes. Rev patchen bare
        // `aria-activedescendant`, mens markeringen sto igjen, mistet
        // skjermleseren lesepunktet sitt uten at noe annet så galt ut.
        this.markOption(aktiv)
      }
    }
  }

  disconnectedCallback(): void {
    document.removeEventListener("click", this.handleOutsideClick, true)
    this.observer?.disconnect()
    this.observer = undefined
    this.unbind()
  }

  /**
   * Noen andre har alt filtrert, så komponenten skal la være.
   *
   * Navnet het `server-filtered` før, og det var misvisende: det handler ikke
   * om servere. En React-app som rendrer bare treffene har filtrert like
   * fullt, uten at noen server er involvert.
   *
   * Komponenten skjuler et alternativ når teksten ikke inneholder det som
   * står i feltet. Filtrerer du på noe annet, uten diakritikk, på en kode som
   * ikke vises eller uskarpt, blir de to uenige, og da er det ditt filter som
   * skal gjelde. Attributtet slår av både skjulingen og tommeldingen, altså
   * alt som handler om hva lista viser. Opplesningen av antall treff blir
   * igjen, siden den ikke er markup.
   */
  get prefiltered(): boolean {
    return this.hasAttribute("prefiltered")
  }

  set prefiltered(on: boolean) {
    /*
     * Setteren er ikke pynt. React 19 skriver egenskapen framfor attributtet
     * når et egendefinert element har en med det navnet, og en getter alene
     * kaster «Cannot set property prefiltered». Attributtet landet aldri, og
     * komponenten skjulte det React nettopp hadde rendret. Bindestreken i det
     * gamle navnet skjulte problemet: `server-filtered` kan ikke være et
     * egenskapsnavn, så React sendte det som attributt.
     */
    setFlag(this, "prefiltered", on)
  }

  private get listElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>("[role='listbox']")
  }

  private get options(): HTMLElement[] {
    return [
      ...this.querySelectorAll<HTMLElement>(`.${SUGGESTION_OPTION_CLASS}`),
    ]
  }

  /**
   * Hvilket synlig alternativ som er markert nå.
   *
   * Den leses fra `aria-selected` i markupen, ikke fra en teller inni
   * komponenten. Serveren kan sette markeringen selv med
   * `fs.suggestion({ activeIndex })`, og en parallell teller ville hoppet
   * til toppen av lista ved første piltast i stedet for til alternativet
   * etter. Filtreringen flytter også på alternativene, og da svarer
   * oppslaget riktig av seg selv.
   */
  private get activeIndex(): number {
    return this.visible.findIndex(
      (option) => option.getAttribute("aria-selected") === "true",
    )
  }

  /** Alternativene som er synlige nå. */
  private get visible(): HTMLElement[] {
    return this.options.filter((option) => !option.hidden)
  }

  private unbind(): void {
    const control = this.control
    if (!control) return
    control.removeEventListener("input", this.handleInput)
    control.removeEventListener("keydown", this.handleKeydown)
    control.removeEventListener("focus", this.handleFocus)
    this.control = undefined
  }

  private bind(): void {
    const control = this.querySelector<HTMLInputElement>("[role='combobox']")
    if (!control) {
      warnAboutMarkup(
        this,
        'fant ingen [role="combobox"]. Uten den vet komponenten ikke ' +
          "hvilket felt den skal lytte på, og verken filtrering eller " +
          "piltaster virker. `fs.suggestion()` setter rollen.",
        // Et tomt element er et område serveren ikke har fylt ennå, og det
        // er ikke en feil i markupen.
        () =>
          this.childElementCount > 0 &&
          this.querySelector("[role='combobox']") === null,
      )
      return
    }

    warnAboutMarkup(
      this,
      'fant ingen [role="listbox"]. Alternativene kan da verken vises, ' +
        "filtreres eller velges med tastaturet.",
      () =>
        this.querySelector("[role='combobox']") !== null && !this.listElement,
    )

    if (control !== this.control) {
      this.unbind()
      control.addEventListener("input", this.handleInput)
      control.addEventListener("keydown", this.handleKeydown)
      control.addEventListener("focus", this.handleFocus)
      this.control = control
    }

    // Alternativene byttes ut uavhengig av feltet: i en Datastar-app sender
    // serveren en ny liste mens brukeren skriver. Lå dette bak sjekken over,
    // fikk de nye alternativene aldri lytteren sin, og valg med mus sluttet
    // å virke etter første oppdatering.
    for (const option of this.options) {
      if (this.bundne.has(option)) continue
      option.addEventListener("mousedown", this.handleOptionMouseDown)
      this.bundne.add(option)
    }
  }

  private setOpen(open: boolean): void {
    this.wantOpen = open
    this.applyOpen(open)
  }

  /** Skriver tilstanden ut i markupen, uten å endre hva brukeren ville. */
  private applyOpen(open: boolean): void {
    const list = this.listElement
    if (!list || !this.control) return

    setFlag(list, "hidden", !open)
    setAttr(this.control, "aria-expanded", String(open))

    if (!open) {
      this.active = undefined
      this.control.removeAttribute("aria-activedescendant")
      for (const option of this.options) {
        setAttr(option, "aria-selected", "false")
      }
    }
  }

  /**
   * Skjuler det som ikke passer, og melder hvor mange som er igjen.
   *
   * Kjøres av det brukeren gjør: hun skriver, eller hun setter fokus i
   * feltet.
   */
  private filter(): void {
    /*
     * Har noen andre filtrert, eier de hva lista viser, og tommeldingen er
     * en del av det. Komponenten rører derfor ingenting her, og opplesningen
     * kommer fra `announceFiltered` i stedet.
     *
     * To utgaver var feil før denne. Den første returnerte med en gang, og
     * da satt en Datastar-app igjen uten opplesning av antall treff i det
     * hele tatt. Den andre telte her: da meldte et tomt felt «Ingen treff»
     * allerede ved fokus, før brukeren hadde skrevet et tegn, og et
     * asynkront søk meldte det på nytt ved hvert tastetrykk mens svaret
     * fortsatt var underveis. Komponenten satte samtidig tommeldingen synlig
     * igjen etter at appen hadde skjult den, og det fantes ingen vei utenom.
     */
    if (this.prefiltered) return

    const query = (this.control?.value ?? "").trim().toLowerCase()
    for (const option of this.options) {
      const label = (option.textContent ?? "").trim().toLowerCase()
      setFlag(option, "hidden", query !== "" && !label.includes(query))
    }

    const treff = this.visible.length
    const empty = this.querySelector<HTMLElement>(`.${SUGGESTION_EMPTY_CLASS}`)
    if (empty) setFlag(empty, "hidden", treff > 0)

    this.announce(treff)
  }

  /**
   * Leser opp antallet når noen andre har filtrert.
   *
   * Lista endrer seg da ikke av et tastetrykk, men av at appen rendrer på
   * nytt, og det er nettopp den endringen observatøren ser. Beskjeden hører
   * hjemme her og ikke i `filter()`, for mellom tastetrykket og det nye
   * svaret kan det gå et halvt sekund over nettverket.
   *
   * Bare endringer leses opp. Det første antallet er utgangspunktet og ikke
   * en nyhet, og det står ofte 0 der fordi appen ikke har rendret lista
   * ennå.
   */
  private announceFiltered(): void {
    if (!this.prefiltered) return

    const treff = this.visible.length
    if (treff === this.announcedCount) return

    const forste = this.announcedCount === undefined
    this.announcedCount = treff
    if (!forste) this.announce(treff)
  }

  /**
   * Melder antall treff.
   *
   * Uten dette får den som ikke ser skjermen ingen beskjed om at lista
   * snevret seg inn mens hun skrev. Teksten er klientgenerert, så elementet
   * har `data-ignore-morph` fra byggeren.
   */
  private announce(treff: number): void {
    const status = this.querySelector<HTMLElement>("[role='status']")
    if (!status) return

    const tekst =
      treff === 0 ? "Ingen treff" : treff === 1 ? "Ett treff" : `${treff} treff`

    setText(status, tekst)
  }

  private markActive(index: number): void {
    const synlige = this.visible
    if (synlige.length === 0 || !this.control) return

    const neste = (index + synlige.length) % synlige.length

    this.markOption(synlige[neste])
    synlige[neste].scrollIntoView({ block: "nearest" })
  }

  /** Markerer ett alternativ, og husker hvilket. */
  private markOption(aktiv: HTMLElement): void {
    if (!this.control) return

    for (const option of this.options) {
      setAttr(option, "aria-selected", option === aktiv ? "true" : "false")
    }

    this.active = { id: aktiv.id, label: (aktiv.textContent ?? "").trim() }
    // aria-activedescendant flytter skjermleserens lesepunkt uten at fokus
    // forlater feltet. Uten den leses alternativet aldri opp.
    setAttr(this.control, "aria-activedescendant", aktiv.id)
  }

  private choose(option: HTMLElement): void {
    if (!this.control) return

    const value =
      option.getAttribute("data-value") ?? (option.textContent ?? "").trim()
    this.control.value = value

    // Flagget må stå før hendelsene sendes. `input` er den samme hendelsen
    // komponenten selv lytter på, så uten dette åpner lista seg igjen i det
    // øyeblikket brukeren har valgt noe.
    this.choosing = true
    this.control.dispatchEvent(new Event("input", { bubbles: true }))
    this.control.dispatchEvent(new Event("change", { bubbles: true }))
    this.choosing = false

    this.setOpen(false)
    this.dispatchEvent(
      new CustomEvent("suggestion-select", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleInput = (): void => {
    if (this.choosing) return
    this.filter()
    this.setOpen(true)
  }

  private handleFocus = (): void => {
    this.filter()
    this.setOpen(true)
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    const åpen = this.listElement?.hidden === false

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!åpen) {
        this.filter()
        this.setOpen(true)
      }
      this.markActive(this.activeIndex + 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      // Lista må åpnes først, som med pil ned. Uten det pekte
      // `aria-activedescendant` på et alternativ i en liste feltet samtidig
      // meldte som lukket, og skjermleseren leste opp noe som ikke sto på
      // skjermen.
      if (!åpen) {
        this.filter()
        this.setOpen(true)
      }
      // Er ingenting markert, går pil opp til det siste. `activeIndex - 1`
      // ville gitt det nest siste, siden ingenting markert er -1.
      this.markActive(this.activeIndex < 0 ? -1 : this.activeIndex - 1)
    } else if (event.key === "Enter" && åpen && this.activeIndex >= 0) {
      event.preventDefault()
      const valgt = this.visible[this.activeIndex]
      if (valgt) this.choose(valgt)
    } else if (event.key === "Escape" && åpen) {
      event.preventDefault()
      this.setOpen(false)
    }
  }

  private handleOptionMouseDown = (event: Event): void => {
    // mousedown og ikke click: feltet mister ellers fokus før valget rekker
    // å skje, og lista lukker seg først.
    event.preventDefault()
    this.choose(event.currentTarget as HTMLElement)
  }

  private handleOutsideClick = (event: Event): void => {
    if (this.contains(event.target as Node)) return
    this.setOpen(false)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-suggestion": FsSuggestion
  }
}

export function defineFsSuggestion(tagName = FS_SUGGESTION_TAG): void {
  defineElement(tagName, FsSuggestion)
}
