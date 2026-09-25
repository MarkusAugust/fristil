/**
 * Det en editor skal vite om hvert `<fs-*>`-element: én setning per element,
 * per attributt og per lovlig verdi.
 *
 * Teksten her er kilden til både `fristil.html-data.json` (VS Code) og
 * `designsystem/web-types.json` (JetBrains). Den er håndskrevet, men
 * TypeScript holder den i takt med komponentene: hvert element skriver
 * attributtene sine som `Record` over `observedAttributes`, så et attributt
 * som legges til i en komponent uten en setning her, eller en setning om et
 * attributt som er borte, stopper typesjekken. `scripts/sjekk.ts` tar
 * resten: at hvert element pakken registrerer står i lista.
 *
 * Fila sendes ikke ut i pakken. Den leses bare av generatoren.
 */

import type { FsConnectionStatus } from "@fristil/designsystem/connection-status"
import { FS_CONNECTION_STATUS_TAG } from "@fristil/designsystem/connection-status"
import type { FsDialog } from "@fristil/designsystem/dialog"
import { FS_DIALOG_TAG } from "@fristil/designsystem/dialog"
import type { FsErrorSummary } from "@fristil/designsystem/error-summary"
import { FS_ERROR_SUMMARY_TAG } from "@fristil/designsystem/error-summary"
import type { FsField } from "@fristil/designsystem/field"
import { FS_FIELD_TAG } from "@fristil/designsystem/field"
import type { FsPopover } from "@fristil/designsystem/popover"
import { FS_POPOVER_TAG } from "@fristil/designsystem/popover"
import type { FsSessionTimeout } from "@fristil/designsystem/session-timeout"
import { FS_SESSION_TIMEOUT_TAG } from "@fristil/designsystem/session-timeout"
import type { FsSuggestion } from "@fristil/designsystem/suggestion"
import { FS_SUGGESTION_TAG } from "@fristil/designsystem/suggestion"
import type { FsTabs } from "@fristil/designsystem/tabs"
import { FS_TABS_TAG } from "@fristil/designsystem/tabs"
import type { FsToast } from "@fristil/designsystem/toast"
import { FS_TOAST_TAG } from "@fristil/designsystem/toast"

/** En lovlig verdi, med hva den betyr. */
export type ValueDoc = { name: string; description: string }

/**
 * Hva et attributt tar.
 *
 * `flag` er et boolsk HTML-attributt: det står der eller ikke. De tre andre
 * har en verdi, og `values` er en lukket liste editoren kan foreslå fra.
 */
export type AttributeValue =
  | "flag"
  | "text"
  | "number"
  | { values: readonly ValueDoc[] }

export type AttributeDoc = { description: string; value: AttributeValue }

export type ElementDoc = {
  tag: string
  /** Siste ledd i adressen til komponentsiden, som `popover`. */
  slug: string
  description: string
  attributes: Record<string, AttributeDoc>
}

/** Klassen til en komponent, slik generatoren ser den. */
type Component = { observedAttributes: readonly string[] }

/** Én setning per attributt komponenten observerer, verken flere eller færre. */
type Attributes<T extends Component> = Record<
  T["observedAttributes"][number],
  AttributeDoc
>

function element<T extends Component>(
  tag: string,
  slug: string,
  description: string,
  attributes: Attributes<T>,
): ElementDoc {
  return { tag, slug, description, attributes }
}

const flag = (description: string): AttributeDoc => ({
  description,
  value: "flag",
})
const text = (description: string): AttributeDoc => ({
  description,
  value: "text",
})
const number = (description: string): AttributeDoc => ({
  description,
  value: "number",
})

/** Det samme attributtet på fire komponenter, med den samme setningen. */
const serverControlled = flag(
  "Serveren eier tilstanden alene. Komponenten setter ingenting tilbake når en morfing har fjernet det den selv skrev.",
)

