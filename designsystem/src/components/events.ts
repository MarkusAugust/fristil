// Generert av designsystem/scripts/generate-vocabulary.ts fra metadata.ts. Ikke rediger.

import type { LtDialog } from "./frame/dialog/lt-dialog.js"
import type { LtErrorSummary } from "./frame/error-summary/lt-error-summary.js"
import type { LtField } from "./frame/field/lt-field.js"
import type { LtPopover } from "./frame/popover/lt-popover.js"
import type { LtSessionTimeout } from "./frame/session-timeout/lt-session-timeout.js"
import type { LtSuggestion } from "./frame/suggestion/lt-suggestion.js"
import type { LtTabs } from "./frame/tabs/lt-tabs.js"
import type { LtConnectionStatus } from "./standalone/connection-status/lt-connection-status.js"
import type { LtToast } from "./standalone/toast/lt-toast.js"

/**
 * Hendelsene web-komponentene sender, med `detail` slik komponenten sender
 * den. Alle bobler, og kommer ut av en skyggerot. `HTMLElementEventMap` og
 * `DocumentEventMap` utvides med dem, så `addEventListener("dialog-toggle",
 * …)` gir `event.detail.open` som `boolean` på ethvert element og på
 * `document`.
 *
 * `HTMLElementTagNameMap` utvides med elementene, så
 * `querySelector("lt-dialog")` gir `LtDialog | null`. Kartet står her, og
 * ikke i hver komponent, fordi hver inngang til web-komponentene tar med
 * denne fila: fra `/register` alene var `querySelector("lt-dialog")` ellers
 * et `Element`, og lytteren på det fikk `Event` uten `detail`.
 */
export interface LtEventMap {
  /** `<lt-tabs>`: Brukeren valgte en fane. `index` teller fra 0. */
  "tab-select": CustomEvent<{ index: number }>
  /** `<lt-popover>`: Brukeren åpnet eller lukket panelet, eller `show()`, `hide()` eller `toggle()` ble kalt. Settes `open` som egenskap eller attributt, kommer ingen hendelse. */
  "popover-toggle": CustomEvent<{ open: boolean }>
  /** `<lt-suggestion>`: Brukeren valgte et forslag. `label` er teksten, `value` koden fra `data-value`, eller teksten når alternativet ikke har noen. Feltet får også `input` og `change`, som om brukeren hadde skrevet det. */
  "suggestion-select": CustomEvent<{ value: string; label: string }>
  /** `<lt-dialog>`: Dialogen åpnet eller lukket seg. `returnValue` er verdien til knappen som lukket den, eller en tom streng. */
  "dialog-toggle": CustomEvent<{ open: boolean; returnValue: string }>
  /** `<lt-toast>`: En melding ble lukket, av brukeren, fordi tiden gikk ut, eller med `dismiss()`. `clear()` sender ingen. */
  "toast-dismiss": CustomEvent<null>
  /** `<lt-session-timeout>`: Varselet åpnet seg. */
  "session-warn": CustomEvent<null>
  /** `<lt-session-timeout>`: Økten fortsetter: brukeren lukket varselet med en annen knapp enn utlogging eller med Escape, eller appen kalte `extend()`. */
  "session-extend": CustomEvent<null>
  /** `<lt-session-timeout>`: Brukeren valgte å logge ut. */
  "session-logout": CustomEvent<null>
  /** `<lt-session-timeout>`: Tiden er ute. */
  "session-expired": CustomEvent<null>
  /** `<lt-session-timeout>`: Brukeren er aktiv. Kommer høyst én gang per `activity-interval`, så appen kan holde serverøkten i live. */
  "session-activity": CustomEvent<null>
  /** `<lt-connection-status>`: Forbindelsen er borte. */
  "connection-lost": CustomEvent<null>
  /** `<lt-connection-status>`: Forbindelsen er tilbake. */
  "connection-restored": CustomEvent<null>
}

declare global {
  interface HTMLElementEventMap extends LtEventMap {}
  interface DocumentEventMap extends LtEventMap {}
  interface HTMLElementTagNameMap {
    "lt-connection-status": LtConnectionStatus
    "lt-dialog": LtDialog
    "lt-error-summary": LtErrorSummary
    "lt-field": LtField
    "lt-popover": LtPopover
    "lt-session-timeout": LtSessionTimeout
    "lt-suggestion": LtSuggestion
    "lt-tabs": LtTabs
    "lt-toast": LtToast
  }
}
