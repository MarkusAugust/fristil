import { attributes, createGuard } from "../shared.js"

export const LIST_CLASS = "lt-list" as const

export const listVariants = ["default", "plain", "divided"] as const

export type ListVariant = (typeof listVariants)[number]
export type NonDefaultListVariant = Exclude<ListVariant, "default">

export type ListOptions = {
  /** Punkter, rene rader, eller rader med strek mellom. Standard: `default`. */
  variant?: ListVariant
}

export type ListAttributes = {
  class: typeof LIST_CLASS
  "data-variant"?: NonDefaultListVariant
}

/**
 * Attributtene for en liste.
 *
 * Klassen hører på `<ul>` eller `<ol>`. `plain` og `divided` fjerner punktene
 * visuelt, men listen blir værende en liste, så skjermleseren sier fortsatt
 * hvor mange elementer den har. Det er grunnen til at varianten finnes: uten
 * den ville folk brukt `<div>` for å bli kvitt punktene. Unntaket er Safari,
 * der en `<ul>` uten synlige punkter kan trenge `role="list"`. Se
 * komponentsiden.
 *
 * ```ts
 * <ul {...list({ variant: "divided" })}>…</ul>
 * ```
 */
export const list = Object.assign(
  ({ variant = "default" }: ListOptions = {}): ListAttributes =>
    attributes({
      class: LIST_CLASS,
      "data-variant": variant === "default" ? undefined : variant,
    }),
  {
    variants: listVariants,
    isVariant: createGuard(listVariants),
  },
)
