import { attributes, createGuard } from "../shared.js"

export const HEADING_CLASS = "fs-heading" as const

export const headingSizes = ["xs", "s", "m", "l", "xl", "mega"] as const

export type HeadingSize = (typeof headingSizes)[number]
export type NonDefaultHeadingSize = Exclude<HeadingSize, "l">

export type HeadingOptions = {
  /** Visuell størrelse. Standard: `l`. */
  size?: HeadingSize
}

export type HeadingAttributes = {
  class: typeof HEADING_CLASS
  "data-size"?: NonDefaultHeadingSize
}

/**
 * Attributtene for en overskrift.
 *
 * Størrelsen og nivået er to forskjellige ting. Nivået er `<h1>` til `<h6>`
 * og bestemmer strukturen skjermlesere navigerer etter; `size` bestemmer bare
 * hvor stor teksten ser ut. En `<h2>` som skal se liten ut er riktig; en
 * `<h4>` valgt fordi den var liten nok, hopper over et nivå i strukturen.
 *
 * ```ts
 * <h2 {...heading({ size: "m" })}>Vedlegg</h2>
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
