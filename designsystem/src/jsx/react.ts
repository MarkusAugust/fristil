import type { HTMLAttributes } from "react"

/**
 * Typer for Fristils egendefinerte elementer i JSX.
 *
 * Uten disse kjenner ikke TypeScript `<fs-field>` i det hele tatt — den sier
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
 * `"" | undefined` er med fordi et attributt er sant så lenge det finnes:
 * `invalid={false}` blir til `invalid="false"` i eldre React, og det er sant.
 * Mønsteret `invalid={ugyldig ? "" : undefined}` virker i alle versjoner.
 */
type Flagg = boolean | "" | undefined

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
