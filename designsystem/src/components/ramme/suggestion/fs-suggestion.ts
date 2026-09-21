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
 * Patcher serveren lista selv, som i en Datastar-app, slår filtreringen seg
 * av: da er det serveren som bestemmer hva som vises.
 *
 * ```html
 * <fs-suggestion>
 *   <label class="fs-label" for="kommune">Kommune</label>
 *   <div class="fs-suggestion__field">
 *     <input class="fs-input" id="kommune" role="combobox" aria-controls="kommune-list"
 *            aria-expanded="false" data-preserve-attr="aria-expanded aria-activedescendant">
 *     <ul class="fs-suggestion__list" id="kommune-list" role="listbox" hidden
 *         data-preserve-attr="hidden">
 *       <li class="fs-suggestion__option" id="kommune-option-0" role="option">Bergen</li>
 *     </ul>
 *   </div>
 * </fs-suggestion>
 * ```
 */
export class FsSuggestion extends HTMLElement {
  static observedAttributes = ["server-filtered"]

  private activeIndex = -1
  private observer?: MutationObserver
  private control?: HTMLInputElement
  /** Sant mens komponenten selv sender hendelser, så den ikke svarer seg selv. */
  private choosing = false

  connectedCallback(): void {
    this.observer = new MutationObserver(() => this.bind())
    this.observer.observe(this, { childList: true, subtree: true })
    this.bind()
    document.addEventListener("click", this.handleOutsideClick, true)
  }

  disconnectedCallback(): void {
    document.removeEventListener("click", this.handleOutsideClick, true)
    this.observer?.disconnect()
    this.observer = undefined
    this.unbind()
  }

  /** Slår av filtreringen på klienten. Da er det serveren som bestemmer. */
  get serverFiltered(): boolean {
    return this.hasAttribute("server-filtered")
  }

  private get listElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>("[role='listbox']")
  }

  private get options(): HTMLElement[] {
    return [
      ...this.querySelectorAll<HTMLElement>(`.${SUGGESTION_OPTION_CLASS}`),
    ]
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
    if (!control || control === this.control) return

    this.unbind()
    control.addEventListener("input", this.handleInput)
    control.addEventListener("keydown", this.handleKeydown)
    control.addEventListener("focus", this.handleFocus)
    this.control = control

    for (const option of this.options) {
      option.addEventListener("mousedown", this.handleOptionMouseDown)
    }
  }

  private setOpen(open: boolean): void {
    const list = this.listElement
    if (!list || !this.control) return

    list.hidden = !open
    this.control.setAttribute("aria-expanded", String(open))

    if (!open) {
      this.activeIndex = -1
      this.control.removeAttribute("aria-activedescendant")
      for (const option of this.options) {
        option.setAttribute("aria-selected", "false")
      }
    }
  }

  private filter(): void {
    if (this.serverFiltered) return

    const query = (this.control?.value ?? "").trim().toLowerCase()
    for (const option of this.options) {
      const label = (option.textContent ?? "").trim().toLowerCase()
      option.hidden = query !== "" && !label.includes(query)
    }

    const treff = this.visible.length
    const empty = this.querySelector<HTMLElement>(`.${SUGGESTION_EMPTY_CLASS}`)
    if (empty) empty.hidden = treff > 0

    this.announce(treff)
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

    if (status.textContent !== tekst) status.textContent = tekst
  }

  private markActive(index: number): void {
    const synlige = this.visible
    if (synlige.length === 0 || !this.control) return

    const neste = (index + synlige.length) % synlige.length
    this.activeIndex = neste

    for (const option of this.options) {
      option.setAttribute("aria-selected", "false")
    }

    const aktiv = synlige[neste]
    aktiv.setAttribute("aria-selected", "true")
    // aria-activedescendant flytter skjermleserens lesepunkt uten at fokus
    // forlater feltet. Uten den leses alternativet aldri opp.
    this.control.setAttribute("aria-activedescendant", aktiv.id)
    aktiv.scrollIntoView({ block: "nearest" })
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
      this.markActive(this.activeIndex - 1)
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
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsSuggestion)
  }
}
