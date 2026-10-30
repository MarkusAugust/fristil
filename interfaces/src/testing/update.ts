/**
 * The three ways an update from the server reaches a page in the tests:
 * Datastar's patch, idiomorph (which htmx morphs with) and `innerHTML` or
 * `outerHTML`. The morphers are the real ones, vendored, so the tests see
 * what an app sees.
 */
import { Idiomorph } from "./idiomorph/idiomorph-v0.8.0.js"

import "./datastar/datastar-v1.0.4.js"

/** How the content of a region is updated: `innerHTML` keeps the region. */
export type Way = "Datastar" | "idiomorph" | "innerHTML"
export const WAYS: Way[] = ["Datastar", "idiomorph", "innerHTML"]

/** How an element is replaced: `outerHTML` makes a new one. */
export type Replacement = "Datastar" | "idiomorph" | "outerHTML"
export const REPLACEMENTS: Replacement[] = [
  "Datastar",
  "idiomorph",
  "outerHTML",
]

/**
 * A `datastar-patch-elements`, as the server sends it. Without a selector
 * it patches `outer` on the element with the id in the markup.
 */
export function datastarPatch(
  elements: string,
  options: { selector?: string; mode?: string } = {},
): void {
  document.dispatchEvent(
    new CustomEvent("datastar-fetch", {
      detail: {
        type: "datastar-patch-elements",
        el: document.body,
        argsRaw: { elements, ...options },
      },
    }),
  )
}

/** idiomorph's `outerHTML` morph, with the text the user typed kept. */
export function morph(root: Element, html: string): void {
  Idiomorph.morph(root, html, {
    morphStyle: "outerHTML",
    ignoreActiveValue: true,
  })
}

/**
 * Replaces the element with `id` by `html`, which must carry the same id,
 * the way `way` does it: Datastar's `outer` patch, idiomorph's `outerHTML`
 * morph with the typed text kept, or a plain `outerHTML`.
 */
export function replace(way: Replacement, id: string, html: string): void {
  const root = document.getElementById(id)
  if (!root) throw new Error(`no element with the id "${id}" to update`)
  if (way === "Datastar") datastarPatch(html)
  else if (way === "idiomorph") morph(root, html)
  else root.outerHTML = html
}
