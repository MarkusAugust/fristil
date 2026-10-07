/**
 * Skriver `src/tokens/matrise.ts`: Fristils egne farger, regnet av kjernen.
 *
 * Fargene er kontrakten (`fargekontrakt.json`) anvendt på Fristils egne
 * merkefarger, og regningen finnes bare i Rust. Resultatet skrives som data,
 * så `@fristil/designsystem/tokens` og `tokens.css` har fargene uten å laste
 * WebAssembly, også i nettleseren.
 *
 * Typene skrives med: `Family` og `MatrixToken` er navnene matrisen sender ut,
 * så en ny familie eller rolle i kontrakten blir med av seg selv.
 *
 * Kjør med: bun scripts/generate-matrise.ts, eller som en del av `generate`.
 * Krever kjernen, bygget med `bun run kjerne`.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { loadCore } from "../src/diagnostics/core.js"

const kontrakt: {
  families: string[]
  brands: Record<string, string>
  roles: Record<string, unknown>
  layers: Record<string, unknown>
  requirements: Record<string, number>
} = JSON.parse(
  readFileSync(
    new URL("../src/tokens/fargekontrakt.json", import.meta.url),
    "utf8",
  ),
)
const kjerne = loadCore(
  readFileSync(new URL("../kjerne/fristil-kjerne.wasm", import.meta.url)),
)
const { light, dark, violations } = kjerne.buildTheme(kontrakt.brands)

if (violations.length > 0) {
  console.error("Fristils egne farger holder ikke løftene i fargekontrakten:")
  for (const v of violations)
    console.error(
      `  ${v.family}: ${v.promise} er ${v.ratio.toFixed(2)}:1, kravet er ${v.required}:1`,
    )
  process.exit(1)
}

const navn = Object.keys(light)
const fil = `// Generert av scripts/generate-matrise.ts fra kjernen og fargekontrakt.json. Ikke rediger.

/** Familiene Fristil leverer selv. En konsument kan ha andre. */
export const FAMILIES = ${JSON.stringify(kontrakt.families)} as const

export type Family = (typeof FAMILIES)[number]

/** Fristils egne merkefarger. */
export const FRISTIL_BRANDS: Record<Family, string> = ${JSON.stringify(kontrakt.brands, null, 2)}

/** En rolle er en jobb en farge gjør, og den er lik i hver familie. */
export type Role = ${Object.keys(kontrakt.roles)
  .map((r) => JSON.stringify(r))
  .join(" | ")}

/** Lyst eller mørkt. Et tema er det ene eller det andre, aldri begge. */
export type Appearance = "light" | "dark"

type Spec = { lightness: Record<Appearance, number>; chroma: number }

/** Lyshet og metningsandel per rolle, i hvert utseende. */
export const ROLES: Record<Role, Spec> = ${JSON.stringify(kontrakt.roles, null, 2)}

/** Siden og den hevede flaten, som bare den nøytrale familien har. */
export const NEUTRAL_LAYERS: Record<"canvas" | "raised", Spec> = ${JSON.stringify(kontrakt.layers, null, 2)}

/** Kontrastkravene, med margin over WCAG. Tekst er 4,5 og grafikk er 3. */
export const REQUIREMENT = ${JSON.stringify(kontrakt.requirements)} as const

/** Hvert navn matrisen sender ut. */
export type MatrixToken =
${navn.map((n) => `  | ${JSON.stringify(n)}`).join("\n")}

/** Fristils egne farger i lyst tema. */
export const lightCells: Record<MatrixToken, string> = ${JSON.stringify(light, null, 2)}

/** Fristils egne farger i mørkt tema. */
export const darkCells: Record<MatrixToken, string> = ${JSON.stringify(dark, null, 2)}
`
writeFileSync(new URL("../src/tokens/matrise.ts", import.meta.url), fil)
console.log(
  `✓ Matrisen: ${navn.length} farger i hvert tema, regnet av kjernen.`,
)
