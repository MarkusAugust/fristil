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
import {
  FS_DIALOG_PARTS,
  FS_DIALOG_TAG,
} from "../src/components/ramme/dialog/fs-dialog.js"
import type { FsErrorSummary } from "../src/components/ramme/error-summary/fs-error-summary.js"
import {
  FS_ERROR_SUMMARY_PARTS,
  FS_ERROR_SUMMARY_TAG,
} from "../src/components/ramme/error-summary/fs-error-summary.js"
import type { FsField } from "../src/components/ramme/field/fs-field.js"
import {
  FS_FIELD_PARTS,
  FS_FIELD_TAG,
} from "../src/components/ramme/field/fs-field.js"
import type { FsPopover } from "../src/components/ramme/popover/fs-popover.js"
import {
  FS_POPOVER_PARTS,
  FS_POPOVER_TAG,
} from "../src/components/ramme/popover/fs-popover.js"
import type { FsSessionTimeout } from "../src/components/ramme/session-timeout/fs-session-timeout.js"
import {
  FS_SESSION_TIMEOUT_PARTS,
  FS_SESSION_TIMEOUT_TAG,
} from "../src/components/ramme/session-timeout/fs-session-timeout.js"
import type { FsSuggestion } from "../src/components/ramme/suggestion/fs-suggestion.js"
import {
  FS_SUGGESTION_PARTS,
  FS_SUGGESTION_TAG,
} from "../src/components/ramme/suggestion/fs-suggestion.js"
import type { FsTabs } from "../src/components/ramme/tabs/fs-tabs.js"
import {
  FS_TABS_PARTS,
  FS_TABS_TAG,
} from "../src/components/ramme/tabs/fs-tabs.js"

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

/**
 * Hva en del tar som innhold. `text` er tekst og frasering uten interaktive
 * elementer, `free` er fritt innhold, `parts` er bare de andre delene, og
 * `none` er ingenting du skriver selv: en kontroll, eller et element
 * komponenten fyller.
 */
export type PartContent = "text" | "free" | "parts" | "none"

/**
 * En del av elementet, som kontrollen i `<fs-field>`. `selector` er den
 * komponenten selv finner delen med, relativt til elementet.
 */
export type PartDoc = {
  selector: string
  description: string
  content: PartContent
  /** Delen kan stå flere ganger, som fanene. Ellers gjelder den første. */
  multiple?: true
  /**
   * En del til av samme slag er en feil, ikke vanlig innhold: et felt med
   * to kontroller kobler bare den første. Uten feltet kan resten være
   * innhold, som knappene i panelet til `<fs-popover>`. `fristil sjekk`
   * melder en del med `unique` som står mer enn én gang.
   */
  unique?: true
  /** Elementet virker uten delen. */
  optional?: true
}

/**
 * Delene til et element, med én beskrivelse per selektor komponenten
 * eksporterer, verken flere eller færre.
 */
function parts<P extends Record<string, string>>(
  selectors: P,
  docs: Record<keyof P, Omit<PartDoc, "selector">>,
): Record<string, PartDoc> {
  return Object.fromEntries(
    Object.entries(docs).map(([name, doc]) => [
      name,
      { selector: selectors[name], ...(doc as Omit<PartDoc, "selector">) },
    ]),
  )
}

export type ElementDoc = {
  tag: string
  /** Siste ledd i adressen til komponentsiden, som `popover`. */
  slug: string
  description: string
  attributes: Record<string, AttributeDoc>
  events: Record<string, EventDoc>
  /** Tom for elementene som lager alt innholdet sitt selv. */
  parts: Record<string, PartDoc>
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
  return { tag, slug, description, attributes, events, parts: PARTS[tag] ?? {} }
}

