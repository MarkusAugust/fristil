import { attributes, createGuard } from "../shared.js"

export const AVATAR_CLASS = "fs-avatar" as const
/** Flere profilbilder som overlapper. */
export const AVATAR_STACK_CLASS = "fs-avatar-stack" as const

export const avatarSizes = ["small", "medium", "large"] as const
export const avatarVariants = ["circle", "square"] as const

export type AvatarSize = (typeof avatarSizes)[number]
export type AvatarVariant = (typeof avatarVariants)[number]
export type NonDefaultAvatarSize = Exclude<AvatarSize, "medium">
export type NonDefaultAvatarVariant = Exclude<AvatarVariant, "circle">

export type AvatarOptions = {
  /** Størrelse. Standard: `medium`. */
  size?: AvatarSize
  /** Rund eller avrundet firkant. Standard: `circle`. */
  variant?: AvatarVariant
}

export type AvatarAttributes = {
  class: typeof AVATAR_CLASS
  "data-size"?: NonDefaultAvatarSize
  "data-variant"?: NonDefaultAvatarVariant
}

/**
 * Attributtene for et profilbilde eller initialer.
 *
 * Står navnet allerede ved siden av, er bildet pynt: sett `aria-hidden="true"`
 * på det, ellers leses navnet opp to ganger. Står bildet alene, må det ha en
 * tekst som sier hvem det er.
 *
 * ```ts
 * <span {...avatar({ size: "small" })} aria-hidden="true">ON</span>
 * ```
 */
export const avatar = Object.assign(
  ({
    size = "medium",
    variant = "circle",
  }: AvatarOptions = {}): AvatarAttributes =>
    attributes({
      class: AVATAR_CLASS,
      "data-size": size === "medium" ? undefined : size,
      "data-variant": variant === "circle" ? undefined : variant,
    }),
  {
    /** Klassen på lista med profilbilder som overlapper. */
    stack: AVATAR_STACK_CLASS,
    sizes: avatarSizes,
    isSize: createGuard(avatarSizes),
    variants: avatarVariants,
    isVariant: createGuard(avatarVariants),
  },
)
