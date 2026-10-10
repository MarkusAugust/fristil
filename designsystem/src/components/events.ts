// Generert av editor/scripts/generate.ts fra editor/metadata.ts. Ikke rediger.

/**
 * Hendelsene web-komponentene sender, med `detail` slik den er. Alle bobler
 * og krysser skyggegrenser. `HTMLElementEventMap` utvides med dem, så
 * `addEventListener("dialog-toggle", …)` gir `event.detail.open` som
 * `boolean` på ethvert element.
 */
export interface FsEventMap {
  /** `<fs-tabs>`: Brukeren valgte en fane. `index` teller fra 0. */
  "tab-select": CustomEvent<{ index: number }>
  /** `<fs-popover>`: Panelet åpnet eller lukket seg. */
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
}
