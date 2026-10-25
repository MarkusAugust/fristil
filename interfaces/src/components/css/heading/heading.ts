import { attributes, createGuard } from "../shared.js"

export const HEADING_CLASS = "lt-heading" as const

export const headingSizes = ["xs", "s", "m", "l", "xl", "mega"] as const

export type HeadingSize = (typeof headingSizes)[number]
export type NonDefaultHeadingSize = Exclude<HeadingSize, "l">

export type HeadingOptions = {
  /** Visual size. Default: `l`. */
  size?: HeadingSize
}

export type HeadingAttributes = {
  class: typeof HEADING_CLASS
  "data-size"?: NonDefaultHeadingSize
}

/**
 * The attributes for a heading.
 *
 * Size and level are two different things. The level is `<h1>` to `<h6>`
 * and sets the structure screen readers navigate by; `size` only sets how
 * large the text looks. An `<h2>` that should look small is correct; an
 * `<h4>` chosen because it was small enough skips a level in the structure.
 *
 * ```ts
 * <h2 {...heading({ size: "m" })}>Attachments</h2>
 * ```
 */
export const heading = Object.assign(
  ({ size = "l" }: HeadingOptions = {}): HeadingAttributes =>
    attributes({
      class: HEADING_CLASS,
      "data-size": size === "l" ? undefined : size,
    }),
  {
    sizes: headingSizes,
    isSize: createGuard(headingSizes),
  },
)
