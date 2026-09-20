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

type FsTabsAttributes = HTMLAttributes<HTMLElement> & {
  /** Indeksen på fanen som er valgt. */
  selected?: number
  /** Tekst som sier hva fanene velger mellom. */
  label?: string
}

type FsErrorSummaryAttributes = HTMLAttributes<HTMLElement> & {
  /** Overskriften over lista med feil. */
  heading?: string
  /** Flytt fokus hit når boksen kommer til syne. */
  autofocus?: Flag
}

type FsSuggestionAttributes = HTMLAttributes<HTMLElement> & {
  label?: string
  value?: string
  name?: string
  placeholder?: string
  "help-text"?: string
  "error-text"?: string
  "control-id"?: string
  "described-by"?: string
  "no-results-text"?: string
  invalid?: Flag
  required?: Flag
  optional?: Flag
  disabled?: Flag
  open?: Flag
}

type FsPopoverAttributes = HTMLAttributes<HTMLElement> & {
  open?: Flag
  /** Hvilken kant panelet henger fra. */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end"
}

type FsToastAttributes = HTMLAttributes<HTMLElement> & {
  /** Millisekunder før meldingene forsvinner. */
  duration?: number
  /** Tekst som sier hva regionen er. */
  label?: string
}

type FsCalendarAttributes = HTMLAttributes<HTMLElement> & {
  /** Valgt dato som `ÅÅÅÅ-MM-DD`. */
  value?: string
  open?: Flag
  disabled?: Flag
  "trigger-hidden"?: Flag
}

type FsDateFieldAttributes = HTMLAttributes<HTMLElement> & {
  label?: string
  /** Datoen som `ÅÅÅÅ-MM-DD`, alltid ISO. */
  value?: string
  name?: string
  placeholder?: string
  "help-text"?: string
  "error-text"?: string
  "control-id"?: string
  "described-by"?: string
  invalid?: Flag
  required?: Flag
  optional?: Flag
  disabled?: Flag
  readonly?: Flag
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "fs-error-summary": FsErrorSummaryAttributes
      "fs-field": FsFieldAttributes
      "fs-popover": FsPopoverAttributes
      "fs-suggestion": FsSuggestionAttributes
      "fs-tabs": FsTabsAttributes
      "fs-toast": FsToastAttributes
      "fs-calendar": FsCalendarAttributes
      "fs-date-field": FsDateFieldAttributes
    }
  }
}

export type {
  FsCalendarAttributes,
  FsDateFieldAttributes,
  FsErrorSummaryAttributes,
  FsFieldAttributes,
  FsPopoverAttributes,
  FsSuggestionAttributes,
  FsTabsAttributes,
  FsToastAttributes,
}
