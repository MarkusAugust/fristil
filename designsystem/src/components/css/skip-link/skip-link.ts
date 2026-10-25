import { attributes } from "../shared.js"

export const SKIP_LINK_CLASS = "lt-skip-link" as const

export type SkipLinkAttributes = {
  class: typeof SKIP_LINK_CLASS
}

/**
 * The attributes for a skip-to-content link.
 *
 * The link must be the first element in `<body>`, and point to the id of the
 * main content. It sits off screen until it gets focus, and therefore cannot
 * be hidden with `display: none`: the keyboard could not reach it either,
 * and the whole point is lost.
 *
 * ```ts
 * <a {...skipLink()} href="#main-content">Skip to main content</a>
 * ```
 */
export const skipLink = (): SkipLinkAttributes =>
  attributes({ class: SKIP_LINK_CLASS })
