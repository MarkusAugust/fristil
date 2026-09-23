import { defineElement, HostElement, meldMangel } from "../../host-element.js"
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
export class FsErrorSummary extends HostElement {
  static observedAttributes = ["data-autofocus", "hidden"]

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

  /**
   * Om boksen skal ta fokus når den blir synlig. Standard: ja.
   *
   * Attributtet heter `data-autofocus` og ikke `autofocus`, selv om det
   * siste leser bedre. `autofocus` er en boolsk egenskap på `HTMLElement`,
   * og React 19 setter egenskaper framfor attributter på egendefinerte
   * elementer. `autofocus="false"` ble da til `el.autofocus = "false"`, som
   * er sant, mens attributtet aldri kom i markupen, og avslaget virket ikke.
   * `data-*` sendes videre som attributt i alle React-versjoner.
   */
  private get shouldFocus(): boolean {
    return this.dataset.autofocus !== "false"
  }

  private sync(): void {
    const links = [
      ...this.querySelectorAll<HTMLAnchorElement>("li a[href^='#']"),
    ]

    if (links.length === 0) {
      // En tom boks er ikke en feil: mønsteret er at serveren lar den stå
      // med `hidden` og fyller den når innsendingen feiler. En boks med
      // punkter, men uten lenker til feltene, er noe annet.
      if (this.querySelector("li")) {
        meldMangel(
          this,
          'fant ingen lenker til feltene. Hvert punkt trenger en <a href="#id"> ' +
            "som peker på kontrollen eller ledeteksten, ellers kommer brukeren " +
            "seg ikke fra feilen til feltet.",
        )
      }
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
    if (!target) {
      meldMangel(
        this,
        `lenken peker på #${id}, men det finnes ikke noe element med den ` +
          "id-en. Lenken ruller ingen steder, og fokus blir stående.",
      )
      return
    }

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
  defineElement(tagName, FsErrorSummary)
}
