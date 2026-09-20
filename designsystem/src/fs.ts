import { badge } from "./components/css/badge/badge.js"
import { button } from "./components/css/button/button.js"
import { errorText } from "./components/css/error-text/error-text.js"
import { helpText } from "./components/css/help-text/help-text.js"
import { input } from "./components/css/input/input.js"
import { label } from "./components/css/label/label.js"
import { link } from "./components/css/link/link.js"
import { select } from "./components/css/select/select.js"
import {
  fieldStates,
  isFieldState,
  isRequiredMarker,
  requiredMarkers,
} from "./components/css/shared.js"
import { textarea } from "./components/css/textarea/textarea.js"
import { computeFieldAttributes } from "./components/ramme/field/field-core.js"

/**
 * Hele komponent-API-et på ett sted.
 *
 * Hver komponent er en funksjon som tar et valgobjekt og returnerer
 * attributtene du sprer inn i elementet:
 *
 * ```ts
 * import { fs } from "@fristil/designsystem"
 *
 * <button {...fs.button({ variant: "secondary" })}>Lagre utkast</button>
 * <input {...fs.input({ type: "email", state: "invalid" })} />
 * <span {...fs.badge({ color: "success" })}>Innvilget</span>
 * ```
 *
 * Formen er den samme for alle, så du lærer den én gang. Skriv `fs.` i
 * editoren for å se hva som finnes; skriv `fs.button.` for å se de lovlige
 * variantene og vakten som validerer verdier utenfra.
 *
 * Returverdiene er vanlige objekter. Det er grunnen til at det samme API-et
 * virker i React, Vue, Svelte og ren HTML.
 */
export const fs = {
  badge,
  button,
  errorText,
  /**
   * Kobler sammen ledetekst, felt, hjelpetekst og feilmelding.
   *
   * ```ts
   * const felt = fs.field({ id: "epost", required: "text", help: true, error: true, invalid })
   *
   * <label {...felt.label}>E-postadresse</label>
   * <input {...fs.input({ type: "email", state: felt.state })} {...felt.control} />
   * <p {...fs.helpText()} {...felt.help}>Vi sender kvittering hit.</p>
   * <p {...fs.errorText()} {...felt.error}>Skriv en gyldig adresse.</p>
   * ```
   *
   * Samme utregning som `<fs-field>` gjør — her som data, så du kan eie
   * markupen selv uten å registrere et custom element.
   */
  field: computeFieldAttributes,
  helpText,
  input,
  label,
  link,
  select,
  textarea,

  /** Valideringstilstandene som deles av input, textarea og select. */
  states: fieldStates,
  isState: isFieldState,
  /** Måtene et påkrevd felt kan markeres på. */
  markers: requiredMarkers,
  isMarker: isRequiredMarker,
} as const

export type Fs = typeof fs
