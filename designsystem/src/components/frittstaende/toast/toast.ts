import { attributes } from "../../css/shared.js"

export const TOAST_CLASS = "fs-toast" as const
export const TOAST_CLOSE_CLASS = "fs-toast__close" as const

export type ToastOptions = {
  /** Tekst som sier hva regionen er. Blir `aria-label`. */
  label?: string
}

export type ToastAttributes = {
  host: {
    role: "status"
    "aria-live": "polite"
    "aria-label": string
    "data-ignore-morph": ""
  }
  toast: { class: typeof TOAST_CLASS }
  close: { class: typeof TOAST_CLOSE_CLASS }
}

/**
 * Attributtene for varselregionen.
 *
 * Regionen er `role="status"` og ikke `role="alert"`. En melding som kommer
 * fordi noe gikk bra skal ikke avbryte det skjermleseren holder på med.
 *
 * `data-ignore-morph` er ikke valgfri. `<fs-toast>` lager og fjerner sine egne
 * elementer inni regionen, og uten attributtet river Datastars morfing dem bort
 * ved neste patch, fordi serverens utgave av regionen er tom. Attributtet må
 * stå i HTML-en serveren sender: komponenten kan ikke sette det på seg selv,
 * siden morfingen leser det fra serverens node.
 */
export const toast = ({
  label = "Varsler",
}: ToastOptions = {}): ToastAttributes => ({
  host: attributes({
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-label": label,
    "data-ignore-morph": "" as const,
  }),
  toast: { class: TOAST_CLASS },
  close: { class: TOAST_CLOSE_CLASS },
})
