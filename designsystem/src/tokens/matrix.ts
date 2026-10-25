/**
 * The matrix, as `@lo-tek/interfaces/matrix`: family times role, as finished
 * tokens.
 *
 * No palette, no steps, no pins: the role *is* the colour. The names follow
 * the namespaces of Tailwind, daisyUI and Digdir: system prefix, kind and
 * path.
 *
 * The colours are computed by the core. Here are LO-TEK's colours, and the
 * names. A matrix for other brand colours is `light` and `dark` in the theme
 * `buildTheme` returns.
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

/** The role name as it is written in CSS. `textSubtle` becomes `text-subtle`. */
export function roleToCss(role: Role): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** The token name for one cell in the matrix. */
export function tokenName(family: string, role: string): string {
  return `--lt-color-${family}-${role}`
}
