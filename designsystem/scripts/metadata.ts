/**
 * Det en editor skal vite om hvert `<fs-*>`-element: én setning per element,
 * per attributt og per lovlig verdi.
 *
 * Teksten her er kilden til både `html-data.json` (VS Code) og
 * `web-types.json` (JetBrains) i pakken. Den er håndskrevet, men
 * TypeScript holder den i takt med komponentene: hvert element skriver
 * attributtene sine som `Record` over `observedAttributes`, så et attributt
 * som legges til i en komponent uten en setning her, eller en setning om et
 * attributt som er borte, stopper typesjekken. `sjekk-ordforrad.ts` tar
 * resten: at hvert element pakken registrerer står i lista.
 *
 * Fila sendes ikke ut i pakken. Den leses bare av `generate-ordforrad.ts`.
 */

import type { FsConnectionStatus } from "../src/components/frittstaende/connection-status/fs-connection-status.js"
import { FS_CONNECTION_STATUS_TAG } from "../src/components/frittstaende/connection-status/fs-connection-status.js"
import type { FsToast } from "../src/components/frittstaende/toast/fs-toast.js"
import { FS_TOAST_TAG } from "../src/components/frittstaende/toast/fs-toast.js"
import type { FsDialog } from "../src/components/ramme/dialog/fs-dialog.js"
import { FS_DIALOG_TAG } from "../src/components/ramme/dialog/fs-dialog.js"
import type { FsErrorSummary } from "../src/components/ramme/error-summary/fs-error-summary.js"
import { FS_ERROR_SUMMARY_TAG } from "../src/components/ramme/error-summary/fs-error-summary.js"
import type { FsField } from "../src/components/ramme/field/fs-field.js"
import { FS_FIELD_TAG } from "../src/components/ramme/field/fs-field.js"
import type { FsPopover } from "../src/components/ramme/popover/fs-popover.js"
import { FS_POPOVER_TAG } from "../src/components/ramme/popover/fs-popover.js"
import type { FsSessionTimeout } from "../src/components/ramme/session-timeout/fs-session-timeout.js"
import { FS_SESSION_TIMEOUT_TAG } from "../src/components/ramme/session-timeout/fs-session-timeout.js"
import type { FsSuggestion } from "../src/components/ramme/suggestion/fs-suggestion.js"
import { FS_SUGGESTION_TAG } from "../src/components/ramme/suggestion/fs-suggestion.js"
import type { FsTabs } from "../src/components/ramme/tabs/fs-tabs.js"
import { FS_TABS_TAG } from "../src/components/ramme/tabs/fs-tabs.js"

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

/** Typen til ett felt i `detail`. */
export type DetailType = "boolean" | "string" | "number"

/**
 * En hendelse elementet sender, som `dialog-toggle`. Alle bobler og krysser
 * skyggegrenser (`bubbles: true, composed: true`). `detail` er feltene i
 * `event.detail`, eller ingenting når hendelsen ikke har noe.
 */
export type EventDoc = {
  description: string
  detail?: Record<string, DetailType>
}

