import { attributes, createGuard } from "../shared.js"

export const BADGE_CLASS = "fs-badge" as const

export const badgeColors = [
  "info",
  "success",
  "warning",
  "danger",
  "neutral",
] as const

export type BadgeColor = (typeof badgeColors)[number]
export type NonInfoBadgeColor = Exclude<BadgeColor, "info">

export type BadgeOptions = {
  /** Hva tilstanden betyr. Standard: `info`. */
  color?: BadgeColor
}

export type BadgeAttributes = {
  class: typeof BADGE_CLASS
  "data-color"?: NonInfoBadgeColor
}

/**
 * Attributtene for et statusmerke.
 *
 * ```ts
 * <span {...badge({ color: "success" })}>Innvilget</span>
 * ```
 */
export const badge = Object.assign(
  ({ color = "info" }: BadgeOptions = {}): BadgeAttributes =>
    attributes({
      class: BADGE_CLASS,
      "data-color": color === "info" ? undefined : color,
    }),
  {
    colors: badgeColors,
    isColor: createGuard(badgeColors),
  },
)
