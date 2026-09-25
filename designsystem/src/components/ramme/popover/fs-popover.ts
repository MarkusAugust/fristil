import {
  defineElement,
  HostElement,
  isServerControlled,
  SERVER_CONTROLLED,
  setAttr,
  setFlag,
  warnAboutMarkup,
} from "../../host-element.js"
export const FS_POPOVER_TAG = "fs-popover" as const

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end"

const PLACEMENTS: readonly Placement[] = [
  "bottom-start",
  "bottom-end",
  "top-start",
  "top-end",
]

/**
 * Et panel som henger under en knapp, og som lukker seg selv.
 *
 * Panelet bruker nettleserens egen `popover`, så det havner i topplaget. Det
 * løser tre ting som ellers krever kode: panelet legger seg over alt annet
 * uten `z-index`, Escape lukker det, og et klikk utenfor lukker det.
 *
 * Det topplaget ikke gjør er å plassere panelet. `position-anchor` finnes
 * ennå ikke i alle nettlesere, så posisjonen regnes ut her.
 *
 * Serveren skriver koblingen med `fs.popover()`: `aria-controls` på knappen,
 * klassen og `popover` på panelet. Komponenten setter `open` på verten,
 * `aria-expanded` på knappen og posisjonen på panelet, og setter dem tilbake
 * når en patch river dem bort. Malen trenger ingen `data-preserve-attr`.
 *
 * Reparasjonen gjelder én vei: har noen bedt om at vinduet er åpent, blir det
 * stående gjennom en patch. Sender serveren `open`, åpnes det, for det er noe
 * serveren faktisk sa.
 *
 * Skal serveren eie tilstanden, settes `server-controlled` på verten. Det er
 * også svaret når siden styrer `open` med et attributt utenfra, som med
 * Datastars `data-attr:open`: et fjernet attributt er ikke til å skille fra en
 * morfing, mens `meny.open = false` er en beskjed komponenten kan se.
 *
 * ```html
 * <fs-popover placement="bottom-end">
 *   <button class="fs-button" aria-controls="meny" aria-expanded="false">Handlinger</button>
 *   <ul id="meny" class="fs-popover" popover="manual">…</ul>
 * </fs-popover>
 * ```
 */
export class FsPopover extends HostElement {
  static observedAttributes = ["open", "placement", SERVER_CONTROLLED] as const

  private panel?: HTMLElement
  private triggerElement?: HTMLElement
  private observer?: MutationObserver
  /**
   * Hva komponenten sist ble bedt om, gjennom `open`-egenskapen.
   *
   * `open` bor på verten, og en morfing river bort alt som ikke står i
   * serverens HTML. Uten noe mer lukket hver eneste patch et vindu brukeren
   * nettopp hadde åpnet.
   *
   * Et fjernet attributt ser likt ut uansett hvem som fjernet det, så
   * komponenten kan ikke se forskjell på en morfing og en app. Skillet går i
   * stedet på **hvordan** appen sier fra: går den gjennom egenskapen, altså
   * `meny.open = false`, `hide()` eller `toggle()`, er det en beskjed, og den
   * følges. Setter noe attributtet direkte, som Datastars `data-attr:open`,
   * er det ikke til å skille fra en morfing, og da skal siden si
   * `server-controlled` og la serveren eie tilstanden.
   */
  private wantsOpen = false

  /** Om panelet er åpent. Speiles, så CSS kan treffe tilstanden. */
  get open(): boolean {
    return this.hasAttribute("open")
  }

  set open(value: boolean) {
    // Beskjeden noteres her, og ikke i `show()` og `hide()`. De går begge
    // gjennom setteren, men det gjør også `meny.open = false` fra en app, og
    // uten dette satte komponenten attributtet rett tilbake igjen.
    //
    // Ingen hukommelse når serveren eier tilstanden. Uten den sperren spratt
    // vinduet opp av seg selv i det `server-controlled` ble tatt av igjen.
    this.wantsOpen = isServerControlled(this) ? false : value
    setFlag(this, "open", value)
  }

  /** Hvilken kant panelet henger fra. Standard: `bottom-start`. */
  get placement(): Placement {
    const value = this.getAttribute("placement") as Placement | null
    return value && PLACEMENTS.includes(value) ? value : "bottom-start"
  }

