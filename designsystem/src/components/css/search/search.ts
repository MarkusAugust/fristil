import { INPUT_CLASS, input } from "../input/input.js"
import {
  attributes,
  type FieldState,
  fieldStates,
  isFieldState,
} from "../shared.js"

export const SEARCH_CLASS = "lt-search" as const
/** The row with the search field and the button next to it. */
export const SEARCH_ROW_CLASS = "lt-search-row" as const

export type SearchOptions = {
  /** Validation state. Default: `default`. */
  state?: FieldState
}

export type SearchAttributes = {
  class: `${typeof INPUT_CLASS} ${typeof SEARCH_CLASS}`
  type: "search"
  "data-state"?: "invalid" | "success"
  "aria-invalid"?: "true"
}

/**
 * The attributes for a search field.
 *
 * The field is an `lt-input` with room for the magnifying glass, so both
 * classes are set. `type="search"` gives the browser's own cross for
 * clearing the field, and on mobile a keyboard with "Search" instead of
 * "Enter".
 *
 * ```ts
 * <input {...search()} name="q" />
 * ```
 */
export const search = Object.assign(
  ({ state = "default" }: SearchOptions = {}): SearchAttributes => {
    const base = input({ type: "search", state })
    return attributes(
      {
        ...base,
        class: `${INPUT_CLASS} ${SEARCH_CLASS}` as const,
        type: "search" as const,
        "data-variant": undefined,
      },
      base,
    ) as SearchAttributes
  },
  {
    /** The class on the row with the field and the button. */
    row: SEARCH_ROW_CLASS,
    states: fieldStates,
    isState: isFieldState,
  },
)
