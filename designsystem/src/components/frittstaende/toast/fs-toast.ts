import { defineElement, HostElement } from "../../host-element.js"
import { TOAST_CLASS, TOAST_CLOSE_CLASS } from "./toast.js"

export const FS_TOAST_TAG = "fs-toast" as const

export const toastColors = ["neutral", "success", "warning", "danger"] as const
export type ToastColor = (typeof toastColors)[number]

export type ShowOptions = {
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
 * Dette er den eneste frittstående komponenten, og den eneste delen av pakken
 * du kaller i stedet for å skrive. Elementet er beholderen, ikke meldingen:
 * du legger det inn én gang i appen og kaller `show()` når noe skal meldes.
 * Meldingene finnes ikke før en hendelse på klienten skaper dem, så det er
 * ingenting for serveren å rendre.
 *
 * Serveren skriver beholderen med `fs.toast()`, og den setter
 * `data-ignore-morph`. Uten det river Datastars morfing meldingene bort ved
 * neste patch, fordi serverens utgave av regionen er tom.
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
export class FsToast extends HostElement {
  static observedAttributes = ["duration", "label"] as const

  /** Standard levetid i millisekunder. `0` lar meldingene bli stående. */
  get duration(): number {
    // `0` er en gyldig verdi og betyr at meldingene blir stående. Uten
    // sjekken mot null her forsvant de likevel etter seks sekunder, og bare
    // `show(..., { duration: 0 })` virket.
    const rå = this.getAttribute("duration")
    if (rå === null) return 6000
    const value = Number(rå)
    return Number.isFinite(value) && value >= 0 ? value : 6000
  }

  set duration(value: number) {
    this.setAttribute("duration", String(value))
  }

  connectedCallback(): void {
    // Skrev serveren regionen med fs.toast(), står alt dette allerede. Her
    // settes det bare når det mangler, så en ren HTML-side uten bygger også
    // får en region skjermleseren forstår.
    if (!this.hasAttribute("role")) this.setAttribute("role", "status")
    if (!this.hasAttribute("aria-live")) {
      this.setAttribute("aria-live", "polite")
    }
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", this.getAttribute("label") ?? "Meldinger")
    }
  }

  attributeChangedCallback(navn: string, _gammel: string, ny: string): void {
    // `label` kan settes etter at elementet står i DOM-en, for eksempel av et
    // rammeverk som fyller inn attributtene i et senere steg.
    if (navn === "label" && ny) this.setAttribute("aria-label", ny)
  }

  /** Viser en melding, og returnerer elementet den ble lagt i. */
  show(message: string, options: ShowOptions = {}): HTMLElement {
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
  dismiss(toast: HTMLElement): void {
    if (!this.contains(toast)) return
    toast.remove()

    this.dispatchEvent(
      new CustomEvent("toast-dismiss", { bubbles: true, composed: true }),
    )
  }

  /** Fjerner alle meldingene. */
  clear(): void {
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
  defineElement(tagName, FsToast)
}
