import type { HTMLAttributes, RefAttributes } from "react"

// Typene til hendelsene og tagnavnene, så `querySelector("lt-dialog")` og
// `addEventListener` er typet også for den som bare importerer denne
// inngangen. Fila har ingen annen import fra komponentene, så uten linja ble
// verken `HTMLElementEventMap` eller `HTMLElementTagNameMap` utvidet.
export type { LtEventMap } from "../components/events.js"

/**
 * Typer for LO-TEKs web components i JSX.
 *
 * Uten disse kjenner ikke TypeScript `<lt-field>` i det hele tatt, men sier
 * «Property 'lt-field' does not exist on type JSX.IntrinsicElements». Og
 * attributtene er bindestreksstrenger uten autofullføring, så `described-by`
 * og `server-controlled` er nettopp der en skrivefeil er lett å gjøre og vanskelig å
 * få øye på.
 *
 * Importer én gang i prosjektet, helst fra en `.d.ts`-fil så det ikke havner
 * i bygget:
 *
 * ```ts
 * // src/lotek.d.ts
 * import "@lo-tek/interfaces/react-jsx"
 * ```
 *
 * Astro trenger ikke dette: der er `<lt-field>` vanlig HTML, og ingen
 * typesjekk ser på elementnavnet.
 */

/**
 * Boolske attributter på web components.
 *
 * Typen er `true | undefined`, ikke `boolean` og ikke `""`, og det er med
 * vilje. React behandler web components ulikt mellom versjoner, og
 * bare ett mønster er riktig i begge:
 *
 *     React 18 setter attributter       React 19 setter egenskaper
 *     open=""          virker            aldri åpen
 *     open={true}      virker            virker
 *     open={false}     ALLTID åpen       virker
 *     open={undefined} virker            virker
 *
 * React 18 stringifiserer til `open="false"`. Attributtet finnes da, og er
 * dermed sant. React 19 setter egenskapen til `""`, som er usann, og
 * setteren i komponenten fjerner attributtet igjen.
 *
 * Derfor sender byggefunksjonene `true` for et boolsk attributt på en vert,
 * ikke den tomme strengen. `data-*` er noe annet: React sender dem videre
 * som attributter i begge versjoner, og der er `""` den kanoniske formen.
 *
 * Skriver du det for hånd, skriv `open={apen || undefined}`. Typen her gjør
 * at de to andre variantene blir kompileringsfeil i stedet for noe du må
 * huske.
 */
type Flag = true | undefined

/**
 * Serveren eier tilstanden i dette elementet.
 *
 * Komponentene setter tilbake det brukeren har gjort når en patch river det
 * bort: valgte fanen, det åpne sprettoppvinduet, den utvidede forslagslista.
 * Med dette gjør de ikke det, og hver patch bestemmer. Bruk den når serveren
 * skal kunne flytte fanen selv, som i «gå videre til steg 2».
 */
type ServerControlled = {
  "server-controlled"?: Flag
}

/**
 * Grunnformen for en web component i JSX.
 *
 * `HTMLAttributes` alene har ikke `ref`. Den ligger i `RefAttributes`, og
 * uten den var `<lt-toast ref={kø} />` en typefeil, altså nøyaktig mønsteret
 * dokumentasjonen anbefaler for å kalle `.show()` og `.hide()`. `key` kommer
 * samme vei.
 */
type Host = HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>

type LtFieldAttributes = Host & {
  disabled?: Flag
  optional?: Flag
  "described-by"?: string
}

/**
 * `<lt-tabs>` har `server-controlled` og `activation`, og ingen `selected`.
 *
 * Hvilken fane som er valgt står i markupen serveren sendte, som
 * `aria-selected` på fanen og `hidden` på panelene. Komponenten leser det
 * derfra i stedet for å ha sin egen `selected`, slik at de to aldri kan si
 * hver sin ting.
 */
type LtTabsAttributes = Host &
  ServerControlled & {
    /**
     * `manual`: piltastene flytter bare fokus, og Enter eller mellomrom
     * velger. Standard: piltastene velger med en gang.
     */
    activation?: "manual" | "automatic"
  }

