import { attributes, createGuard } from "../shared.js"

export const SKELETON_CLASS = "lt-skeleton" as const

export const skeletonVariants = ["block", "text", "circle"] as const

export type SkeletonVariant = (typeof skeletonVariants)[number]
export type NonDefaultSkeletonVariant = Exclude<SkeletonVariant, "block">

export type SkeletonOptions = {
  /** Shape. Default: `block`. */
  variant?: SkeletonVariant
}

export type SkeletonAttributes = {
  class: typeof SKELETON_CLASS
  "data-variant"?: NonDefaultSkeletonVariant
  "aria-hidden": "true"
}

/**
 * The attributes for a placeholder while the content loads.
 *
 * The shapes are always hidden from screen readers. They say nothing about
 * what is coming, and a row of empty boxes being announced is worse than
 * silence. Announce the wait in one place instead, with `role="status"`.
 *
 * ```ts
 * <div {...skeleton({ variant: "text" })} />
 * ```
 */
export const skeleton = Object.assign(
  ({ variant = "block" }: SkeletonOptions = {}): SkeletonAttributes =>
    attributes({
      class: SKELETON_CLASS,
      "data-variant": variant === "block" ? undefined : variant,
      "aria-hidden": "true" as const,
    }),
  {
    variants: skeletonVariants,
    isVariant: createGuard(skeletonVariants),
  },
)
