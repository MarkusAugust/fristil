import { html, LitElement } from "lit"

export const FS_ERROR_SUMMARY_TAG = "fs-error-summary" as const

export const ERROR_SUMMARY_CLASS = "fs-error-summary" as const
export const ERROR_SUMMARY_TITLE_CLASS = "fs-error-summary__title" as const

/**
 * Samler feilene i et skjema og sender brukeren til feltet som feilet.
 *
 * Du skriver lista med feil selv, som lenker til id-en på hvert felt.
 * Komponenten gjør tre ting som er lette å glemme, og som avgjør om
 * oppsummeringen er til nytte:
 *
 * 1. Flytter fokus til boksen når den kommer til syne, så den som hører siden
 *    får vite at innsendingen stoppet.
 * 2. Gir fokus til selve kontrollen når en lenke følges. En vanlig ankerlenke
 *    ruller bare dit, og neste tastetrykk fortsetter der fokus sto før.
 * 3. Holder boksen skjult mens lista er tom, så en tom overskrift ikke blir
 *    stående i skjemaet.
 *
 * ```html
 * <fs-error-summary heading="Skjemaet har to feil">
 *   <ul class="fs-list">
 *     <li><a href="#epost">Skriv en gyldig e-postadresse</a></li>
 *   </ul>
 * </fs-error-summary>
 * ```
 */
export class FsErrorSummary extends LitElement {
  static properties = {
    heading: { type: String },
    autofocus: { type: Boolean, reflect: true },
  }

  /** Overskriften over lista. */
  heading = "Skjemaet har feil"
  /** Flytt fokus hit når boksen kommer til syne. Standard: på. */
  autofocus = true

  private hasFocused = false

  createRenderRoot() {
    return this
  }

  render() {
    return html`<slot @slotchange=${this.handleSlotChange}></slot>`
  }

  /**
   * Ser etter at lista med feil endrer seg.
   *
   * Komponenten rendrer i vanlig DOM, og da melder ikke `slotchange` fra når
   * konsumenten bytter ut innholdet. Feilene kommer og går mens brukeren
   * fyller ut skjemaet, så endringen må observeres.
   */
  private observer?: MutationObserver
  private syncing = false

  connectedCallback() {
    super.connectedCallback()
    this.observer = new MutationObserver(() => {
      if (!this.syncing) this.sync()
    })
    this.observer.observe(this, { childList: true, subtree: true })
  }

  disconnectedCallback() {
    this.observer?.disconnect()
    this.observer = undefined
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

  private get items(): HTMLAnchorElement[] {
    return [...this.querySelectorAll<HTMLAnchorElement>("li a[href^='#']")]
  }

  private sync() {
    if (this.syncing) return
    this.syncing = true

    try {
      const links = this.items
      const empty = links.length === 0

      this.hidden = empty
      if (empty) {
        this.hasFocused = false
        return
      }

      // Boksen er selve elementet. Vi flytter ikke konsumentens markup inn i
      // et omslag: da ville Lit-delen vår og innholdet byttet plass i DOM-en.
      this.classList.add(ERROR_SUMMARY_CLASS)
      this.setAttribute("role", "alert")
      this.tabIndex = -1

      let title = this.querySelector<HTMLElement>(
        `.${ERROR_SUMMARY_TITLE_CLASS}`,
      )
      if (!title) {
        title = document.createElement("h2")
        title.className = ERROR_SUMMARY_TITLE_CLASS
        this.prepend(title)
      }
      if (!title.textContent?.trim()) title.textContent = this.heading

      for (const link of links) {
        link.removeEventListener("click", this.handleLinkClick)
        link.addEventListener("click", this.handleLinkClick)
      }

      if (this.autofocus && !this.hasFocused) {
        this.hasFocused = true
        this.focus()
      }
    } finally {
      this.syncing = false
    }
  }

  private handleLinkClick = (event: Event) => {
    const link = event.currentTarget as HTMLAnchorElement
    const id = link.getAttribute("href")?.slice(1)
    if (!id) return

    const target = document.getElementById(id)
    if (!target) return

    event.preventDefault()

    // Er lenken til en ledetekst, skal fokus til kontrollen den peker på.
    const control =
      target instanceof HTMLLabelElement && target.htmlFor
        ? document.getElementById(target.htmlFor)
        : target

    const focusable = control ?? target
    if (!focusable.hasAttribute("tabindex") && !isFocusable(focusable)) {
      focusable.setAttribute("tabindex", "-1")
    }

    focusable.focus()
    focusable.scrollIntoView({ block: "center", behavior: "smooth" })
  }
}

function isFocusable(element: Element): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLButtonElement ||
    element instanceof HTMLAnchorElement
  )
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-error-summary": FsErrorSummary
  }
}

export function defineFsErrorSummary(tagName = FS_ERROR_SUMMARY_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsErrorSummary)
  }
}
