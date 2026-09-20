import { INPUT_CLASS, input } from "../input/input.js"
import {
  attributes,
  type FieldState,
  fieldStates,
  isFieldState,
} from "../shared.js"

export const SEARCH_CLASS = "fs-search" as const
/** Raden med søkefeltet og knappen ved siden av. */
export const SEARCH_ROW_CLASS = "fs-search-row" as const

export type SearchOptions = {
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
}

export type SearchAttributes = {
  class: `${typeof INPUT_CLASS} ${typeof SEARCH_CLASS}`
  type: "search"
  "data-state"?: "invalid" | "success"
  "aria-invalid"?: "true"
}

/**
 * Attributtene for et søkefelt.
 *
 * Feltet er en `fs-input` med plass til forstørrelsesglasset, så begge
 * klassene settes. `type="search"` gir nettleserens eget kryss for å tømme
 * feltet, og på mobil et tastatur med «Søk» i stedet for «Enter».
 *
 * ```ts
 * <input {...search()} name="q" />
 * ```
 */
export const search = Object.assign(
  ({ state = "default" }: SearchOptions = {}): SearchAttributes => {
    const base = input({ type: "search", state })
    return attributes({
      ...base,
      class: `${INPUT_CLASS} ${SEARCH_CLASS}` as const,
      type: "search" as const,
      "data-variant": undefined,
    }) as SearchAttributes
  },
  {
    /** Klassen på raden med feltet og knappen. */
    row: SEARCH_ROW_CLASS,
    states: fieldStates,
    isState: isFieldState,
  },
)