/** Delene til rammekomponentene, etter tagg. */
const PARTS: Record<string, Record<string, PartDoc>> = {
  [FS_FIELD_TAG]: parts(FS_FIELD_PARTS, {
    label: {
      description:
        "Ledeteksten. Står den utenfor elementet, kobles den med `for` mot kontrollens id.",
      content: "text",
    },
    control: {
      description:
        'Kontrollen feltet kobler: et `<input>`, `<textarea>` eller `<select>` med sine `<option>`. `type="hidden"` teller ikke, og bare den første får koblingen.',
      content: "none",
      unique: true,
    },
    help: {
      description: "Hjelpeteksten, som leses opp sammen med kontrollen.",
      content: "text",
      unique: true,
      optional: true,
    },
    error: {
      description:
        "Feilmeldingen, som vises og leses opp når feltet er ugyldig.",
      content: "text",
      unique: true,
      optional: true,
    },
  }),
  [FS_TABS_TAG]: parts(FS_TABS_PARTS, {
    list: {
      description:
        'Raden med fanene. Har en fane `role="tab"`, kan raden også ha andre knapper, som en lukkeknapp.',
      content: "free",
      unique: true,
    },
    tab: {
      description:
        'En fane: `role="tab"`, eller en knapp uten rolle når ingen knapp i raden har rollen. Fane nummer n styrer panel nummer n.',
      content: "text",
      multiple: true,
    },
    panel: {
      description: "Innholdet til én fane, i samme rekkefølge som fanene.",
      content: "free",
      multiple: true,
    },
  }),
  [FS_ERROR_SUMMARY_TAG]: parts(FS_ERROR_SUMMARY_PARTS, {
    title: {
      description:
        "Overskriften i boksen. Komponenten gir den klassen for tittelen.",
      content: "text",
    },
    link: {
      description:
        "En lenke til et felt med feil, i et listepunkt. `href` er `#` og feltets id.",
      content: "text",
      multiple: true,
    },
  }),
  [FS_POPOVER_TAG]: parts(FS_POPOVER_PARTS, {
    trigger: {
      description:
        "Knappen som åpner og lukker panelet: den med `aria-controls` mot panelets id, ellers den første knappen utenfor panelet.",
      content: "text",
    },
    panel: {
      description: "Panelet som åpnes: elementet med `popover`, eller klassen.",
      content: "free",
      unique: true,
    },
  }),
  [FS_SUGGESTION_TAG]: parts(FS_SUGGESTION_PARTS, {
    control: {
      description:
        'Feltet brukeren skriver i: `role="combobox"`, ellers det første `<input>`.',
      content: "none",
      unique: true,
    },
    list: { description: "Lista med forslag.", content: "parts", unique: true },
    option: {
      description:
        'Ett forslag i lista: `role="option"`, eller et `<li>` uten rolle.',
      content: "text",
      multiple: true,
    },
    empty: {
      description: "Meldingen som vises når ingenting passer.",
      content: "text",
      unique: true,
      optional: true,
    },
    status: {
      description:
        "Opplesningen av antall treff. Elementet står tomt, og komponenten fyller det.",
      content: "none",
      unique: true,
    },
  }),
  [FS_DIALOG_TAG]: parts(FS_DIALOG_PARTS, {
    dialog: {
      description: "`<dialog>`-elementet, som et direkte barn av verten.",
      content: "free",
      unique: true,
    },
    title: {
      description:
        "Tittelen: det `aria-labelledby` peker på, ellers den første overskriften utenfor kroppen. Med `aria-label` på `<dialog>` trengs den ikke.",
      content: "text",
      optional: true,
    },
    body: {
      description:
        "Kroppen, som ruller når dialogen blir for høy. En overskrift her blir ikke tittel.",
      content: "free",
      unique: true,
      optional: true,
    },
  }),
  [FS_SESSION_TIMEOUT_TAG]: parts(FS_SESSION_TIMEOUT_PARTS, {
    dialog: {
      description: "`<dialog>`-elementet med varselet.",
      content: "free",
      unique: true,
    },
    title: {
      description:
        "Overskriften i dialogen, som blir navnet dens når verken `aria-labelledby` eller `aria-label` står på `<dialog>`.",
      content: "text",
      optional: true,
    },
    text: {
      description:
        "Avsnittet med tiden som er igjen. Opplesningen er dette avsnittet med tallet byttet ut.",
      content: "text",
      unique: true,
    },
    count: {
      description:
        "Tallet som telles ned, inne i avsnittet. Komponenten fyller det.",
      content: "none",
      unique: true,
    },
    status: {
      description:
        "Opplesningen. Elementet står tomt, og komponenten fyller det.",
      content: "none",
      unique: true,
    },
    button: {
      description:
        'Knappene i `<form method="dialog">`, som forlenger økten eller logger ut.',
      content: "text",
      multiple: true,
    },
  }),
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

/**
 * Hva hver klasse tar som innhold, og delene den består av.
 *
 * Elementene over sier hva web-komponentene leter etter. Klassene sa
 * ingenting: manifestet visste ikke at `fs-button` tar tekst, at `fs-list`
 * består av `<li>`, eller at `fs-table` har `<thead>` og `<tbody>` med en
 * `fs-table__sort` i en `<th>`. Et verktøy som setter sammen markup av
 * klassene måtte holde det i en egen liste.
 *
 * `content` bruker det samme ordforrådet som delene. `parts` står på
 * klassene med en fast struktur, og selektorene er relative til elementet
 * med klassen, som for elementene. En klasse som bare er en del av en annen
 * komponents markup, som `fs-card__title` og `fs-table__sort`, peker på
 * forelderen med `partOf` i stedet for å ha egne deler, og forelderen har en
 * del som treffer den.
 *
 * Tabellen holdes i takt med pakken av `generate-ordforrad.ts`, som stopper
 * på en klasse i CSS-en som mangler her og på en oppføring uten klasse, og
 * av `sjekk-ordforrad.ts`, som krever at hver selektor treffer markupen på
 * komponentsiden, og at `partOf` peker på en klasse med en del som treffer
 * denne.
 */
export type ClassDoc = {
  content: PartContent
  parts?: Record<string, PartDoc>
  /** Klassen denne er en del av. */
  partOf?: string
}

/** En rad i et skjema: kontrollen og ledeteksten side om side. */
const row = (control: string, what: string): ClassDoc => ({
  content: "parts",
  parts: {
    control: {
      selector: control,
      description: `${what}, med klassen sin.`,
      content: "none",
      unique: true,
    },
    label: {
      selector: "label",
      description: "Ledeteksten, koblet til kontrollen med `for`.",
      content: "text",
    },
  },
})

export const classDocs: Record<string, ClassDoc> = {
  "fs-accordion": {
    content: "parts",
    parts: {
      summary: {
        selector: "summary",
        description:
          "Overskriften brukeren trykker på for å åpne og lukke. En `<h2>` til `<h6>` inni gir den et nivå i dokumentet.",
        content: "free",
      },
      content: {
        selector: ".fs-accordion__content",
        description: "Innholdet som vises når panelet er åpent.",
        content: "free",
      },
    },
  },
  "fs-accordion__content": { content: "free", partOf: "fs-accordion" },
  "fs-alert": {
    content: "free",
    parts: {
      title: {
        selector: ".fs-alert__title",
        description: "Overskriften i meldingen.",
        content: "text",
        optional: true,
      },
    },
  },
  "fs-alert__title": { content: "text", partOf: "fs-alert" },
  "fs-avatar": {
    content: "free",
    parts: {
      image: {
        selector: "img",
        description:
          "Bildet, med navnet i `alt`. Uten bilde står initialene som tekst, og elementet har `aria-hidden` når navnet står ved siden av.",
        content: "none",
        optional: true,
      },
    },
  },
  "fs-avatar-stack": {
    content: "parts",
    parts: {
      item: {
        selector: "li",
        description: "Ett listepunkt per person.",
        content: "parts",
        multiple: true,
      },
      avatar: {
        selector: "li > .fs-avatar",
        description: "Avataren i hvert listepunkt.",
        content: "free",
        multiple: true,
      },
    },
  },
  "fs-badge": { content: "text" },
  "fs-breadcrumbs": {
    content: "parts",
    parts: {
      item: {
        selector: "li",
        description: "Ett steg i stien.",
        content: "parts",
        multiple: true,
      },
      link: {
        selector: "li > a",
        description:
          'Lenken til steget. Det siste, siden leseren står på, har `aria-current="page"`.',
        content: "text",
        multiple: true,
      },
    },
  },
  "fs-button": { content: "text" },
  "fs-card": {
    content: "free",
    parts: {
      title: {
        selector: ".fs-card__title",
        description: "Overskriften i kortet.",
        content: "text",
        optional: true,
      },
    },
  },
  "fs-card__title": { content: "text", partOf: "fs-card" },
  "fs-checkbox": { content: "none" },
  "fs-checkbox-row": row("input[type='checkbox']", "Avkryssingsboksen"),
  "fs-divider": { content: "none" },
  "fs-error-text": { content: "text" },
  "fs-fieldset": {
    content: "free",
    parts: {
      legend: {
        selector: ".fs-legend",
        description: "Ledeteksten til gruppen, en `<legend>` med klassen.",
        content: "text",
        unique: true,
      },
      help: {
        selector: ".fs-help-text",
        description:
          "Hjelpeteksten til gruppen, koblet med `aria-describedby` på feltsettet.",
        content: "text",
        optional: true,
      },
      error: {
        selector: ".fs-error-text",
        description:
          "Feilmeldingen til gruppen, koblet med `aria-describedby` på feltsettet.",
        content: "text",
        optional: true,
      },
    },
  },
  "fs-legend": { content: "text", partOf: "fs-fieldset" },
  "fs-file-upload": { content: "none" },
  "fs-file-upload-list": {
    content: "parts",
    parts: {
      item: {
        selector: "li",
        description: "Én valgt fil, med navnet.",
        content: "free",
        multiple: true,
      },
      remove: {
        selector: "li > button",
        description: "Knappen som fjerner fila, med filnavnet i teksten.",
        content: "text",
        multiple: true,
        optional: true,
      },
    },
  },
  "fs-heading": { content: "text" },
  "fs-help-text": { content: "text" },
  "fs-icon": { content: "none" },
  "fs-input": { content: "none" },
  "fs-label": { content: "text" },
  "fs-link": { content: "text" },
  "fs-list": {
    content: "parts",
    parts: {
      item: {
        selector: "li",
        description: "Ett punkt i lista.",
        content: "free",
        multiple: true,
      },
    },
  },
  "fs-pagination": {
    content: "parts",
    parts: {
      item: {
        selector: "li",
        description: "Ett listepunkt per side, pil og hull.",
        content: "parts",
        multiple: true,
      },
      link: {
        selector: "li > a, li > button",
        description:
          'Lenken eller knappen til en side, med sidetallet som tekst og `aria-label` som sier hva det er. Den gjeldende har `aria-current="page"`.',
        content: "text",
        multiple: true,
      },
      gap: {
        selector: ".fs-pagination__gap",
        description: "Hullet der sider er utelatt.",
        content: "text",
        multiple: true,
        optional: true,
      },
    },
  },
  "fs-pagination__gap": { content: "text", partOf: "fs-pagination" },
  "fs-paragraph": { content: "text" },
  "fs-progress": { content: "none" },
  "fs-radio": { content: "none" },
  "fs-radio-row": row("input[type='radio']", "Radioknappen"),
  "fs-search": { content: "none" },
  "fs-search-row": {
    content: "parts",
    parts: {
      label: {
        selector: "label",
        description:
          "Ledeteksten, koblet med `for`. Gjerne skjult med `fs-sr-only`.",
        content: "text",
      },
      control: {
        selector: "input[type='search']",
        description: "Søkefeltet, med klassene `fs-input fs-search`.",
        content: "none",
        unique: true,
      },
      button: {
        selector: "button",
        description: "Søkeknappen.",
        content: "text",
        optional: true,
      },
    },
  },
  "fs-select": { content: "none" },
  "fs-skeleton": { content: "none" },
  "fs-skip-link": { content: "text" },
  "fs-spinner": { content: "none" },
  "fs-sr-only": { content: "text" },
  "fs-switch": { content: "none" },
  "fs-switch-row": row("input[role='switch']", "Bryteren"),
  "fs-table": {
    content: "parts",
    parts: {
      caption: {
        selector: "caption",
        description: "Tabellens navn.",
        content: "text",
        unique: true,
        optional: true,
      },
      head: {
        selector: "thead",
        description: 'Overskriftsraden, med `<th scope="col">` per kolonne.',
        content: "free",
        unique: true,
      },
      body: {
        selector: "tbody",
        description:
          'Radene, i én eller flere grupper. En `<th scope="row">` først i raden gir raden et navn.',
        content: "free",
        multiple: true,
      },
      sort: {
        selector: "th > .fs-table__sort",
        description:
          "Knappen i en overskrift som kan sorteres. `aria-sort` på cellen sier hvilken vei.",
        content: "text",
        multiple: true,
        optional: true,
      },
    },
  },
  "fs-table__sort": { content: "text", partOf: "fs-table" },
  "fs-table-scroll": {
    content: "parts",
    parts: {
      table: {
        selector: ".fs-table",
        description: "Tabellen som kan rulles sidelengs.",
        content: "free",
      },
    },
  },
  "fs-tag": { content: "text" },
  "fs-textarea": { content: "none" },
  "fs-toggle-group": {
    content: "parts",
    parts: {
      legend: {
        selector: "legend",
        description:
          "Hva alternativene velger mellom. Kan skjules med `fs-sr-only`, men må stå der.",
        content: "text",
        unique: true,
      },
      option: {
        selector: ".fs-toggle-group__option",
        description:
          "Ett alternativ: en `<label>` med radioknappen og teksten.",
        content: "free",
        multiple: true,
      },
      radio: {
        selector: ".fs-toggle-group__option > input[type='radio']",
        description: "Radioknappen i hvert alternativ, med samme `name`.",
        content: "none",
        multiple: true,
      },
    },
  },
  "fs-toggle-group__option": { content: "free", partOf: "fs-toggle-group" },
  "fs-tooltip": {
    content: "parts",
    parts: {
      trigger: {
        selector: "[aria-describedby]",
        description:
          "Elementet boblen beskriver, med `aria-describedby` mot boblens id.",
        content: "text",
      },
      bubble: {
        selector: ".fs-tooltip__bubble",
        description: 'Boblen, med `role="tooltip"` og id-en.',
        content: "text",
      },
    },
  },
  "fs-tooltip__bubble": { content: "text", partOf: "fs-tooltip" },

  "fs-dialog": {
    content: "free",
    parts: {
      header: {
        selector: ".fs-dialog__header",
        description:
          "Toppen, med overskriften og underteksten. `data-color` på dialogen farger den.",
        content: "parts",
        optional: true,
      },
      title: {
        selector: ".fs-dialog__title",
        description: "Overskriften, som `aria-labelledby` peker på.",
        content: "text",
        optional: true,
      },
      subtitle: {
        selector: ".fs-dialog__subtitle",
        description: "Linja under overskriften, inne i toppen.",
        content: "text",
        optional: true,
      },
      body: {
        selector: ".fs-dialog__body",
        description:
          "Innholdet, som ruller når dialogen blir for høy. Må være et direkte barn.",
        content: "free",
        optional: true,
      },
      footer: {
        selector: ".fs-dialog__footer",
        description:
          'Raden med knapper nederst, gjerne et `<form method="dialog">`.',
        content: "free",
        optional: true,
      },
    },
  },
  "fs-dialog__header": {
    content: "parts",
    partOf: "fs-dialog",
    parts: {
      title: {
        selector: ".fs-dialog__title",
        description: "Overskriften.",
        content: "text",
      },
      subtitle: {
        selector: ".fs-dialog__subtitle",
        description: "Linja under overskriften.",
        content: "text",
        optional: true,
      },
    },
  },
  "fs-dialog__title": { content: "text", partOf: "fs-dialog" },
  "fs-dialog__subtitle": { content: "text", partOf: "fs-dialog" },
  "fs-dialog__body": { content: "free", partOf: "fs-dialog" },
  "fs-dialog__footer": { content: "free", partOf: "fs-dialog" },
  "fs-error-summary": {
    content: "parts",
    parts: {
      title: {
        selector: ".fs-error-summary__title",
        description: "Overskriften, som sier hvor mange feil skjemaet har.",
        content: "text",
      },
      list: {
        selector: "ul",
        description: "Lista med én lenke per feil.",
        content: "parts",
      },
      link: {
        selector: "li a[href^='#']",
        description:
          "Lenken til et felt med feil, med feilmeldingen som tekst og feltets id etter `#`.",
        content: "text",
        multiple: true,
      },
    },
  },
  "fs-error-summary__title": { content: "text", partOf: "fs-error-summary" },
  "fs-popover": { content: "free" },
  "fs-session-timeout": {
    content: "parts",
    parts: {
      dialog: {
        selector: ".fs-session-timeout__dialog",
        description: 'Dialogen med varselet, med `role="alertdialog"`.',
        content: "parts",
      },
      title: {
        selector: ".fs-session-timeout__title",
        description: "Overskriften i dialogen.",
        content: "text",
        optional: true,
      },
      text: {
        selector: ".fs-session-timeout__text",
        description: "Avsnittet med tiden som er igjen.",
        content: "text",
      },
      count: {
        selector: ".fs-session-timeout__count",
        description:
          "Tallet som telles ned, inne i avsnittet. Komponenten fyller det.",
        content: "none",
      },
      status: {
        selector: "[role='status']",
        description: "Opplesningen. Står tomt, og komponenten fyller det.",
        content: "none",
      },
      actions: {
        selector: ".fs-session-timeout__actions",
        description: 'Knapperaden, et `<form method="dialog">`.',
        content: "parts",
      },
      button: {
        selector: ".fs-session-timeout__actions button",
        description: "Knappene som forlenger økten eller logger ut.",
        content: "text",
        multiple: true,
      },
    },
  },
  "fs-session-timeout__dialog": {
    content: "parts",
    partOf: "fs-session-timeout",
    parts: {
      title: {
        selector: ".fs-session-timeout__title",
        description: "Overskriften.",
        content: "text",
        optional: true,
      },
      text: {
        selector: ".fs-session-timeout__text",
        description: "Avsnittet med tiden som er igjen.",
        content: "text",
      },
      count: {
        selector: ".fs-session-timeout__count",
        description: "Tallet som telles ned, inne i avsnittet.",
        content: "none",
      },
      status: {
        selector: "[role='status']",
        description: "Opplesningen, som komponenten fyller.",
        content: "none",
      },
      actions: {
        selector: ".fs-session-timeout__actions",
        description: 'Knapperaden, et `<form method="dialog">`.',
        content: "parts",
      },
    },
  },
  "fs-session-timeout__title": {
    content: "text",
    partOf: "fs-session-timeout",
  },
  "fs-session-timeout__text": { content: "text", partOf: "fs-session-timeout" },
  "fs-session-timeout__count": {
    content: "none",
    partOf: "fs-session-timeout",
  },
  "fs-session-timeout__actions": {
    content: "parts",
    partOf: "fs-session-timeout",
    parts: {
      button: {
        selector: "button",
        description: "Knappene som forlenger økten eller logger ut.",
        content: "text",
        multiple: true,
      },
    },
  },
  "fs-suggestion__field": {
    content: "parts",
    parts: {
      control: {
        selector: "input",
        description: "Feltet brukeren skriver i.",
        content: "none",
      },
      list: {
        selector: ".fs-suggestion__list",
        description: "Lista med forslag.",
        content: "parts",
      },
      empty: {
        selector: ".fs-suggestion__empty",
        description: "Meldingen som vises når ingenting passer.",
        content: "text",
        optional: true,
      },
      status: {
        selector: "[role='status']",
        description:
          "Opplesningen av antall treff. Står tomt, og komponenten fyller det.",
        content: "none",
      },
    },
  },
  "fs-suggestion__list": {
    content: "parts",
    partOf: "fs-suggestion__field",
    parts: {
      option: {
        selector: "[role='option'], .fs-suggestion__option, > li:not([role])",
        description:
          "Ett forslag: rollen eller klassen når de står der, ellers en `<li>` uten rolle, som komponenten gir klassen og rollen. Lista kan stå tom til serveren fyller den.",
        content: "text",
        multiple: true,
        optional: true,
      },
    },
  },
  "fs-suggestion__option": { content: "text", partOf: "fs-suggestion__list" },
  "fs-suggestion__empty": { content: "text", partOf: "fs-suggestion__field" },
  "fs-tabs__list": {
    content: "free",
    parts: {
      tab: {
        selector: "[role='tab'], > button:not([role])",
        description:
          'En fane: `role="tab"`, eller en knapp uten rolle når ingen knapp i raden har rollen. Fane nummer n styrer panel nummer n. Har en fane rollen, kan raden også ha andre knapper.',
        content: "text",
        multiple: true,
      },
    },
  },
  "fs-tabs__panel": { content: "free" },

  // Klassene komponentene setter på nodene de lager selv, har innhold men
  // ingen forelder: ingen skriver dem i markupen, så ingen del treffer dem.
  "fs-connection-status": { content: "none" },
  "fs-connection-status__bar": { content: "text" },
  "fs-toast": { content: "none" },
  "fs-toast__message": { content: "free" },
  "fs-toast__close": { content: "text" },
  "fs-theme-control": { content: "none" },
}
