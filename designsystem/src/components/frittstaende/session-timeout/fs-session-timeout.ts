import {
  SESSION_TIMEOUT_CLASS,
  SESSION_TIMEOUT_DIALOG_CLASS,
} from "./session-timeout.js"

export const FS_SESSION_TIMEOUT_TAG = "fs-session-timeout" as const

/** Sekundene som skal leses opp. Hvert sekund ville vært uutholdelig. */
const ANNONSER_VED = new Set([120, 60, 30, 10])

function klokke(sekunder: number): string {
  const m = Math.floor(sekunder / 60)
  const s = sekunder % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function ord(sekunder: number): string {
  if (sekunder >= 60) {
    const m = Math.round(sekunder / 60)
    return m === 1 ? "ett minutt" : `${m} minutter`
  }
  return sekunder === 1 ? "ett sekund" : `${sekunder} sekunder`
}

/**
 * Varsler før en innlogget økt går ut.
 *
 * Dette er tingen hver store organisasjon bygger selv og gjør feil. Enten
 * kommer det ingen advarsel, og brukeren mister et halvutfylt søknadsskjema,
 * eller så stjeler dialogen fokus midt i en setning, eller så leser
 * skjermleseren nedtellingen hvert sekund.
 *
 * Komponenten er frittstående fordi nedtellingen er klientens klokke. Tallet
 * endrer seg ut fra når brukeren sist rørte tastaturet, og det er ingenting
 * en server kan sende. Den bærer heller ingen verdi inn i en innsending.
 *
 * Dialogen er en ekte `<dialog>` med `showModal()`, så fokusfellen, Escape og
 * topplaget kommer fra nettleseren. Fokus går tilbake dit brukeren var.
 *
 * ```html
 * <fs-session-timeout class="fs-session-timeout" warn-at="1500" expires-at="1800"
 *                     data-ignore-morph></fs-session-timeout>
 * ```
 *
 * ```ts
 * document.querySelector("fs-session-timeout")
 *   .addEventListener("session-extend", () => fetch("/forleng", { method: "POST" }))
 * ```
 */
export class FsSessionTimeout extends HTMLElement {
  static observedAttributes = ["warn-at", "expires-at"]

  private dialog?: HTMLDialogElement
  private countElement?: HTMLElement
  private liveElement?: HTMLElement
  private ticker?: number
  private lastActivity = Date.now()
  private forrigeFokus: HTMLElement | null = null

  /** Sekunder uten aktivitet før varselet kommer. */
  get warnAt(): number {
    return Number(this.getAttribute("warn-at")) || 25 * 60
  }

  /** Sekunder uten aktivitet før økten er ute. */
  get expiresAt(): number {
    return Number(this.getAttribute("expires-at")) || 30 * 60
  }

  connectedCallback(): void {
    this.classList.add(SESSION_TIMEOUT_CLASS)
    this.build()

    for (const navn of ["pointerdown", "keydown", "scroll"] as const) {
      document.addEventListener(navn, this.registerActivity, { passive: true })
    }
    this.ticker = window.setInterval(() => this.tick(), 1000)
  }

  disconnectedCallback(): void {
    for (const navn of ["pointerdown", "keydown", "scroll"] as const) {
      document.removeEventListener(navn, this.registerActivity)
    }
    if (this.ticker) window.clearInterval(this.ticker)
    this.ticker = undefined
  }

  private build(): void {
    if (this.dialog) return

    const dialog = document.createElement("dialog")
    dialog.className = SESSION_TIMEOUT_DIALOG_CLASS
    // alertdialog og ikke dialog: dette er en avbrytelse brukeren ikke ba om,
    // og da skal skjermleseren lese hele innholdet når den åpnes.
    dialog.setAttribute("aria-labelledby", "fs-session-timeout-title")
    dialog.setAttribute("role", "alertdialog")

    const tittel = document.createElement("h2")
    tittel.className = "fs-session-timeout__title"
    tittel.id = "fs-session-timeout-title"
    tittel.textContent = "Du blir snart logget ut"

    const tekst = document.createElement("p")
    tekst.className = "fs-session-timeout__text"
    tekst.append("Vi logger deg ut om ")

    const count = document.createElement("span")
    count.className = "fs-session-timeout__count"
    // Tallet oppdateres hvert sekund. Leses det opp hver gang, blir dialogen
    // ubrukelig med skjermleser, så opplesningen skjer i live-området under.
    count.setAttribute("aria-hidden", "true")
    tekst.append(count, " for å beskytte opplysningene dine.")

    const live = document.createElement("span")
    live.className = "fs-sr-only"
    live.setAttribute("role", "status")
    live.setAttribute("aria-live", "polite")

    const knapper = document.createElement("div")
    knapper.className = "fs-session-timeout__actions"

    const fortsett = document.createElement("button")
    fortsett.type = "button"
    fortsett.className = "fs-button"
    fortsett.textContent = "Fortsett å være innlogget"
    fortsett.addEventListener("click", () => this.extend())

    const loggUt = document.createElement("button")
    loggUt.type = "button"
    loggUt.className = "fs-button"
    loggUt.dataset.variant = "secondary"
    loggUt.textContent = "Logg ut nå"
    loggUt.addEventListener("click", () => {
      this.close()
      this.emit("session-logout")
    })

    knapper.append(fortsett, loggUt)
    dialog.append(tittel, tekst, live, knapper)
    this.append(dialog)

    this.dialog = dialog
    this.countElement = count
    this.liveElement = live
  }

  private registerActivity = (): void => {
    if (this.dialog?.open) return
    this.lastActivity = Date.now()
  }

  private tick(): void {
    const gått = Math.floor((Date.now() - this.lastActivity) / 1000)
    const igjen = this.expiresAt - gått

    if (igjen <= 0) {
      this.close()
      this.emit("session-expired")
      this.lastActivity = Date.now()
      return
    }

    if (gått < this.warnAt) return

    if (!this.dialog?.open) this.open()

    if (this.countElement) this.countElement.textContent = klokke(igjen)
    if (this.liveElement && ANNONSER_VED.has(igjen)) {
      this.liveElement.textContent = `Du blir logget ut om ${ord(igjen)}.`
    }
  }

  private open(): void {
    if (!this.dialog || this.dialog.open) return
    // Fokus skal tilbake dit brukeren var. Uten dette starter neste
    // tastetrykk på toppen av siden, midt i et skjema.
    this.forrigeFokus = document.activeElement as HTMLElement | null
    this.dialog.showModal()
    this.emit("session-warn")
  }

  private close(): void {
    if (!this.dialog?.open) return
    this.dialog.close()
    if (this.liveElement) this.liveElement.textContent = ""
    this.forrigeFokus?.focus()
    this.forrigeFokus = null
  }

  private emit(navn: string): void {
    this.dispatchEvent(new CustomEvent(navn, { bubbles: true, composed: true }))
  }

  /** Forlenger økten og lukker varselet. Kall den når serveren har svart. */
  extend(): void {
    this.lastActivity = Date.now()
    this.close()
    this.emit("session-extend")
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-session-timeout": FsSessionTimeout
  }
}

export function defineFsSessionTimeout(tagName = FS_SESSION_TIMEOUT_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsSessionTimeout)
  }
}