export const elements: readonly ElementDoc[] = [
  element<typeof FsField>(
    FS_FIELD_TAG,
    "field",
    "Kobler ledetekst, felt, hjelpetekst og feilmelding sammen: setter `for`, `id`, `aria-describedby` og `aria-invalid` på barna. Finnes for markup som blir til uten JavaScript. Lages markupen med JavaScript, bruk `fs.field()` i stedet.",
    {
      invalid: flag(
        "Feltet har feilet validering. Feilmeldingen vises og kontrollen får `aria-invalid`.",
      ),
      disabled: flag("Kontrollen er slått av."),
      optional: flag("Feltet er valgfritt, og ledeteksten sier det."),
      "required-marker": {
        description: "Hvordan ledeteksten viser at feltet er påkrevd.",
        value: {
          values: [
            { name: "symbol", description: "En stjerne etter ledeteksten." },
            { name: "text", description: "Ordet «må fylles ut»." },
            { name: "none", description: "Ingen markering." },
          ],
        },
      },
      "control-id": text(
        "Id-en kontrollen skal ha. Uten den brukes id-en som alt står på kontrollen, eller ledetekstens `for`.",
      ),
      "described-by": text(
        "Ekstra id-er som skal med i `aria-describedby`, adskilt med mellomrom.",
      ),
    },
  ),

  element<typeof FsTabs>(
    FS_TABS_TAG,
    "tabs",
    'Fanerad. Gir tastatur og fokus til en `role="tablist"` med faner og paneler serveren har skrevet. Hvilken fane som er valgt leses fra `aria-selected`.',
    { "server-controlled": serverControlled },
  ),

  element<typeof FsErrorSummary>(
    FS_ERROR_SUMMARY_TAG,
    "error-summary",
    "Feiloppsummering. Flytter fokus til boksen når den kommer til syne, og til kontrollen når en lenke i lista følges.",
    {
      "data-autofocus": {
        description:
          "Om fokus flyttes til boksen når den kommer til syne. Standard er på.",
        value: {
          values: [{ name: "false", description: "La fokus stå der det er." }],
        },
      },
      hidden: flag(
        "Boksen er skjult. Serveren tar attributtet bort når skjemaet feiler, og komponenten flytter fokus da.",
      ),
    },
  ),

  element<typeof FsPopover>(
    FS_POPOVER_TAG,
    "popover",
    "Panel som henger under en knapp og lukker seg selv. Knappen har `aria-controls`, panelet har `popover` og samme id.",
    {
      open: flag(
        "Panelet er åpent. Serveren kan sende attributtet for å åpne panelet.",
      ),
      placement: {
        description: "Hvilken kant av knappen panelet henger fra.",
        value: {
          values: [
            {
              name: "bottom-start",
              description: "Under knappen, venstrekantene på linje. Standard.",
            },
            {
              name: "bottom-end",
              description: "Under knappen, høyrekantene på linje.",
            },
            {
              name: "top-start",
              description: "Over knappen, venstrekantene på linje.",
            },
            {
              name: "top-end",
              description: "Over knappen, høyrekantene på linje.",
            },
          ],
        },
      },
      "server-controlled": serverControlled,
    },
  ),

  element<typeof FsSuggestion>(
    FS_SUGGESTION_TAG,
    "suggestion",
    "Felt med forslagsliste. Filtrerer alternativene mens brukeren skriver, flytter markeringen med piltastene og leser opp antall treff.",
    {
      prefiltered: flag(
        "Appen har alt filtrert lista, så komponenten lar den stå. Trengs når appens filter er et annet enn «teksten inneholder søkeordet».",
      ),
      "server-controlled": serverControlled,
    },
  ),

  element<typeof FsDialog>(
    FS_DIALOG_TAG,
    "dialog",
    'Gjør en `<dialog class="fs-dialog">` modal med `showModal()`, for servere som ikke kan kalle den selv. Verten rundt dialogen.',
    {
      open: flag(
        "Dialogen er åpen. Skal serveren vise den, må `open` også stå på `<dialog>`.",
      ),
      "server-controlled": serverControlled,
    },
  ),

  element<typeof FsToast>(
    FS_TOAST_TAG,
    "toast",
    "Kø av korte meldinger i hjørnet av skjermen. Meldingene lages fra skript med `show(tekst, { color, duration })`.",
    {
      duration: number(
        "Millisekunder før en melding forsvinner. Standard er 6000, og 0 lar meldingene stå.",
      ),
      label: text("Tekst som sier hva regionen er for skjermlesere."),
    },
  ),

  element<typeof FsSessionTimeout>(
    FS_SESSION_TIMEOUT_TAG,
    "session-timeout",
    "Varsler før en innlogget økt går ut, og teller ned. Sender `session-extend` når brukeren vil fortsette og `session-expired` når tiden er ute.",
    {
      "warn-at": number("Sekunder uten aktivitet før varselet kommer."),
      "expires-at": number("Sekunder uten aktivitet før økten er ute."),
    },
  ),

  element<typeof FsConnectionStatus>(
    FS_CONNECTION_STATUS_TAG,
    "connection-status",
    "Sier fra når forbindelsen til serveren er borte. Appen melder fra med `reportFailure()` og `reportSuccess()`.",
    {
      "offline-text": text("Teksten når forbindelsen er borte."),
      "online-text": text("Teksten når den kommer tilbake."),
    },
  ),
]
