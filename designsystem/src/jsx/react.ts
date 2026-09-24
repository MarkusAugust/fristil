import type { HTMLAttributes, RefAttributes } from "react"

/**
 * Typer for Fristils egendefinerte elementer i JSX.
 *
 * Uten disse kjenner ikke TypeScript `<fs-field>` i det hele tatt, men sier
 * «Property 'fs-field' does not exist on type JSX.IntrinsicElements». Og
 * attributtene er bindestreksstrenger uten autofullføring, så `required-marker`
 * og `help-text` er nettopp der en skrivefeil er lett å gjøre og vanskelig å
 * få øye på.
 *
 * Importer én gang i prosjektet, helst fra en `.d.ts`-fil så det ikke havner
 * i bygget:
 *
 * ```ts
 * // src/fristil.d.ts
 * import "@fristil/designsystem/react-jsx"
 * ```
 *
 * Vue og Svelte trenger ikke dette. Vue godtar ukjente elementer når `fs-` er
 * satt opp i `isCustomElement`, og Svelte klager ikke.
 */

/**
 * Boolske attributter på egendefinerte elementer.
 *
 * Typen er `true | undefined`, ikke `boolean` og ikke `""`, og det er med
 * vilje. React behandler egendefinerte elementer ulikt mellom versjoner, og
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
 * Grunnformen for et egendefinert element i JSX.
 *
 * `HTMLAttributes` alene har ikke `ref`. Den ligger i `RefAttributes`, og
 * uten den var `<fs-toast ref={kø} />` en typefeil, altså nøyaktig mønsteret
 * dokumentasjonen anbefaler for å kalle `.show()` og `.hide()`. `key` kommer
 * samme vei.
 */
type Host = HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>

type FsFieldAttributes = Host & {
  invalid?: Flag
  disabled?: Flag
  optional?: Flag
  "required-marker"?: "none" | "symbol" | "text"
  "control-id"?: string
  "described-by"?: string
}

/**
 * `<fs-tabs>` har bare `server-controlled`.
 *
 * Hvilken fane som er valgt står i markupen serveren sendte, som
 * `aria-selected` på fanen og `hidden` på panelene. Komponenten leser det
 * derfra i stedet for å ha sin egen `selected`, slik at de to aldri kan si
 * hver sin ting.
 */
type FsTabsAttributes = Host & ServerControlled

type FsErrorSummaryAttributes = Host & {
  /**
   * Flytt fokus hit når boksen kommer til syne. Standard: på.
   * Sett `"false"` for å la være.
   */
  "data-autofocus"?: "false"
}

type FsSuggestionAttributes = Host & {
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
} & ServerControlled

type FsDialogAttributes = Host &
  ServerControlled & {
    /** Dialogen er åpen. Komponenten kaller `showModal()`. */
    open?: Flag
  }

type FsPopoverAttributes = Host &
  ServerControlled & {
    open?: Flag
    /** Hvilken kant panelet henger fra. */
    placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end"
  }

type FsSessionTimeoutAttributes = Host & {
  /** Sekunder uten aktivitet før varselet kommer. */
  "warn-at"?: number | string
  /** Sekunder uten aktivitet før økten er ute. */
  "expires-at"?: number | string
}

type FsConnectionStatusAttributes = Host & {
  /** Teksten når forbindelsen er borte. */
  "offline-text"?: string
  /** Teksten når den kommer tilbake. */
  "online-text"?: string
}

type FsToastAttributes = Host & {
  /** Millisekunder før meldingene forsvinner. */
  duration?: number
  /** Tekst som sier hva regionen er. */
  label?: string
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "fs-dialog": FsDialogAttributes
      "fs-error-summary": FsErrorSummaryAttributes
      "fs-field": FsFieldAttributes
      "fs-popover": FsPopoverAttributes
      "fs-suggestion": FsSuggestionAttributes
      "fs-tabs": FsTabsAttributes
      "fs-session-timeout": FsSessionTimeoutAttributes
      "fs-connection-status": FsConnectionStatusAttributes
      "fs-toast": FsToastAttributes
    }
  }
}

export type {
  FsConnectionStatusAttributes,
  FsDialogAttributes,
  FsErrorSummaryAttributes,
  FsFieldAttributes,
  FsPopoverAttributes,
  FsSessionTimeoutAttributes,
  FsSuggestionAttributes,
  FsTabsAttributes,
  FsToastAttributes,
}
