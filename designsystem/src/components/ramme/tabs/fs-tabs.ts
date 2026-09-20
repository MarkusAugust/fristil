import { html, LitElement } from "lit"

export const FS_TABS_TAG = "fs-tabs" as const

export const TABS_LIST_CLASS = "fs-tabs__list" as const
export const TABS_PANEL_CLASS = "fs-tabs__panel" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Kobler en rad med knapper til panelene de hører til.
 *
 * Du skriver knappene og panelene selv. Komponenten setter rollene, holder
 * `aria-selected` og `aria-controls` i synk, skjuler panelene som ikke er
 * valgt, og tar piltastene.
 *
 * Tastaturet er hele grunnen til at komponenten finnes. I en faneliste skal
 * Tab hoppe forbi hele raden og inn i panelet, mens piltastene flytter mellom
 * fanene. Et sett knapper uten denne koblingen gir én tabbestopp per fane, og
 * skjermleseren sier «knapp» der den skulle sagt «fane, 2 av 3, valgt».
 *
 * ```html
 * <fs-tabs>
 *   <div class="fs-tabs__list">
 *     <button>Søknaden</button>
 *     <button>Vedlegg</button>
 *   </div>
 *   <div class="fs-tabs__panel">…</div>
 *   <div class="fs-tabs__panel">…</div>
 * </fs-tabs>
 * ```
 */
export class FsTabs extends LitElement {
  static properties = {
    selected: { type: Number, reflect: true },
    label: { type: String },
  }

  /** Indeksen på fanen som er valgt. */
  selected = 0
  /** Tekst som sier hva fanene velger mellom. Blir `aria-label` på raden. */
  label?: string

  createRenderRoot() {
    return this
  }

  render() {
    return html`<slot @slotchange=${this.handleSlotChange}></slot>`
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

  private get tabs(): HTMLButtonElement[] {
    const list = this.querySelector(`.${TABS_LIST_CLASS}`)
    return list ? [...list.querySelectorAll("button")] : []
  }

  private get panels(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(`.${TABS_PANEL_CLASS}`)]
  }

  private sync() {
    const list = this.querySelector(`.${TABS_LIST_CLASS}`)
    const tabs = this.tabs
    const panels = this.panels

    if (!list || tabs.length === 0) return

    list.setAttribute("role", "tablist")
    if (this.label) list.setAttribute("aria-label", this.label)

    // Er `selected` satt utenfor rekkevidde, rettes den her. Ellers ville
    // attributtet sagt noe annet enn det brukeren ser.
    const valid = Math.min(Math.max(this.selected, 0), tabs.length - 1)
    if (valid !== this.selected) this.selected = valid

    tabs.forEach((tab, index) => {
      const panel = panels[index]
      if (!tab.id) tab.id = uniqueId("fs-tab")
      if (panel && !panel.id) panel.id = uniqueId("fs-tabpanel")

      const isSelected = index === valid

      tab.setAttribute("role", "tab")
      tab.setAttribute("type", "button")
      tab.setAttribute("aria-selected", String(isSelected))
      // Roving tabindex: bare den valgte fanen er en tabbestopp, så Tab går
      // fra raden og rett inn i panelet.
      tab.tabIndex = isSelected ? 0 : -1
      if (panel) tab.setAttribute("aria-controls", panel.id)

      tab.removeEventListener("click", this.handleClick)
      tab.addEventListener("click", this.handleClick)
      tab.removeEventListener("keydown", this.handleKeydown)
      tab.addEventListener("keydown", this.handleKeydown)

      if (panel) {
        panel.setAttribute("role", "tabpanel")
        panel.setAttribute("aria-labelledby", tab.id)
        panel.hidden = !isSelected
        // Panelet får fokus når det ikke har noe å fokusere på selv, ellers
        // hopper Tab rett forbi innholdet som nettopp ble vist.
        panel.tabIndex = 0
      }
    })
  }

  private handleClick = (event: Event) => {
    const index = this.tabs.indexOf(event.currentTarget as HTMLButtonElement)
    if (index >= 0) this.select(index)
  }

  private handleKeydown = (event: KeyboardEvent) => {
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
  select(index: number) {
    if (index === this.selected) return

    this.selected = index
    this.sync()

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
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsTabs)
  }
}
