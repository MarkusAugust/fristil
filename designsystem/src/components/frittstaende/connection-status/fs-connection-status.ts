import { defineElement, HostElement } from "../../host-element.js"
import {
  CONNECTION_STATUS_BAR_CLASS,
  CONNECTION_STATUS_CLASS,
} from "./connection-status.js"

export const FS_CONNECTION_STATUS_TAG = "fs-connection-status" as const

const STANDARD_OFFLINE = "Ingen forbindelse. Det du skriver blir ikke lagret."
const STANDARD_ONLINE = "Forbindelsen er tilbake."

/** Hvor lenge «tilbake på nett» blir stående. */
const KVITTERING_MS = 4000

/**
 * Sier fra når forbindelsen til serveren er borte.
 *
 * Serveren kan per definisjon ikke fortelle deg dette. Er den utilgjengelig,
 * kommer det ingenting derfra. Derfor er dette en frittstående komponent som
 * eier alt innholdet sitt.
 *
 * Den er ikke pynt i en app som henter innhold fra serveren underveis. En
 * side som mister strømmen sin ser helt normal ut, men er frosset, og en
 * bruker som fyller ut et skjema inn i en død forbindelse mister alt.
 *
 * `navigator.onLine` sier bare om maskinen har et nettverk, ikke om serveren
 * svarer. Derfor finnes `reportFailure()` og `reportSuccess()`, som appen
 * kaller når et kall feiler eller lykkes.
 *
 * ```ts
 * const status = document.querySelector("fs-connection-status")
 * try {
 *   await fetch("/api/lagre", { method: "POST", body })
 *   status.reportSuccess()
 * } catch {
 *   status.reportFailure()
 * }
 * ```
 */
export class FsConnectionStatus extends HostElement {
  static observedAttributes = ["offline-text", "online-text"] as const

  private bar?: HTMLElement
  private timer?: number
  /** Sant når appen har meldt at et kall feilet, uavhengig av navigator. */
  private failing = false

  get offlineText(): string {
    return this.getAttribute("offline-text") ?? STANDARD_OFFLINE
  }

  get onlineText(): string {
    return this.getAttribute("online-text") ?? STANDARD_ONLINE
  }

  connectedCallback(): void {
    this.classList.add(CONNECTION_STATUS_CLASS)
    window.addEventListener("offline", this.handleOffline)
    window.addEventListener("online", this.handleOnline)
    if (!navigator.onLine) this.showOffline()
  }

  disconnectedCallback(): void {
    window.removeEventListener("offline", this.handleOffline)
    window.removeEventListener("online", this.handleOnline)
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = undefined
  }

  private ensureBar(): HTMLElement {
    if (this.bar) return this.bar

    const bar = document.createElement("div")
    bar.className = CONNECTION_STATUS_BAR_CLASS
    // polite og ikke assertive: beskjeden er viktig, men skal ikke avbryte
    // midt i et ord. Den blir stående til forbindelsen er tilbake.
    bar.setAttribute("role", "status")
    bar.setAttribute("aria-live", "polite")
    this.append(bar)
    this.bar = bar
    return bar
  }

  private showOffline(): void {
    if (this.timer) window.clearTimeout(this.timer)
    const bar = this.ensureBar()
    bar.dataset.state = "offline"
    bar.textContent = this.offlineText
    this.emit("connection-lost")
  }

  private showOnline(): void {
    if (!this.bar) return
    const bar = this.bar
    bar.dataset.state = "online"
    bar.textContent = this.onlineText
    this.emit("connection-restored")

    this.timer = window.setTimeout(() => {
      bar.remove()
      this.bar = undefined
    }, KVITTERING_MS)
  }

  private handleOffline = (): void => {
    this.showOffline()
  }

  private handleOnline = (): void => {
    if (this.failing) return
    this.showOnline()
  }

  private emit(navn: string): void {
    this.dispatchEvent(new CustomEvent(navn, { bubbles: true, composed: true }))
  }

  /** Meld fra at et kall til serveren feilet. */
  reportFailure(): void {
    if (this.failing) return
    this.failing = true
    this.showOffline()
  }

  /** Meld fra at et kall til serveren lyktes igjen. */
  reportSuccess(): void {
    if (!this.failing) return
    this.failing = false
    this.showOnline()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-connection-status": FsConnectionStatus
  }
}

export function defineFsConnectionStatus(
  tagName = FS_CONNECTION_STATUS_TAG,
): void {
  defineElement(tagName, FsConnectionStatus)
}
