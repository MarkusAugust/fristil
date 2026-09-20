import {
  attributes,
  type FieldState,
  fieldStates,
  isFieldState,
  type NonDefaultFieldState,
} from "../shared.js"

export const FILE_UPLOAD_CLASS = "fs-file-upload" as const
/** Lista over filene som er valgt. */
export const FILE_UPLOAD_LIST_CLASS = "fs-file-upload-list" as const

export type FileUploadOptions = {
  /** Valideringstilstand. Standard: `default`. */
  state?: FieldState
  /** Tillat flere filer. */
  multiple?: boolean
  /** Filtypene feltet tar imot, som `.pdf,image/*`. */
  accept?: string
}

export type FileUploadAttributes = {
  class: typeof FILE_UPLOAD_CLASS
  type: "file"
  multiple?: true
  accept?: string
  "data-state"?: NonDefaultFieldState
  "aria-invalid"?: "true"
}

/**
 * Attributtene for et filopplastingsfelt.
 *
 * Feltet er et vanlig `<input type="file">`. Knappen inni er nettleserens
 * egen, og teksten på den kommer fra operativsystemets språk. Den kan ikke
 * oversettes, så ledeteksten over feltet må si hva som skal lastes opp.
 *
 * `accept` er en hjelp i filvelgeren, ikke en sperre. Brukeren kan velge
 * «alle filer», så typen må sjekkes på serveren uansett.
 *
 * ```ts
 * <input {...fileUpload({ multiple: true, accept: ".pdf" })} />
 * ```
 */
export const fileUpload = Object.assign(
  ({
    state = "default",
    multiple,
    accept,
  }: FileUploadOptions = {}): FileUploadAttributes =>
    attributes({
      class: FILE_UPLOAD_CLASS,
      type: "file" as const,
      multiple: multiple ? (true as const) : undefined,
      accept,
      "data-state": state === "default" ? undefined : state,
      "aria-invalid": state === "invalid" ? ("true" as const) : undefined,
    }),
  {
    /** Klassen på lista over valgte filer. */
    list: FILE_UPLOAD_LIST_CLASS,
    states: fieldStates,
    isState: isFieldState,
  },
)
