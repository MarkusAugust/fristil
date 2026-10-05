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

/** Klassen på knappen i en kolonneoverskrift som kan sorteres. */
export const TABLE_SORT_CLASS = "fs-table__sort" as const

export const tableSortDirections = ["ascending", "descending"] as const

export type TableSortDirection = (typeof tableSortDirections)[number]

export type TableSortOptions = {
  /**
   * Retningen kolonnen er sortert i. Utelatt betyr at tabellen ikke er
   * sortert etter denne kolonnen, og da får overskriften ikke `aria-sort`.
   */
  direction?: TableSortDirection
}

export type TableSortAttributes = {
  header: {
    "aria-sort"?: TableSortDirection
  }
  button: {
    class: typeof TABLE_SORT_CLASS
    type: "button"
  }
}

/**
 * Attributtene for en kolonneoverskrift som kan sorteres.
 *
 * `aria-sort` står på `<th>`, ikke på knappen, for det er cellen som
 * beskriver kolonnen. Bare den sorterte kolonnen har attributtet. Pila
 * tegnes fra det samme attributtet, så det skjermleseren sier og det som
 * vises kan ikke gli fra hverandre. Selve sorteringen er appens.
 *
 * ```ts
 * const dato = fs.tableSort({ direction: "descending" })
 * ```
 * ```html
 * <th scope="col" {...dato.header}>
 *   <button {...dato.button}>Dato</button>
 * </th>
 * ```
 */
export const tableSort = Object.assign(
  ({ direction }: TableSortOptions = {}): TableSortAttributes => ({
    header: attributes({ "aria-sort": direction }),
    button: attributes({ class: TABLE_SORT_CLASS, type: "button" as const }),
  }),
  {
    // Lista ligger ved siden av, som `tableSortDirections`, og ikke på
    // funksjonen. Vaktposten for listene krever at attributtet og klassen
    // står på samme element, og her står `aria-sort` på cellen og klassen på
    // knappen. At hver retning gir sin egen pil, krever tabelltesten.
    isDirection: createGuard(tableSortDirections),
  },
)
