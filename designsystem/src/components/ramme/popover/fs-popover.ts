import { defineElement, HostElement, meldMangel } from "../../host-element.js"
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
 * klassen og `popover` på panelet. Komponenten setter bare `aria-expanded`,
 * som endrer seg når brukeren klikker, og posisjonen. Begge står i
 * `data-preserve-attr` fra byggeren, ellers river morfingen dem bort.
 *
 * ```html
 * <fs-popover placement="bottom-end">
 *   <button class="fs-button" aria-controls="meny" aria-expanded="false"
 *           data-preserve-attr="aria-expanded">Handlinger</button>
 *   <ul id="meny" class="fs-popover" popover="manual" data-preserve-attr="style">…</ul>
 * </fs-popover>
 * ```
 */
export class FsPopover extends HostElement {
  static observedAttributes = ["open", "placement"]

  private panel?: HTMLElement
  private triggerElement?: HTMLElement
  private observer?: MutationObserver

  /** Om panelet er åpent. Speiles, så CSS kan treffe tilstanden. */
  get open(): boolean {
    return this.hasAttribute("open")
  }

  set open(value: boolean) {
    if (value) this.setAttribute("open", "")
    else this.removeAttribute("open")
  }

  /** Hvilken kant panelet henger fra. Standard: `bottom-start`. */
  get placement(): Placement {
    const value = this.getAttribute("placement") as Placement | null
    return value && PLACEMENTS.includes(value) ? value : "bottom-start"
  }

  set placement(value: Placement) {
    this.setAttribute("placement", value)
  }

  connectedCallback(): void {
    window.addEventListener("resize", this.reposition)
    window.addEventListener("scroll", this.reposition, true)
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, { childList: true })
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

  attributeChangedCallback(): void {
    if (this.isConnected) this.sync()
  }

  private sync(): void {
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
      // Bare når det står noe her. Et tomt element er et område serveren
      // ikke har fylt ennå, og det er ikke en feil i markupen.
      if (this.childElementCount > 0) {
        meldMangel(
          this,
          !panel
            ? "fant ingen [popover]. Panelet kan da verken åpnes eller plasseres."
            : "fant ingen knapp med [aria-controls] som peker på panelet. " +
                "Uten koblingen vet komponenten ikke hva som åpner vinduet.",
        )
      }
      return
    }

    if (this.triggerElement !== trigger) {
      this.triggerElement?.removeEventListener("click", this.handleTriggerClick)
      trigger.addEventListener("click", this.handleTriggerClick)
      this.triggerElement = trigger
    }
    this.panel = panel

    // Eneste attributtet komponenten eier. Resten skrev serveren.
    const expanded = String(this.open)
    if (trigger.getAttribute("aria-expanded") !== expanded) {
      trigger.setAttribute("aria-expanded", expanded)
    }

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