  set placement(value: Placement) {
    setAttr(this, "placement", value)
  }

  connectedCallback(): void {
    window.addEventListener("resize", this.reposition)
    window.addEventListener("scroll", this.reposition, true)
    /*
     * Attributtene er med, ikke bare barna. `aria-expanded` på knappen og
     * plasseringen på panelet er noe komponenten regner ut, så river en patch
     * dem bort, skal de tilbake. Hver skriving i `sync()` sammenligner først,
     * ellers ville observatøren utløst seg selv.
     */
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "style"],
    })
    this.sync()
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.reposition)
    window.removeEventListener("scroll", this.reposition, true)
    document.removeEventListener("click", this.handleOutsideClick, true)
    document.removeEventListener("keydown", this.handleKeydown)
    this.observer?.disconnect()
    this.observer = undefined
    this.triggerElement?.removeEventListener("click", this.handleTriggerClick)
    // Referansen må nullstilles, ellers ser `sync()` at knappen er den samme
    // når elementet settes inn igjen, og hopper over å feste lytteren på
    // nytt. Da lar panelet seg ikke åpne lenger.
    this.triggerElement = undefined
    this.panel = undefined
  }

  attributeChangedCallback(navn: string): void {
    // `server-controlled` slått på midt i: komponenten slipper taket, og neste
    // patch bestemmer.
    if (navn === SERVER_CONTROLLED && isServerControlled(this)) {
      this.wantsOpen = false
    }

    if (this.isConnected) this.sync()
  }

  private sync(): void {
    /*
     * Setter `open` tilbake når en patch tok det.
     *
     * Bare én vei: står `open` der, er vinduet åpent, og da har enten
     * brukeren eller serveren sagt det. Er det borte mens brukeren åpnet det,
     * er det morfingen som tok det, og da kommer det tilbake.
     */
    if (this.wantsOpen && !this.open && !isServerControlled(this)) {
      /*
       * Vent til hele patchen har landet før vinduet åpnes igjen.
       *
       * En morfing setter ett attributt om gangen, og `open` kommer før
       * `server-controlled` i dokumentrekkefølgen. Reparerte komponenten med
       * en gang, satte den `open` tilbake mens serveren var midt i å si at
       * den overtar tilstanden, og vinduet ble stående åpent etterpå.
       * `queueMicrotask` kjører etter at hele patchen er ferdig, og vilkåret
       * sjekkes på nytt der.
       */
      queueMicrotask(() => {
        if (!this.isConnected || isServerControlled(this)) return
        if (this.wantsOpen && !this.open) setFlag(this, "open", true)
      })
    }

    // Delene kjennes igjen på koblingen som må være der uansett: panelet er
    // det som har `popover`, og knappen er den som peker på panelet med
    // `aria-controls`. Før sto det `slot="trigger"` på knappen, et levn fra
    // den gangen komponenten hadde shadow DOM. Uten en skyggerot gjør `slot`
    // ingenting i HTML, så attributtet var en merkelapp som så ut som noe
    // annet enn det var.
    const panel = this.querySelector<HTMLElement>("[popover]")
    const trigger = panel?.id
      ? this.querySelector<HTMLElement>(
          `[aria-controls="${CSS.escape(panel.id)}"]`,
        )
      : null

    if (!trigger || !panel) {
      /*
       * Tre ulike feil, og hver sin beskjed. Uten skillet fikk et panel
       * uten `id` beskjed om at knappen manglet, og utvikleren lette på feil
       * sted: oppslaget etter knappen går gjennom panelets id, så den faller
       * bort av seg selv når id-en mangler.
       *
       * Et tomt element er et område serveren ikke har fylt ennå, og det er
       * ikke en feil i markupen.
       */
      const isEmpty = () => this.childElementCount === 0

      if (!panel) {
        warnAboutMarkup(
          this,
          "fant ingen [popover]. Panelet kan da verken åpnes eller plasseres.",
          () => !isEmpty() && this.querySelector("[popover]") === null,
        )
      } else if (!panel.id) {
        warnAboutMarkup(
          this,
          "panelet har ingen id, så knappen kan ikke peke på det med " +
            "aria-controls, og komponenten finner ikke ut hva som åpner " +
            "vinduet.",
          () => {
            const found = this.querySelector("[popover]")
            return !isEmpty() && found !== null && found.id === ""
          },
        )
      } else {
        warnAboutMarkup(
          this,
          "fant ingen knapp med [aria-controls] som peker på panelet. " +
            "Uten koblingen vet komponenten ikke hva som åpner vinduet.",
          () => {
            const found = this.querySelector("[popover]")
            return (
              !isEmpty() &&
              found !== null &&
              found.id !== "" &&
              this.querySelector(
                `[aria-controls="${CSS.escape(found.id)}"]`,
              ) === null
            )
          },
        )
      }

      /*
       * Slipp taket i det vi hadde. River en patch panelet bort, holdt
       * komponenten ellers på en løsrevet node, og `reposition()` fortsatte
       * å regne ut plasseringen for noe som ikke står i siden.
       *
       * Lytterne på `document` må med. Uten dem ble de liggende i fangstfasen
       * så lenge markupen var ødelagt, og et klikk hvor som helst på siden ga
       * appen en `popover-toggle` den ikke hadde bedt om.
       */
      this.triggerElement?.removeEventListener("click", this.handleTriggerClick)
      this.triggerElement = undefined
      this.panel = undefined
      document.removeEventListener("click", this.handleOutsideClick, true)
      document.removeEventListener("keydown", this.handleKeydown)
      return
    }

    if (this.triggerElement !== trigger) {
      this.triggerElement?.removeEventListener("click", this.handleTriggerClick)
      trigger.addEventListener("click", this.handleTriggerClick)
      this.triggerElement = trigger
    }
    this.panel = panel

    // Komponentens eget, og satt på nytt hvis en patch tok det.
    setAttr(trigger, "aria-expanded", String(this.open))

    if (this.open) {
      if (!panel.matches(":popover-open")) panel.showPopover()
      this.reposition()
      document.addEventListener("click", this.handleOutsideClick, true)
      document.addEventListener("keydown", this.handleKeydown)
    } else {
      if (panel.matches(":popover-open")) panel.hidePopover()
      document.removeEventListener("click", this.handleOutsideClick, true)
      document.removeEventListener("keydown", this.handleKeydown)
    }
  }

  private handleTriggerClick = (): void => {
    this.toggle()
  }

  private handleOutsideClick = (event: Event): void => {
    const target = event.target as Node
    if (this.contains(target) || this.panel?.contains(target)) return
    this.hide()
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return
    this.hide()
    // Fokus tilbake til knappen. Uten dette står fokus på et panel som ikke
    // lenger finnes, og neste tastetrykk starter på toppen av siden.
    this.triggerElement?.focus()
  }

  /** Regner ut hvor panelet skal stå, mot knappens plass på skjermen. */
  private reposition = (): void => {
    if (!this.open || !this.panel || !this.triggerElement) return

    const anchor = this.triggerElement.getBoundingClientRect()
    const panel = this.panel.getBoundingClientRect()
    const space = 4

    const below = this.placement.startsWith("bottom")
    const alignEnd = this.placement.endsWith("end")

    let top = below ? anchor.bottom + space : anchor.top - panel.height - space
    let left = alignEnd ? anchor.right - panel.width : anchor.left

    // Panelet skal ikke havne utenfor skjermen. Går det ut på siden, flyttes
    // det inn; er det ikke plass under, legges det over knappen i stedet.
    left = Math.max(
      space,
      Math.min(left, window.innerWidth - panel.width - space),
    )
    if (below && top + panel.height > window.innerHeight) {
      top = Math.max(space, anchor.top - panel.height - space)
    }

    this.panel.style.setProperty("--fs-popover-top", `${Math.round(top)}px`)
    this.panel.style.setProperty("--fs-popover-left", `${Math.round(left)}px`)
  }

  private emit(open: boolean): void {
    this.dispatchEvent(
      new CustomEvent("popover-toggle", {
        detail: { open },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** Åpner panelet. */
  show(): void {
    if (this.open) return
    this.open = true
    this.emit(true)
  }

  /** Lukker panelet. */
  hide(): void {
    if (!this.open) return
    this.open = false
    this.emit(false)
  }

  /** Åpner eller lukker. */
  toggle(): void {
    if (this.open) this.hide()
    else this.show()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-popover": FsPopover
  }
}

export function defineFsPopover(tagName = FS_POPOVER_TAG): void {
  defineElement(tagName, FsPopover)
}
