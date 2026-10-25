import { parseHex } from "../tokens/color.js"
import { colorTokens, darkColorTokens } from "../tokens/tokens.js"

/**
 * Token values as `rgb(r, g, b)`, the way `getComputedStyle` answers.
 *
 * A test that copies a token's hex value must be corrected every time the
 * contract moves a lightness, and then says nothing about whether the
 * component uses the right token. It reads the colour from here instead.
 */
const LIGHT = colorTokens
const DARK = { ...colorTokens, ...darkColorTokens }

/** The system colours point to a cell in the matrix, so the chain must be followed. */
function resolve(table: Record<string, string>, token: string): string {
  let value = table[token]
  let guard = 0
  while (value?.startsWith("var(") && guard++ < 10)
    value = table[value.slice(4, -1)]
  return value
}

export function color(
  token: string,
  appearance: "light" | "dark" = "light",
): string {
  const hex = resolve(appearance === "dark" ? DARK : LIGHT, token)
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
export function rgb(value: string): {
  r: number
  g: number
  b: number
  a: number
} {
  const [r = 0, g = 0, b = 0, a = 1] = value.match(/[\d.]+/g)?.map(Number) ?? []
  return { r, g, b, a }
}
