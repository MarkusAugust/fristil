import { parseHex } from "../tokens/color.js"
import { colorTokens, darkColorTokens } from "../tokens/tokens.js"

/**
 * Token values as `rgb(r, g, b)`, the way `getComputedStyle` answers.
 *
 * A test that copies a token's hex value must be corrected every time the
 * contract moves a lightness, and then says nothing about whether the
 * component uses the right token. It reads the colour from here instead.
 */
const LYS = colorTokens
const MØRK = { ...colorTokens, ...darkColorTokens }

/** The system colours point to a cell in the matrix, so the chain must be followed. */
function løs(tabell: Record<string, string>, token: string): string {
  let verdi = tabell[token]
  let vakt = 0
  while (verdi?.startsWith("var(") && vakt++ < 10)
    verdi = tabell[verdi.slice(4, -1)]
  return verdi
}

export function color(
  token: string,
  utseende: "light" | "dark" = "light",
): string {
  const hex = løs(utseende === "dark" ? MØRK : LYS, token)
  if (!hex?.startsWith("#")) {
    throw new Error(`Unknown token, or not a hex colour: ${token}`)
  }
  const { r, g, b } = parseHex(hex)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Reads `rgb(r, g, b)` or `rgba(r, g, b, a)` from `getComputedStyle`, so a
 * test can compute the contrast between the two colours it reads.
 */
export function rgb(verdi: string): {
  r: number
  g: number
  b: number
  a: number
} {
  const [r = 0, g = 0, b = 0, a = 1] = verdi.match(/[\d.]+/g)?.map(Number) ?? []
  return { r, g, b, a }
}
