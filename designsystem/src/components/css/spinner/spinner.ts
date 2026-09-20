import { attributes, createGuard } from "../shared.js"

export const SPINNER_CLASS = "fs-spinner" as const

export const spinnerSizes = ["small", "medium", "large"] as const

export type SpinnerSize = (typeof spinnerSizes)[number]
export type NonDefaultSpinnerSize = Exclude<SpinnerSize, "medium">

export type SpinnerOptions = {
  /** Størrelse. Standard: `medium`. */
  size?: SpinnerSize
  /** Hva som lastes. Blir `aria-label`, så ventingen kan leses opp. */
  label?: string
}

export type SpinnerAttributes = {
  class: typeof SPINNER_CLASS
  "data-size"?: NonDefaultSpinnerSize
  role?: "status"
  "aria-label"?: string
}

/**
 * Attributtene for en venteindikator.
 *
 * Uten `label` er ringen bare en form, og skjermlesere melder ingenting. Med
 * `label` blir den en `role="status"` som sier hva som pågår. Har du allerede
 * en synlig tekst ved siden av, la den bære beskjeden og dropp `label`, så
 * det samme ikke leses opp to ganger.
 *
 * ```ts
 * <span {...spinner({ label: "Laster søknader" })} />
 * ```
 */
export const spinner = Object.assign(
  ({ size = "medium", label }: SpinnerOptions = {}): SpinnerAttributes =>
    attributes({
      class: SPINNER_CLASS,
      "data-size": size === "medium" ? undefined : size,
      role: label ? ("status" as const) : undefined,
      "aria-label": label,
    }),
  {
    sizes: spinnerSizes,
    isSize: createGuard(spinnerSizes),
  },
)
