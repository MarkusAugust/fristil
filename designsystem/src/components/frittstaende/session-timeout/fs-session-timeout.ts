import {
  defineElement,
  HostElement,
  setText,
  warnAboutMarkup,
  whenUpgraded,
} from "../../host-element.js"
import {
  SESSION_TIMEOUT_CLASS,
  SESSION_TIMEOUT_DIALOG_CLASS,
} from "./session-timeout.js"

export const FS_SESSION_TIMEOUT_TAG = "fs-session-timeout" as const

const DEFAULT_WARN_AT = 25 * 60
const DEFAULT_EXPIRES_AT = 30 * 60

/** Sekundene som skal leses opp underveis. Hvert sekund ville vært uutholdelig. */
const ANNOUNCE_AT = new Set([120, 60, 30, 10])

/**
 * `scroll` bobler ikke, så den fanges i fangstfasen. Uten det telte rulling
 * i en tabell eller et panel ikke som aktivitet, bare rulling av selve siden.
 */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"] as const
const ACTIVITY_OPTIONS = { passive: true, capture: true } as const

/** Én id per instans. To varsler på samme side ga duplikat-id på overskriften. */
let instances = 0

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function words(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.round(seconds / 60)
    return m === 1 ? "ett minutt" : `${m} minutter`
  }
  return seconds === 1 ? "ett sekund" : `${seconds} sekunder`
}