type LtErrorSummaryAttributes = Host & {
  /**
   * Boksen er skjult til det finnes feil å vise.
   *
   * `HTMLAttributes` har alt `hidden` som `boolean`, men på en web component
   * gjelder regelen for `open`: React 18 skriver `hidden={false}` som
   * attributtet `hidden="false"`, og boksen er da alltid skjult. Typen er
   * derfor `Flag` også her, så `hidden={harFeil ? undefined : true}` er det
   * som kompilerer. `lt.errorSummary().host` sender det slik.
   */
  hidden?: Flag
  /**
   * Flytt fokus hit når boksen kommer til syne. Standard: på.
   * Sett `"false"` for å la være.
   */
  "data-autofocus"?: "false" | "true"
}

type LtSuggestionAttributes = Host & {
  /**
   * Noen andre har alt filtrert, så komponenten skal la være.
   *
   * Komponenten skjuler et alternativ når teksten ikke inneholder det som
   * står i feltet. Filtrerer du på noe annet, blir de to uenige, og da er det
   * ditt filter som skal gjelde. En React-app som rendrer bare treffene av et
   * søk uten diakritikk er det vanligste tilfellet, ved siden av en
   * Datastar-app der serveren sender lista på nytt.
   *
   * Antall treff leses opp uansett hvem som filtrerte.
   */
  prefiltered?: Flag
  /** Opplesningen ved null treff, som «Ingen treff». */
  "count-none"?: string
  /** Opplesningen i formen `Intl.PluralRules` kaller `zero`. `{n}` er tallet. */
  "count-zero"?: string
  /** Opplesningen for ett treff, som «{n} treff». `{n}` er tallet. */
  "count-one"?: string
  /** Opplesningen i formen `two`. `{n}` er tallet. */
  "count-two"?: string
  /** Opplesningen i formen `few`. `{n}` er tallet. */
  "count-few"?: string
  /** Opplesningen i formen `many`. `{n}` er tallet. */
  "count-many"?: string
  /** Opplesningen for alle andre antall, og reserven. `{n}` er tallet. */
  "count-other"?: string
} & ServerControlled

type LtDialogAttributes = Host &
  ServerControlled & {
    /** Dialogen er åpen. Komponenten kaller `showModal()`. */
    open?: Flag
  }

type LtPopoverAttributes = Host &
  ServerControlled & {
    open?: Flag
    /** Hvilken kant panelet henger fra. */
    placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end"
  }

type LtSessionTimeoutAttributes = Host & {
  /** Sekunder uten aktivitet før varselet kommer. */
  "warn-at"?: number | string
  /** Sekunder uten aktivitet før økten er ute. */
  "expires-at"?: number | string
  /** Sekunder mellom hver `session-activity` mens brukeren er aktiv. */
  "activity-interval"?: number | string
}

type LtConnectionStatusAttributes = Host & {
  /** Teksten når forbindelsen er borte. */
  "offline-text"?: string
  /** Teksten når den kommer tilbake. */
  "online-text"?: string
}

type LtToastAttributes = Host & {
  /** Millisekunder før meldingene forsvinner. */
  duration?: number
  /** Tekst som sier hva regionen er. */
  label?: string
  /** Hva lukkeknappen i hver melding heter for skjermleseren. */
  "close-label"?: string
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "lt-dialog": LtDialogAttributes
      "lt-error-summary": LtErrorSummaryAttributes
      "lt-field": LtFieldAttributes
      "lt-popover": LtPopoverAttributes
      "lt-suggestion": LtSuggestionAttributes
      "lt-tabs": LtTabsAttributes
      "lt-session-timeout": LtSessionTimeoutAttributes
      "lt-connection-status": LtConnectionStatusAttributes
      "lt-toast": LtToastAttributes
    }
  }
}

export type {
  LtConnectionStatusAttributes,
  LtDialogAttributes,
  LtErrorSummaryAttributes,
  LtFieldAttributes,
  LtPopoverAttributes,
  LtSessionTimeoutAttributes,
  LtSuggestionAttributes,
  LtTabsAttributes,
  LtToastAttributes,
}
