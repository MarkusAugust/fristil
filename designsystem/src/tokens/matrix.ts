/**
 * Matrisen, som `@fristil/designsystem/matrise`: familie ganger rolle, som
 * ferdige tokens.
 *
 * Ingen palett, ingen trinn, ingen pinner: rollen *er* fargen. Navnene følger
 * navnerommene til Tailwind, daisyUI og Digdir, altså systemprefiks, slag og
 * sti.
 *
 * Fargene regnes av kjernen. Her er Fristils egne, og navnene. En matrise for
 * andre merkefarger er `light` og `dark` i temaet `buildTheme` gir.
 */

import type { Role } from "./matrise.js"

export {
  darkCells,
  FAMILIES,
  type Family,
  FRISTIL_BRANDS,
  lightCells,
  type MatrixToken,
} from "./matrise.js"

/** Rollenavnet slik det skrives i CSS. `textSubtle` blir `text-subtle`. */
export function roleToCss(role: Role): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Tokennavnet for én celle i matrisen. */
export function tokenName(family: string, role: string): string {
  return `--fs-color-${family}-${role}`
}