function isSeconds(raw: string | null): boolean {
  if (raw === null) return true
  const value = Number(raw)
  return raw.trim() !== "" && Number.isFinite(value) && value >= 0
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
 * topplaget kommer fra nettleseren. Escape regnes som «jeg er her», og
 * forlenger økten på samme måte som knappen. Fokus går tilbake dit brukeren
 * var.
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
export class FsSessionTimeout extends HostElement {
  static observedAttributes = ["warn-at", "expires-at"] as const

  private dialog?: HTMLDialogElement
  private countElement?: HTMLElement
  private liveElement?: HTMLElement
  private ticker?: number
  private lastActivity = Date.now()
  private previousFocus: HTMLElement | null = null
  /**
   * Sant fra økten gikk ut, eller brukeren valgte å logge ut, til `extend()`
   * eller `reset()` er kalt.
   *
   * Uten dette startet syklusen på nytt av seg selv, og en app som ikke
   * navigerte bort fikk ny dialog og ny `session-expired` hvert
   * `expires-at`-sekund, for en økt som alt var borte.
   */
  private expired = false
  private readonly titleId = `fs-session-timeout-title-${++instances}`

  /** Sekunder uten aktivitet før varselet kommer. */
  get warnAt(): number {
    return this.readSeconds("warn-at", DEFAULT_WARN_AT)
  }

  set warnAt(value: number) {
    this.setAttribute("warn-at", String(value))
  }

  /** Sekunder uten aktivitet før økten er ute. */
  get expiresAt(): number {
    return this.readSeconds("expires-at", DEFAULT_EXPIRES_AT)
  }

  set expiresAt(value: number) {
    this.setAttribute("expires-at", String(value))
  }

  connectedCallback(): void {
    this.classList.add(SESSION_TIMEOUT_CLASS)

    // Dialogen bygges først når den skal vises, ikke her. Lagde vi den med
    // én gang, sto den i DOM-en før React rakk å hydrere, og React fant et
    // element den ikke hadde rendret. `<fs-toast>` og
    // `<fs-connection-status>` gjør det på samme måte.
    for (const name of ACTIVITY_EVENTS) {
      document.addEventListener(name, this.registerActivity, ACTIVITY_OPTIONS)
    }
    this.ticker = window.setInterval(() => this.tick(), 1000)
    this.validate()
  }

  disconnectedCallback(): void {
    for (const name of ACTIVITY_EVENTS) {
      document.removeEventListener(
        name,
        this.registerActivity,
        ACTIVITY_OPTIONS,
      )
    }
    if (this.ticker) window.clearInterval(this.ticker)
    this.ticker = undefined
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.validate()
  }

  private readSeconds(name: string, fallback: number): number {
    const raw = this.getAttribute(name)
    return isSeconds(raw) && raw !== null ? Number(raw) : fallback
  }

  /**
   * Sier fra om tall som ikke henger sammen, framfor å tie.
   *
   * `warn-at="1800" expires-at="1500"` ga `session-expired` uten at
   * dialogen noen gang ble vist, og et negativt tall ga dialog i første
   * tikk. Standardverdiene brukes når et tall ikke er et tall.
   */
  private validate(): void {
    warnAboutMarkup(
      this,
      "har warn-at eller expires-at som ikke er et tall større enn eller " +
        "lik null. Standardverdiene brukes i stedet.",
      () =>
        !isSeconds(this.getAttribute("warn-at")) ||
        !isSeconds(this.getAttribute("expires-at")),
    )
    warnAboutMarkup(
      this,
      "har warn-at som ikke er mindre enn expires-at, så varselet kommer " +
        "aldri før økten er ute.",
      () => this.warnAt >= this.expiresAt,
    )
  }

  private build(): void {
    if (this.dialog) return

    const dialog = document.createElement("dialog")
    dialog.className = SESSION_TIMEOUT_DIALOG_CLASS
    // alertdialog og ikke dialog: dette er en avbrytelse brukeren ikke ba om,
    // og da skal skjermleseren lese hele innholdet når den åpnes.
    dialog.setAttribute("aria-labelledby", this.titleId)
    dialog.setAttribute("role", "alertdialog")

    const title = document.createElement("h2")
    title.className = "fs-session-timeout__title"
    title.id = this.titleId
    title.textContent = "Du blir snart logget ut"

    const text = document.createElement("p")
    text.className = "fs-session-timeout__text"
    text.append("Vi logger deg ut om ")

    const count = document.createElement("span")
    count.className = "fs-session-timeout__count"
    // Tallet oppdateres hvert sekund. Leses det opp hver gang, blir dialogen
    // ubrukelig med skjermleser, så opplesningen skjer i live-området under.
    count.setAttribute("aria-hidden", "true")
    text.append(count, " for å beskytte opplysningene dine.")

    const live = document.createElement("span")
    live.className = "fs-sr-only"
    live.setAttribute("role", "status")
    live.setAttribute("aria-live", "polite")

    const actions = document.createElement("div")
    actions.className = "fs-session-timeout__actions"

    const stay = document.createElement("button")
    stay.type = "button"
    stay.className = "fs-button"
    stay.textContent = "Fortsett å være innlogget"
    stay.addEventListener("click", () => this.extend())

    const logout = document.createElement("button")
    logout.type = "button"
    logout.className = "fs-button"
    logout.dataset.variant = "secondary"
    logout.textContent = "Logg ut nå"
    logout.addEventListener("click", () => {
      // Som ved utløp: komponenten står stille til `extend()` eller
      // `reset()`. Ellers så neste tikk en lukket dialog etter
      // varselgrensen og åpnet den igjen mens appen logget ut.
      this.expired = true
      this.closeDialog("logout")
      this.emit("session-logout")
    })

    /*
     * Escape kommer fra nettleseren, og komponenten må få vite det. Uten
     * dette så neste tikk en lukket dialog etter varselgrensen og åpnet den
     * igjen, ett sekund etter Escape, hver gang. `returnValue` skiller
     * komponentens egne lukkinger fra brukerens: de egne sender en grunn,
     * Escape lar den stå tom. Det er robust mot at `close` er køet, i
     * motsetning til et flagg som er tilbakestilt før hendelsen kommer.
     */
    dialog.addEventListener("close", () => {
      if (this.liveElement) this.liveElement.textContent = ""
      this.previousFocus?.focus()
      this.previousFocus = null
      if (dialog.returnValue === "") this.extend()
    })

    actions.append(stay, logout)
    dialog.append(title, text, live, actions)
    this.append(dialog)

    this.dialog = dialog
    this.countElement = count
    this.liveElement = live
  }

  private registerActivity = (): void => {
    if (this.dialog?.open || this.expired) return
    this.lastActivity = Date.now()
  }

  private tick(): void {
    if (this.expired) return

    const elapsed = Math.floor((Date.now() - this.lastActivity) / 1000)
    const left = this.expiresAt - elapsed

    if (left <= 0) {
      // Flagget først, så lukkingen ikke leses som Escape og forlenger.
      this.expired = true
      this.closeDialog("expired")
      this.emit("session-expired")
      return
    }

    if (elapsed < this.warnAt) return

    if (!this.dialog?.open) this.openDialog(left)

    if (this.countElement) setText(this.countElement, clock(left))
    if (this.liveElement && ANNOUNCE_AT.has(left)) {
      setText(this.liveElement, `Du blir logget ut om ${words(left)}.`)
    }
  }

  private openDialog(left: number): void {
    this.build()
    if (!this.dialog || this.dialog.open) return
    // Fokus skal tilbake dit brukeren var. Uten dette starter neste
    // tastetrykk på toppen av siden, midt i et skjema.
    this.previousFocus = document.activeElement as HTMLElement | null
    /*
     * Teksten skal stå før dialogen åpnes, siden `alertdialog` leses opp i
     * det den kommer. Tallet i avsnittet er `aria-hidden`, så uten dette
     * hørte skjermleseren «Vi logger deg ut om  for å beskytte opplysningene
     * dine», og første tall kom først ved neste terskel, minutter senere.
     */
    if (this.countElement) setText(this.countElement, clock(left))
    if (this.liveElement) {
      setText(this.liveElement, `Du blir logget ut om ${words(left)}.`)
    }
    this.dialog.returnValue = ""
    this.dialog.showModal()
    this.emit("session-warn")
  }

  private closeDialog(reason: string): void {
    if (!this.dialog?.open) return
    this.dialog.close(reason)
  }

  private emit(name: string): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }))
  }

  /** Forlenger økten og lukker varselet. Kall den når serveren har svart. */
  extend(): void {
    this.reset()
    this.emit("session-extend")
  }

  /**
   * Nullstiller klokka uten å sende `session-extend`.
   *
   * For en app som alt har forlenget økten på egen hånd, som når en
   * autolagring gikk gjennom. `extend()` ville bedt serveren om det en gang
   * til.
   */
  reset(): void {
    this.lastActivity = Date.now()
    this.expired = false
    this.closeDialog("extend")
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-session-timeout": FsSessionTimeout
  }
}

export function defineFsSessionTimeout(tagName = FS_SESSION_TIMEOUT_TAG): void {
  defineElement(tagName, FsSessionTimeout)
}

/** `element.extend()`, men venter først på registreringen. Se `whenUpgraded`. */
export async function extendSession(element: Element): Promise<void> {
  const session = await whenUpgraded<FsSessionTimeout>(element)
  session.extend()
}

/** `element.reset()`, men venter først på registreringen. Se `whenUpgraded`. */
export async function resetSession(element: Element): Promise<void> {
  const session = await whenUpgraded<FsSessionTimeout>(element)
  session.reset()
}