export type ElementDoc = {
  tag: string
  /** Siste ledd i adressen til komponentsiden, som `popover`. */
  slug: string
  description: string
  attributes: Record<string, AttributeDoc>
  events: Record<string, EventDoc>
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
  events: Record<string, EventDoc> = {},
): ElementDoc {
  return { tag, slug, description, attributes, events }
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

/**
 * Det samme attributtet på fire komponenter, med den samme setningen.
 *
 * Det attributtet slår av er at komponenten setter *brukerens* tilstand
 * tilbake etter en morfing: valgt fane, åpent panel, åpen liste, modal
 * dialog. Koblingen ellers, som `aria-expanded` på knappen, settes uansett.
 */
const serverControlled = flag(
  "Serveren eier tilstanden brukeren har laget: valgt fane, åpent panel, åpen liste, åpen dialog. Komponenten setter den ikke tilbake når en morfing har fjernet den.",
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
            {
              name: "text",
              description: "Teksten «(påkrevd)» etter ledeteksten.",
            },
            {
              name: "none",
              description:
                "Ingen markering, også når serveren har skrevet `data-required` på ledeteksten. Uten attributtet gjelder det ledeteksten sier.",
            },
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
    "Fanerad. Gir tastatur og fokus til en `.fs-tabs__list` med knapper og ett `.fs-tabs__panel` per knapp, og setter roller, id-er og kobling der markupen kom uten. Hvilken fane som er valgt leses fra `aria-selected`, ellers fra `hidden` på panelene.",
    { "server-controlled": serverControlled },
    {
      "tab-select": {
        description: "Brukeren valgte en fane. `index` teller fra 0.",
        detail: { index: "number" },
      },
    },
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
          values: [
            { name: "false", description: "La fokus stå der det er." },
            {
              name: "true",
              description:
                "Flytt fokus, det samme som uten attributtet. Alt annet enn «false» flytter fokus.",
            },
          ],
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
    "Panel som henger under en knapp og lukker seg selv. En knapp og et panel med klassen `fs-popover` er nok; komponenten setter `popover`, id-en og `aria-controls` der markupen kom uten.",
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
              description: "Under knappen, langs startkanten. Standard.",
            },
            {
              name: "bottom-end",
              description: "Under knappen, langs sluttkanten.",
            },
            {
              name: "top-start",
              description: "Over knappen, langs startkanten.",
            },
            {
              name: "top-end",
              description: "Over knappen, langs sluttkanten.",
            },
          ],
        },
      },
      "server-controlled": serverControlled,
    },
    {
      "popover-toggle": {
        description: "Panelet åpnet eller lukket seg.",
        detail: { open: "boolean" },
      },
    },
  ),

  element<typeof FsSuggestion>(
    FS_SUGGESTION_TAG,
    "suggestion",
    "Felt med forslagsliste. En `<label>`, et `<input>`, en `.fs-suggestion__list` med `<li>` og et `[role=status]` er nok; komponenten setter rollene, id-ene og koblingen der markupen kom uten. Filtrerer mens brukeren skriver, flytter markeringen med piltastene og leser opp antall treff.",
    {
      prefiltered: flag(
        "Appen har alt filtrert lista, så komponenten lar den stå. Trengs når appens filter er et annet enn «teksten inneholder søkeordet».",
      ),
      "count-none": text(
        "Opplesningen ved null treff. Standard er «Ingen treff».",
      ),
      "count-zero": text(
        "Opplesningen i bøyningsformen `zero`, for språk som har den. `{n}` er tallet.",
      ),
      "count-one": text("Opplesningen for ett treff. `{n}` er tallet."),
      "count-two": text(
        "Opplesningen i bøyningsformen `two`, for språk som har den. `{n}` er tallet.",
      ),
      "count-few": text(
        "Opplesningen i bøyningsformen `few`, for språk som har den. `{n}` er tallet.",
      ),
      "count-many": text(
        "Opplesningen i bøyningsformen `many`, for språk som har den. `{n}` er tallet.",
      ),
      "count-other": text(
        "Opplesningen for alle andre antall, og reserven når en form mangler. `{n}` er tallet.",
      ),
      "server-controlled": serverControlled,
    },
    {
      "suggestion-select": {
        description:
          "Brukeren valgte et forslag. Feltet får også `input` og `change`, som om brukeren hadde skrevet det.",
        detail: { value: "string" },
      },
    },
  ),

  element<typeof FsDialog>(
    FS_DIALOG_TAG,
    "dialog",
    'Gjør en `<dialog class="fs-dialog">` modal med `showModal()`, for servere som ikke kan kalle den selv. Verten rundt dialogen. Gir dialogen navnet sitt fra den første overskriften utenfor `fs-dialog__body` når verken `aria-labelledby` eller `aria-label` står der.',
    {
      open: flag(
        "Dialogen er åpen. Skal serveren vise den, må `open` også stå på `<dialog>`.",
      ),
      "server-controlled": serverControlled,
    },
    {
      "dialog-toggle": {
        description:
          "Dialogen åpnet eller lukket seg. `returnValue` er verdien til knappen som lukket den, eller en tom streng.",
        detail: { open: "boolean", returnValue: "string" },
      },
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
      "close-label": text(
        "Hva lukkeknappen i hver melding heter for skjermlesere. Standard er «Lukk melding».",
      ),
    },
    {
      "toast-dismiss": {
        description:
          "En melding ble lukket, av brukeren, fordi tiden gikk ut, eller med `dismiss()`. `clear()` sender ingen.",
      },
    },
  ),

  element<typeof FsSessionTimeout>(
    FS_SESSION_TIMEOUT_TAG,
    "session-timeout",
    'Varsler før en innlogget økt går ut, og teller ned. Den som rendrer skriver dialogen og teksten inni elementet: en `<dialog>` med `.fs-session-timeout__count` for tallet, `[role=status]` for opplesningen og knappene i et `<form method="dialog">`. Sender `session-warn` når dialogen åpner, `session-extend` når brukeren vil fortsette, `session-logout` når brukeren logger ut, `session-expired` når tiden er ute, og `session-activity` høyst én gang per `activity-interval` mens brukeren er aktiv, så appen kan holde serverøkten i live.',
    {
      "warn-at": number("Sekunder uten aktivitet før varselet kommer."),
      "expires-at": number("Sekunder uten aktivitet før økten er ute."),
      "activity-interval": number(
        "Sekunder mellom hver `session-activity` mens brukeren er aktiv. Standard 60.",
      ),
    },
    {
      "session-warn": { description: "Varselet åpnet seg." },
      "session-extend": {
        description:
          "Økten fortsetter: brukeren lukket varselet med en annen knapp enn utlogging eller med Escape, eller appen kalte `extend()`.",
      },
      "session-logout": { description: "Brukeren valgte å logge ut." },
      "session-expired": { description: "Tiden er ute." },
      "session-activity": {
        description:
          "Brukeren er aktiv. Kommer høyst én gang per `activity-interval`, så appen kan holde serverøkten i live.",
      },
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
    {
      "connection-lost": { description: "Forbindelsen er borte." },
      "connection-restored": { description: "Forbindelsen er tilbake." },
    },
  ),
]
