/**
 * Registrerer alle web-komponentene i ett kall.
 *
 * Hver komponent har sin egen `defineLt*`, og en app som bare bruker feltet
 * kan nøye seg med `defineLtField()` og holde resten utenfor det som bygges. Men de
 * fleste appene bruker flere, og spilldemoen sto med sju kall i en
 * `useEffect`, altså etter første tegning. Da er elementene i markupen
 * vanlige `HTMLElement` i det React tegner dem, og det første kallet på
 * `reportSuccess()` kom før effekten. Ett kall, ved import, lukker gapet.
 *
 * Funksjonen gjør ingenting på en server, som de enkelte gjør, så den kan stå
 * øverst i en modul som kjøres begge steder.
 */

import { defineLtDialog } from "./components/frame/dialog/lt-dialog.js"
import { defineLtErrorSummary } from "./components/frame/error-summary/lt-error-summary.js"
import { defineLtField } from "./components/frame/field/lt-field.js"
import { defineLtPopover } from "./components/frame/popover/lt-popover.js"
import { defineLtSessionTimeout } from "./components/frame/session-timeout/lt-session-timeout.js"
import { defineLtSuggestion } from "./components/frame/suggestion/lt-suggestion.js"
import { defineLtTabs } from "./components/frame/tabs/lt-tabs.js"
import { defineLtConnectionStatus } from "./components/standalone/connection-status/lt-connection-status.js"
import { defineLtToast } from "./components/standalone/toast/lt-toast.js"

// Typene til hendelsene og tagnavnene, så `querySelector("lt-dialog")` og
// `addEventListener` er typet også for den som bare importerer denne
// inngangen. Uten linja forsvant importene over fra `.d.ts`-fila, og verken
// `HTMLElementEventMap` eller `HTMLElementTagNameMap` ble utvidet.
export type { LtEventMap } from "./components/events.js"

export function defineLt(): void {
  defineLtField()
  defineLtTabs()
  defineLtErrorSummary()
  defineLtPopover()
  defineLtSuggestion()
  defineLtDialog()
  defineLtToast()
  defineLtSessionTimeout()
  defineLtConnectionStatus()
}
