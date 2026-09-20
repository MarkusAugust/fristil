import { attributes, createGuard } from "../shared.js"

export const SKELETON_CLASS = "fs-skeleton" as const

export const skeletonVariants = ["block", "text", "circle"] as const

export type SkeletonVariant = (typeof skeletonVariants)[number]
export type NonDefaultSkeletonVariant = Exclude<SkeletonVariant, "block">

export type SkeletonOptions = {
  /** Form. Standard: `block`. */
  variant?: SkeletonVariant
}

export type SkeletonAttributes = {
  class: typeof SKELETON_CLASS
  "data-variant"?: NonDefaultSkeletonVariant
  "aria-hidden": "true"
}

/**
 * Attributtene for en plassholder mens innholdet lastes.
 *
 * Formene er alltid skjult for skjermlesere. De sier ingenting om hva som
 * kommer, og en rekke tomme bokser som leses opp er verre enn stillhet. Si
 * fra om ventingen ett sted i stedet, med `role="status"`.
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
