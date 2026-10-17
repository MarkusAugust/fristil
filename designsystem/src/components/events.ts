// Generert av designsystem/scripts/generate-ordforrad.ts fra metadata.ts. Ikke rediger.

import type { FsConnectionStatus } from "./frittstaende/connection-status/fs-connection-status.js"
import type { FsToast } from "./frittstaende/toast/fs-toast.js"
import type { FsDialog } from "./ramme/dialog/fs-dialog.js"
import type { FsErrorSummary } from "./ramme/error-summary/fs-error-summary.js"
import type { FsField } from "./ramme/field/fs-field.js"
import type { FsPopover } from "./ramme/popover/fs-popover.js"
import type { FsSessionTimeout } from "./ramme/session-timeout/fs-session-timeout.js"
import type { FsSuggestion } from "./ramme/suggestion/fs-suggestion.js"
import type { FsTabs } from "./ramme/tabs/fs-tabs.js"

/**
 * Hendelsene web-komponentene sender, med `detail` slik komponenten sender
 * den. Alle bobler, og kommer ut av en skyggerot. `HTMLElementEventMap` og
 * `DocumentEventMap` utvides med dem, så `addEventListener("dialog-toggle",
 * …)` gir `event.detail.open` som `boolean` på ethvert element og på
 * `document`.
 *
 * `HTMLElementTagNameMap` utvides med elementene, så
 * `querySelector("fs-dialog")` gir `FsDialog | null`. Kartet står her, og
 * ikke i hver komponent, fordi hver inngang til web-komponentene tar med
 * denne fila: fra `/register` alene var `querySelector("fs-dialog")` ellers
 * et `Element`, og lytteren på det fikk `Event` uten `detail`.
 */
export interface FsEventMap {
  /** `<fs-tabs>`: Brukeren valgte en fane. `index` teller fra 0. */
  "tab-select": CustomEvent<{ index: number }>
  /** `<fs-popover>`: Brukeren åpnet eller lukket panelet, eller `show()`, `hide()` eller `toggle()` ble kalt. Settes `open` som egenskap eller attributt, kommer ingen hendelse. */
  "popover-toggle": CustomEvent<{ open: boolean }>
  /** `<fs-suggestion>`: Brukeren valgte et forslag. Feltet får også `input` og `change`, som om brukeren hadde skrevet det. */
  "suggestion-select": CustomEvent<{ value: string }>
  /** `<fs-dialog>`: Dialogen åpnet eller lukket seg. `returnValue` er verdien til knappen som lukket den, eller en tom streng. */
  "dialog-toggle": CustomEvent<{ open: boolean; returnValue: string }>
  /** `<fs-toast>`: En melding ble lukket, av brukeren, fordi tiden gikk ut, eller med `dismiss()`. `clear()` sender ingen. */
  "toast-dismiss": CustomEvent<null>
  /** `<fs-session-timeout>`: Varselet åpnet seg. */
  "session-warn": CustomEvent<null>
  /** `<fs-session-timeout>`: Økten fortsetter: brukeren lukket varselet med en annen knapp enn utlogging eller med Escape, eller appen kalte `extend()`. */
  "session-extend": CustomEvent<null>
  /** `<fs-session-timeout>`: Brukeren valgte å logge ut. */
  "session-logout": CustomEvent<null>
  /** `<fs-session-timeout>`: Tiden er ute. */
  "session-expired": CustomEvent<null>
  /** `<fs-session-timeout>`: Brukeren er aktiv. Kommer høyst én gang per `activity-interval`, så appen kan holde serverøkten i live. */
  "session-activity": CustomEvent<null>
  /** `<fs-connection-status>`: Forbindelsen er borte. */
  "connection-lost": CustomEvent<null>
  /** `<fs-connection-status>`: Forbindelsen er tilbake. */
  "connection-restored": CustomEvent<null>
}

declare global {
  interface HTMLElementEventMap extends FsEventMap {}
  interface DocumentEventMap extends FsEventMap {}
  interface HTMLElementTagNameMap {
    "fs-connection-status": FsConnectionStatus
    "fs-dialog": FsDialog
    "fs-error-summary": FsErrorSummary
    "fs-field": FsField
    "fs-popover": FsPopover
    "fs-session-timeout": FsSessionTimeout
    "fs-suggestion": FsSuggestion
    "fs-tabs": FsTabs
    "fs-toast": FsToast
  }
}
