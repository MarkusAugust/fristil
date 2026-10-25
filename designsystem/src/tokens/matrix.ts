/**
 * Matrisen, som `@lo-tek/interfaces/matrix-cells`: familie ganger rolle, som
 * ferdige tokens.
 *
 * Ingen palett, ingen trinn, ingen pinner: rollen *er* fargen. Navnene følger
 * navnerommene til Tailwind, daisyUI og Digdir, altså systemprefiks, slag og
 * sti.
 *
 * Fargene regnes av kjernen. Her er LO-TEKs egne, og navnene. En matrise for
 * andre merkefarger er `light` og `dark` i temaet `buildTheme` gir.
 */

import type { Role } from "./matrix-cells.js"

export {
  darkCells,
  FAMILIES,
  type Family,
  LOTEK_BRANDS,
  lightCells,
  type MatrixToken,
} from "./matrix-cells.js"

/** Rollenavnet slik det skrives i CSS. `textSubtle` blir `text-subtle`. */
export function roleToCss(role: Role): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Tokennavnet for én celle i matrisen. */
export function tokenName(family: string, role: string): string {
  return `--lt-color-${family}-${role}`
}
