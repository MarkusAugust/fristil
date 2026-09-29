import { oklchToRgb, parseHex, rgbToOklch, toHex } from "./color.js"
import {
  type Appearance,
  buildFamily,
  checkPromises,
  NEUTRAL_LAYERS,
  ROLES,
  type Role,
  type Violation,
} from "./contract.js"

/**
 * Matrisen: familie ganger rolle, som ferdige tokens.
 *
 * En familie er hva fargen betyr, en rolle er hva den gjør. Hver familie har
 * de samme rollene, og det er strukturen som gjør at de matcher. Ingen
 * palett, ingen trinn, ingen pinner: rollen *er* fargen.
 *
 * Navnene følger navnerommene til Tailwind, daisyUI og Digdir, altså
 * systemprefiks, slag og sti: `--fs-color-danger-fill`. Slaget er ikke pynt.
 * Det skiller farge fra `--fs-radius-*` og fra komponentvariabler som
 * `--fs-button-padding`, og det lar Tailwind-temaet bli generert framfor
 * skrevet av for hånd.
 */

/** Familiene Fristil leverer selv. En konsument kan ha andre. */
export const FAMILIES = [
  "accent",
  "brand1",
  "brand2",
  "brand3",
  "neutral",
  "danger",
  "warning",
  "success",
] as const

export type Family = (typeof FAMILIES)[number]

/** Rollenavnet slik det skrives i CSS. `textSubtle` blir `text-subtle`. */
export function roleToCss(role: Role): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Tokennavnet for én celle i matrisen. */
export function tokenName(family: string, role: string): string {
  return `--fs-color-${family}-${role}`
}

export type Matrix = {
  /** Tokennavn til heksverdi, for ett utseende. */
  tokens: Record<string, string>
  /** Løfter som ikke holder. Tom når matrisen er i orden. */
  violations: Violation[]
}

/**
 * Bygger hele matrisen for ett utseende.
 *
 * `neutral` får to lag i tillegg til rollene sine: `canvas` er siden selv, og
 * `raised` er en flate som ligger over et kort. De hører bare til den
 * nøytrale familien, siden en rød side ikke er en tilstand systemet har.
 */
export function buildMatrix(
  brands: Record<string, string>,
  appearance: Appearance,
): Matrix {
  if (!brands.neutral) {
    throw new Error(
      "Matrisen trenger en nøytral familie. Den bærer siden, teksten og " +
        "kantene, og de andre familiene måles mot den.",
    )
  }

  const families: Record<string, Record<Role, string>> = {}
  for (const [name, brand] of Object.entries(brands))
    families[name] = buildFamily(brand, appearance)

  // Lagene regnes av den nøytrale kuløren, med enda mindre metning enn
  // flatene: en side med kulør i seg ser malt ut, ikke nøytral. Både lysheten
  // og metningen står i `NEUTRAL_LAYERS`, som resten av kontrakten.
  const { c, h } = rgbToOklch(parseHex(brands.neutral))
  const layer = (name: "canvas" | "raised") =>
    toHex(
      oklchToRgb({
        l: NEUTRAL_LAYERS[name].lightness[appearance],
        c: c * NEUTRAL_LAYERS[name].chroma,
        h,
      }),
    )
  const layers = {
    canvas: layer("canvas"),
    surface: families.neutral.surface,
    raised: layer("raised"),
  }

  const tokens: Record<string, string> = {}
  for (const [name, family] of Object.entries(families))
    for (const role of Object.keys(ROLES) as Role[])
      tokens[tokenName(name, roleToCss(role))] = family[role]

  tokens[tokenName("neutral", "canvas")] = layers.canvas
  tokens[tokenName("neutral", "raised")] = layers.raised

  return { tokens, violations: checkPromises(families, layers) }
}

/**
 * Fristils egne merkefarger.
 *
 * Kulørene er de systemet alt har for det interaktive og for status. De tre
 * merkefargene er nye, og er valgt til å stå sammen med dem: en grønn, en
 * lilla og en rødbrun med tydelig avstand i kulør, slik at en kategori eller
 * en seksjon kan skilles fra en annen uten at fargen betyr noe i seg selv.
 */
export const FRISTIL_BRANDS: Record<Family, string> = {
  accent: "#1362ae",
  brand1: "#0d7a5f",
  brand2: "#5b3fa0",
  brand3: "#b04c5c",
  neutral: "#24272b",
  danger: "#a82e39",
  warning: "#896508",
  success: "#316f2a",
}
