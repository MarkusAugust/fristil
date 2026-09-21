export const FS_ERROR_SUMMARY_TAG = "fs-error-summary" as const

/**
 * Sender brukeren fra en feil i oppsummeringen til feltet som feilet.
 *
 * Serveren skriver hele boksen med `fs.errorSummary()`: klassen, `role`,
 * `tabindex`, overskriften og lista. Komponenten lager ingenting. Den gjorde
 * det før, og da forsvant både klassen og overskriften ved første morfing i
 * Datastar, uten å komme tilbake.
 *
 * Det som er igjen er to ting nettleseren ikke gjør selv:
 *
 * 1. Fokus flyttes til boksen når den kommer til syne, så den som hører siden
 *    får vite at innsendingen stoppet.
 * 2. Fokus gis til selve kontrollen når en lenke følges. En vanlig ankerlenke
 *    ruller bare dit, og neste tastetrykk fortsetter der fokus sto før.
 *
 * ```html
 * <fs-error-summary class="fs-error-summary" role="alert" tabindex="-1">
 *   <h2 class="fs-error-summary__title">Skjemaet har to feil</h2>
 *   <ul class="fs-list">
 *     <li><a href="#epost">Skriv en gyldig e-postadresse</a></li>
 *   </ul>
 * </fs-error-summary>
 * ```
 */
export class FsErrorSummary extends HTMLElement {
  static observedAttributes = ["autofocus", "hidden"]

  private hasFocused = false
  private observer?: MutationObserver
  private readonly links = new Set<HTMLAnchorElement>()

  connectedCallback(): void {
    // Feilene kommer og går mens brukeren retter, og `slotchange` melder ikke
    // fra i vanlig DOM. Bare childList: komponenten setter ingen attributter
    // på barna, så observatøren kan ikke utløse seg selv.
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, { childList: true, subtree: true })
    this.sync()
  }

  attributeChangedCallback(): void {
    // Serveren kan sende boksen skjult og senere bare ta bort `hidden` på
    // den samme noden. Uten dette får en oppsummering som nettopp ble synlig
    // aldri fokus, og det er hele grunnen til at komponenten finnes.
    if (this.isConnected) this.sync()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    for (const link of this.links) {
      link.removeEventListener("click", this.handleLinkClick)
    }
    this.links.clear()
  }

  private get shouldFocus(): boolean {
    const value = this.getAttribute("autofocus")
    return value !== "false"
  }

  private sync(): void {
    const links = [
      ...this.querySelectorAll<HTMLAnchorElement>("li a[href^='#']"),
    ]

    if (links.length === 0) {
      this.hasFocused = false
      return
    }

    for (const link of links) {
      if (this.links.has(link)) continue
      link.addEventListener("click", this.handleLinkClick)
      this.links.add(link)
    }

    // Skjuler serveren boksen igjen, er den innsendingen over. Uten denne
    // nullstillingen tok boksen fokus bare første gang: mønsteret i en
    // Datastar-app er at lista står med de samme lenkene hele veien og bare
    // `hidden` slås av og på, så «har jeg flyttet fokus hit før» er ikke et
    // svar på om dette er en ny innsending.
    if (this.hidden) {
      this.hasFocused = false
      return
    }

    // Er boksen synlig nå, og vi ikke har flyttet fokus hit ennå, er det
    // denne innsendingen som feilet.
    if (this.shouldFocus && !this.hasFocused) {
      this.hasFocused = true
      this.focus()
    }
  }

  private handleLinkClick = (event: Event): void => {
    const link = event.currentTarget as HTMLAnchorElement
    const id = link.getAttribute("href")?.slice(1)
    if (!id) return

    // Oppslaget går mot rota komponenten selv står i, ikke mot `document`.
    // Ligger skjemaet i en skyggerot, som i en forhåndsvisning eller inne i
    // en annen komponent, finner `document.getElementById` ingenting, og
    // lenken blir en vanlig ankerlenke uten fokusflytting.
    const rot = this.getRootNode() as Document | ShadowRoot
    const target = rot.getElementById?.(id) ?? document.getElementById(id)
    if (!target) return

    event.preventDefault()

    // Er lenken til en ledetekst, skal fokus til kontrollen den peker på.
    const control =
      target instanceof HTMLLabelElement && target.htmlFor
        ? (rot.getElementById?.(target.htmlFor) ??
          document.getElementById(target.htmlFor))
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
