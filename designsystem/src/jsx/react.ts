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
 * Boolske attributes på egendefinerte elementer.
 *
 * Typen er `true | undefined`, ikke `boolean`, og det er med vilje. React
 * behandler egendefinerte elementer ulikt mellom versjoner, og bare ett
 * mønster er riktig i begge:
 *
 *     React 18 setter attributes        React 19 setter egenskaper
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
type Flagg = true | undefined

type FsFieldAttributes = HTMLAttributes<HTMLElement> & {
  invalid?: Flagg
  disabled?: Flagg
  optional?: Flagg
  "required-marker"?: "none" | "symbol" | "text"
  "control-id"?: string
  "described-by"?: string
}

type FsCalendarAttributes = HTMLAttributes<HTMLElement> & {
  /** Valgt dato som `ÅÅÅÅ-MM-DD`. */
  value?: string
  open?: Flagg
  disabled?: Flagg
  "trigger-hidden"?: Flagg
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
  invalid?: Flagg
  required?: Flagg
  optional?: Flagg
  disabled?: Flagg
  readonly?: Flagg
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "fs-field": FsFieldAttributes
      "fs-calendar": FsCalendarAttributes
      "fs-date-field": FsDateFieldAttributes
    }
  }
}

export type { FsCalendarAttributes, FsDateFieldAttributes, FsFieldAttributes }
