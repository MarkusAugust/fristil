import { attributes, createGuard } from "../shared.js"

export const PROGRESS_CLASS = "fs-progress" as const

export const progressColors = ["success", "warning", "danger"] as const

export type ProgressColor = (typeof progressColors)[number]

export type ProgressOptions = {
  /** Hvor langt det er kommet. Utelat den, og stolpen blir ubestemt. */
  value?: number
  /** Hva som er fullt. Standard: `100`. */
  max?: number
  /** Hva tallet betyr. Standard er aksentfargen, altså «dette pågår». */
  color?: ProgressColor
  /** Hva som pågår. Blir `aria-label`, så stolpen har et navn. */
  label?: string
}

export type ProgressAttributes = {
  class: typeof PROGRESS_CLASS
  value?: string
  max: string
  "data-color"?: ProgressColor
  "aria-label"?: string
}

/**
 * Attributtene for en framdriftsstolpe på et `<progress>`.
 *
 * Elementet har semantikken innebygd: nettleseren melder det som
 * `role="progressbar"` og leser opp hvor langt det er kommet. Du trenger
 * verken rolle, `aria-valuenow` eller `aria-valuemax`.
 *
 * Utelater du `value`, blir stolpen ubestemt: «noe pågår, vi vet ikke hvor
 * lenge». Det er det samme som `fs.spinner()` sier, så velg én av dem.
 *
 * ```ts
 * <progress {...progress({ value: 3, max: 7, label: "Steg 3 av 7" })} />
 * ```
 *
 * `max` har standardverdien 100 og skrives alltid ut, i strid med regelen om
 * at en standardverdi ikke gir noe attributt. Grunnen er at den regelen
 * gjelder utseende, der CSS-en alt har svaret. `max` er semantikk, og HTMLs
 * egen standard er `1`: en `<progress value="40">` uten `max` viser en full
 * stolpe, uten at noe sier fra.
 */
export const progress = Object.assign(
  ({
    value,
    max = 100,
    color,
    label,
  }: ProgressOptions = {}): ProgressAttributes =>
    attributes({
      class: PROGRESS_CLASS,
      // Tallene sendes ut som strenger, som resten av returverdiene: det er
      // HTML-formen, og den er det `setAttributes` tar imot.
      value: value === undefined ? undefined : String(value),
      max: String(max),
      "data-color": color,
      "aria-label": label,
    }),
  {
    colors: progressColors,
    isColor: createGuard(progressColors),
  },
)
