import { html, LitElement } from "lit"

export const FS_POPOVER_TAG = "fs-popover" as const

export const POPOVER_CLASS = "fs-popover" as const

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end"

/**
 * Et panel som henger under en knapp, og som lukker seg selv.
 *
 * Panelet bruker nettleserens egen `popover`, så det havner i topplaget. Det
 * løser tre ting som ellers krever kode: panelet legger seg over alt annet
 * uten `z-index`, Escape lukker det, og et klikk utenfor lukker det.
 *
 * Det topplaget gjør ikke er å plassere panelet. `position-anchor` finnes
 * ennå ikke i alle nettlesere, så posisjonen regnes ut her, mot knappens
 * plass på skjermen.
 *
 * Du skriver knappen og innholdet selv, og komponenten kobler dem sammen:
 *
 * ```html
 * <fs-popover placement="bottom-end">
 *   <button slot="trigger" class="fs-button">Handlinger</button>
 *   <ul class="fs-list" data-variant="plain">…</ul>
 * </fs-popover>
 * ```
 */
export class FsPopover extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    placement: { type: String },
  }

  /** Om panelet er åpent. Speiles, så CSS kan treffe tilstanden. */
  open = false
  /** Hvilken kant panelet henger fra. Standard: `bottom-start`. */
  placement: Placement = "bottom-start"

  private panel?: HTMLElement
  private triggerElement?: HTMLElement

  createRenderRoot() {
    return this
  }

  render() {
    return html`<slot @slotchange=${this.handleSlotChange}></slot>`
  }

  connectedCallback() {
    super.connectedCallback()
    window.addEventListener("resize", this.reposition)
    window.addEventListener("scroll", this.reposition, true)
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.reposition)
    window.removeEventListener("scroll", this.reposition, true)
    super.disconnectedCallback()
  }

  firstUpdated() {
    this.sync()
  }

  updated() {
    this.sync()
  }

  private handleSlotChange = () => {
    this.sync()
  }

  private sync() {
    const trigger = this.querySelector<HTMLElement>("[slot='trigger']")
    const panel = [...this.children].find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.getAttribute("slot") !== "trigger" &&
        child.tagName !== "SLOT",
    )

    if (!trigger || !panel) return

    this.triggerElement = trigger
    this.panel = panel

    if (!panel.id) {
      panel.id = `fs-popover-${Math.random().toString(36).slice(2, 9)}`
    }

    panel.classList.add(POPOVER_CLASS)
    // `manual` og ikke `auto`: vi lukker selv, slik at knappen kan brukes til
    // å lukke igjen uten at nettleseren rekker å lukke først.
    panel.setAttribute("popover", "manual")

    trigger.setAttribute("aria-expanded", String(this.open))
    trigger.setAttribute("aria-controls", panel.id)

    trigger.removeEventListener("click", this.handleTriggerClick)
    trigger.addEventListener("click", this.handleTriggerClick)

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

  private handleTriggerClick = () => {
    this.toggle()
  }

  private handleOutsideClick = (event: Event) => {
    const target = event.target as Node
    if (this.contains(target) || this.panel?.contains(target)) return
    this.hide()
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    this.hide()
    // Fokus tilbake til knappen. Uten dette står fokus på et panel som ikke
    // lenger finnes, og neste tastetrykk starter på toppen av siden.
    this.triggerElement?.focus()
  }

  /** Regner ut hvor panelet skal stå, mot knappens plass på skjermen. */
  private reposition = () => {
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

  /** Åpner panelet. */
  show() {
    if (this.open) return
    this.open = true
    this.dispatchEvent(
      new CustomEvent("popover-toggle", {
        detail: { open: true },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** Lukker panelet. */
  hide() {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(
      new CustomEvent("popover-toggle", {
        detail: { open: false },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** Åpner eller lukker. */
  toggle() {
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
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsPopover)
  }
}
