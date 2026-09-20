import { html, LitElement } from "lit"

export const FS_TOAST_TAG = "fs-toast" as const

export const TOAST_CLASS = "fs-toast" as const
export const TOAST_CLOSE_CLASS = "fs-toast__close" as const

export const toastColors = ["neutral", "success", "warning", "danger"] as const
export type ToastColor = (typeof toastColors)[number]

export type ToastOptions = {
  /** Hva meldingen betyr. Standard: `neutral`. */
  color?: ToastColor
  /** Millisekunder før meldingen forsvinner. `0` lar den bli stående. */
  duration?: number
  /** Tekst på lukkeknappen. Standard: «Lukk melding». */
  closeLabel?: string
}

/**
 * Køen av korte meldinger i hjørnet av skjermen.
 *
 * Elementet er beholderen, ikke meldingen. Du legger det inn én gang i
 * appen og kaller `show()` når noe skal meldes.
 *
 * Beholderen er en `role="status"`-region, ikke `role="alert"`. En melding
 * som dukker opp i hjørnet skal ikke avbryte det skjermleseren holder på med;
 * er beskjeden så viktig at den må avbryte, hører den hjemme i en
 * [Alert](../../css/alert/alert.js) i selve siden.
 *
 * Meldinger som forsvinner av seg selv er en tilgjengelighetsfelle: den som
 * leser sakte eller bruker forstørrelse rekker ikke lese dem. Derfor er
 * lukkeknappen alltid der, og tiden stopper mens musa eller fokus er i
 * meldingen.
 *
 * ```ts
 * document.querySelector("fs-toast").show("Søknaden er sendt", {
 *   color: "success",
 * })
 * ```
 */
export class FsToast extends LitElement {
  static properties = {
    duration: { type: Number },
    label: { type: String },
  }

  /** Standard levetid i millisekunder. `0` lar meldingene bli stående. */
  duration = 6000
  /** Tekst som sier hva regionen er. Blir `aria-label`. */
  label = "Meldinger"

  createRenderRoot() {
    return this
  }

  render() {
    return html`<slot></slot>`
  }

  connectedCallback() {
    super.connectedCallback()
    this.setAttribute("role", "status")
    this.setAttribute("aria-live", "polite")
    this.setAttribute("aria-label", this.label)
  }

  updated() {
    // `label` kan settes etter at elementet står i DOM-en, for eksempel av et
    // rammeverk som fyller inn attributtene i et senere steg.
    this.setAttribute("aria-label", this.label)
  }

  /** Viser en melding, og returnerer elementet den ble lagt i. */
  show(message: string, options: ToastOptions = {}): HTMLElement {
    const {
      color = "neutral",
      duration = this.duration,
      closeLabel = "Lukk melding",
    } = options

    const toast = document.createElement("div")
    toast.className = TOAST_CLASS
    if (color !== "neutral") toast.dataset.color = color

    const text = document.createElement("span")
    text.textContent = message
    toast.append(text)

    const close = document.createElement("button")
    close.type = "button"
    close.className = TOAST_CLOSE_CLASS
    close.setAttribute("aria-label", closeLabel)
    close.textContent = "×"
    close.addEventListener("click", () => this.dismiss(toast))
    toast.append(close)

    this.prepend(toast)

    if (duration > 0) {
      let timer = window.setTimeout(() => this.dismiss(toast), duration)

      // Tiden stopper mens brukeren leser eller er på vei til lukkeknappen.
      const pause = () => window.clearTimeout(timer)
      const resume = () => {
        timer = window.setTimeout(() => this.dismiss(toast), duration)
      }

      toast.addEventListener("mouseenter", pause)
      toast.addEventListener("mouseleave", resume)
      toast.addEventListener("focusin", pause)
      toast.addEventListener("focusout", resume)
    }

    return toast
  }

  /** Fjerner en melding. */
  dismiss(toast: HTMLElement) {
    if (!this.contains(toast)) return
    toast.remove()

    this.dispatchEvent(
      new CustomEvent("toast-dismiss", { bubbles: true, composed: true }),
    )
  }

  /** Fjerner alle meldingene. */
  clear() {
    for (const toast of this.querySelectorAll(`.${TOAST_CLASS}`)) {
      toast.remove()
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-toast": FsToast
  }
}

export function defineFsToast(tagName = FS_TOAST_TAG): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FsToast)
  }
}
