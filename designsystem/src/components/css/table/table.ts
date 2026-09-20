import { attributes, createGuard } from "../shared.js"

export const TABLE_CLASS = "fs-table" as const
/** Beholderen som lar en bred tabell rulles sidelengs. */
export const TABLE_SCROLL_CLASS = "fs-table-scroll" as const

export const tableVariants = ["default", "striped"] as const

export type TableVariant = (typeof tableVariants)[number]
export type NonDefaultTableVariant = Exclude<TableVariant, "default">

export type TableOptions = {
  /** Annenhver rad i dempet flate. Standard: `default`. */
  variant?: TableVariant
  /** Marker raden under musa. Bruk bare når rader kan trykkes på. */
  hoverable?: boolean
}

export type TableAttributes = {
  class: typeof TABLE_CLASS
  "data-variant"?: NonDefaultTableVariant
  "data-hoverable"?: ""
}

/**
 * Attributtene for en tabell.
 *
 * Klassen hører på et ekte `<table>` med `<thead>` og `<th>`. Det er
 * overskriftscellene som gjør at skjermlesere kan si «Beløp, 1 240 kroner»
 * når brukeren står i en celle. Bygger du tabellen av `<div>`-er, finnes ikke
 * den koblingen.
 *
 * ```ts
 * <table {...table({ variant: "striped" })}>…</table>
 * ```
 */
export const table = Object.assign(
  ({ variant = "default", hoverable }: TableOptions = {}): TableAttributes =>
    attributes({
      class: TABLE_CLASS,
      "data-variant": variant === "default" ? undefined : variant,
      "data-hoverable": hoverable ? ("" as const) : undefined,
    }),
  {
    /** Klassen på beholderen rundt en bred tabell. */
    scroll: TABLE_SCROLL_CLASS,
    variants: tableVariants,
    isVariant: createGuard(tableVariants),
  },
)
