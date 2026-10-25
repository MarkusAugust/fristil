import { parseHex } from "../tokens/color.js"
import { colorTokens, darkColorTokens } from "../tokens/tokens.js"

/**
 * Tokenverdier som `rgb(r, g, b)`, slik `getComputedStyle` svarer.
 *
 * En test som skriver av heksverdien til et token må rettes hver gang
 * kontrakten flytter en lyshet, og sier da ingenting om at komponenten bruker
 * riktig token. Den leser fargen herfra i stedet.
 */
const LYS = colorTokens
const MØRK = { ...colorTokens, ...darkColorTokens }

/** Systemfargene peker på en celle i matrisen, så kjeden må følges. */
function løs(tabell: Record<string, string>, token: string): string {
  let verdi = tabell[token]
  let vakt = 0
  while (verdi?.startsWith("var(") && vakt++ < 10)
    verdi = tabell[verdi.slice(4, -1)]
  return verdi
}

export function farge(
  token: string,
  utseende: "light" | "dark" = "light",
): string {
  const hex = løs(utseende === "dark" ? MØRK : LYS, token)
  if (!hex?.startsWith("#")) {
    throw new Error(`Ukjent token, eller ikke en heksfarge: ${token}`)
  }
  const { r, g, b } = parseHex(hex)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Leser `rgb(r, g, b)` eller `rgba(r, g, b, a)` fra `getComputedStyle`, så en
 * test kan regne kontrast mellom to fargene den måler.
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
