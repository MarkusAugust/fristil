import { attributes } from "../../css/shared.js"

/**
 * Klassen på verten, altså regionen meldingene ligger i.
 *
 * Fram til 0.28.0 var dette klassen på hver melding, og regionen ble stylet
 * med elementnavnet. Registrert under et annet navn, med
 * `defineFsToast("min-toast")`, mistet den da plasseringen sin.
 */
export const TOAST_CLASS = "fs-toast" as const
export const TOAST_MESSAGE_CLASS = "fs-toast__message" as const
export const TOAST_CLOSE_CLASS = "fs-toast__close" as const

export type ToastOptions = {
  /** Tekst som sier hva regionen er. Blir `aria-label`. */
  label?: string
}

export type ToastAttributes = {
  host: {
    class: typeof TOAST_CLASS
    role: "status"
    "aria-live": "polite"
    "aria-atomic": "false"
    "aria-label": string
    "data-ignore-morph": ""
  }
  message: { class: typeof TOAST_MESSAGE_CLASS }
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
    class: TOAST_CLASS,
    role: "status" as const,
    "aria-live": "polite" as const,
    // `status` er atomisk som standard, og da leses hele stabelen opp på
    // nytt for hver melding som kommer til.
    "aria-atomic": "false" as const,
    "aria-label": label,
    "data-ignore-morph": "" as const,
  }),
  message: attributes({ class: TOAST_MESSAGE_CLASS }),
  close: attributes({ class: TOAST_CLOSE_CLASS }),
})
