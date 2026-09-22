import type { HTMLAttributes } from "react"

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
 * Typen er `true | undefined`, ikke `boolean`, og det er med vilje. React
 * behandler egendefinerte elementer ulikt mellom versjoner, og bare ett
 * mønster er riktig i begge:
 *
 *     React 18 setter attributter       React 19 setter egenskaper
 *     invalid=""       virker            aldri ugyldig
 *     invalid={true}   virker            virker
 *     invalid={false}  ALLTID ugyldig    virker
 *     invalid={undefined}  virker        virker
 *
 * React 18 stringifiserer til `invalid="false"`. Attributtet finnes da,
 * og er dermed sant. React 19 setter egenskapen til `""`, som er usann.
 *
 * Skriv derfor `invalid={ugyldig || undefined}`. Typen her gjør at de to
 * andre variantene blir kompileringsfeil i stedet for noe du må huske.
 */
type Flag = true | undefined

type FsFieldAttributes = HTMLAttributes<HTMLElement> & {
  invalid?: Flag
  disabled?: Flag
  optional?: Flag
  "required-marker"?: "none" | "symbol" | "text"
  "control-id"?: string
  "described-by"?: string
}

/**
 * `<fs-tabs>` har ingen attributter.
 *
 * Hvilken fane som er valgt står i markupen serveren sendte, som
 * `aria-selected` på fanen og `hidden` på panelene. Komponenten leser det
 * derfra i stedet for å ha sin egen `selected`, slik at de to aldri kan si
 * hver sin ting.
 */
type FsTabsAttributes = HTMLAttributes<HTMLElement>

type FsErrorSummaryAttributes = HTMLAttributes<HTMLElement> & {
  /**
   * Flytt fokus hit når boksen kommer til syne. Standard: på.
   * Sett `"false"` for å la være.
   */
  autofocus?: "false"
}

type FsSuggestionAttributes = HTMLAttributes<HTMLElement> & {
  /**
   * Slår av filtreringen på klienten. Bruk den når serveren sender lista på
   * nytt mens brukeren skriver, som i en Datastar-app: da er det serveren som
   * bestemmer hva som vises.
   */
  "server-filtered"?: Flag
}

type FsDialogAttributes = HTMLAttributes<HTMLElement> & {
  /** Dialogen er åpen. Komponenten kaller `showModal()`. */
  open?: Flag
}

type FsPopoverAttributes = HTMLAttributes<HTMLElement> & {
  open?: Flag
  /** Hvilken kant panelet henger fra. */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end"
}

type FsSessionTimeoutAttributes = HTMLAttributes<HTMLElement> & {
  /** Sekunder uten aktivitet før varselet kommer. */
  "warn-at"?: number
  /** Sekunder uten aktivitet før økten er ute. */
  "expires-at"?: number
}

type FsConnectionStatusAttributes = HTMLAttributes<HTMLElement> & {
  /** Teksten når forbindelsen er borte. */
  "offline-text"?: string
  /** Teksten når den kommer tilbake. */
  "online-text"?: string
}

type FsToastAttributes = HTMLAttributes<HTMLElement> & {
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
