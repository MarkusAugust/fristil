/**
 * At temaet fra kjernen er nøyaktig det TypeScript-utgaven gir.
 *
 * Midlertidig, som paritetstesten for sjekken var: den kjøres mens begge
 * utgavene finnes, og slettes med TypeScript-utgaven. Etterpå er
 * fasiten i `kjerne/tema/` det som holder svarene fast.
 *
 * To deler, med et fast frø så et avvik kan gjenskapes:
 *
 * 1. `buildTheme` på tilfeldige oppskrifter: merkefarger fra hele
 *    fargesirkelen, `#rgb` og `#rrggbb`, ugyldige farger, og typografi og
 *    form med lovlige og farlige verdier. Svaret skal være likt felt for
 *    felt, og feilmeldingen lik når begge kaster.
 * 2. `inspectTheme` på temaer: de genererte, `tokens.css`, CSS-blokkene i
 *    dokumentasjonen, og hver av dem klipt, skjøtet og endret.
 *
 * Kjør med: bun kjerne/scripts/sjekk-tema-paritet.ts (etter bygg.ts)
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadCore } from "../../designsystem/src/diagnostics/core.js"
import { buildTheme } from "../../designsystem/src/tokens/theme.js"
import { inspectTheme } from "../../designsystem/src/tokens/theme-check.js"
import { MODUL } from "./bygg.js"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const kjerne = loadCore(readFileSync(MODUL))

let frø = 20261007
const tilfeldig = (n: number) => {
  frø = (frø * 1103515245 + 12345) % 2 ** 31
  return frø % n
}
const velg = <T>(liste: readonly T[]): T => liste[tilfeldig(liste.length)]

const avvik: string[] = []
let sammenligninger = 0

/** JSON med nøklene sortert: rekkefølgen i et objekt er ikke en del av svaret. */
const kanonisk = (verdi: unknown): string =>
  JSON.stringify(verdi, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  )

const svar = (f: () => unknown) => {
  try {
    return { ok: f() }
  } catch (e) {
    return { feil: e instanceof Error ? e.message : String(e) }
  }
}

// 1. buildTheme.
const FAMILIER = [
  "accent",
  "visited",
  "brand1",
  "brand2",
  "brand3",
  "neutral",
  "danger",
  "warning",
  "success",
] as const
const heks = () => {
  const tegn = "0123456789abcdefABCDEF"
  const lengde = velg([3, 6, 6, 6, 6])
  return `#${Array.from({ length: lengde }, () => velg([...tegn])).join("")}`
}
const VERDIER = [
  "Inter",
  '"Segoe UI", Arial, sans-serif',
  "calc(1rem + 2px)",
  "0",
  0,
  600,
  1.5,
  "",
  "4px; } html { display: none }",
  "1px (",
  "Arial\\",
  "Arial</style><script>",
  "a /* b */",
  "tab\there",
  "'ulukket",
  "999px",
  "0.25rem",
]
const UGYLDIGE = ["#12", "#ggg", "rød", "#1234567", " #abc ", "#abcd"]

const TEMAER: string[] = []
const ØNSKER = 3000
for (let n = 0; n < ØNSKER; n++) {
  const oppskrift: Record<string, unknown> = {}
  for (const familie of FAMILIER)
    if (tilfeldig(3) === 0)
      oppskrift[familie] = tilfeldig(20) === 0 ? velg(UGYLDIGE) : heks()
  if (tilfeldig(3) === 0)
    oppskrift.typography = {
      fontFamily: velg(VERDIER),
      weights: { regular: velg(VERDIER), bold: velg(VERDIER) },
      lineHeights: { default: velg(VERDIER), heading: velg(VERDIER) },
    }
  if (tilfeldig(3) === 0)
    oppskrift.shape = {
      buttonRadius: velg(VERDIER),
      fieldRadius: velg(VERDIER),
      surfaceRadius: velg(VERDIER),
      buttonBorderWidth: velg(VERDIER),
      buttonFontWeight: velg(VERDIER),
    }
  sammenligninger += 1
  const ts = svar(() =>
    buildTheme(oppskrift as Parameters<typeof buildTheme>[0]),
  )
  const rust = svar(() => kjerne.buildTheme(oppskrift))
  if (kanonisk(ts) !== kanonisk(rust))
    avvik.push(
      `buildTheme(${JSON.stringify(oppskrift)})\n  TS:   ${JSON.stringify(ts).slice(0, 400)}\n  Rust: ${JSON.stringify(rust).slice(0, 400)}`,
    )
  if ("ok" in ts) TEMAER.push((ts.ok as { css: string }).css)
}

// 2. inspectTheme.
const KILDER: string[] = [
  ...TEMAER.slice(0, 200),
  readFileSync(join(ROT, "designsystem/src/tokens/tokens.css"), "utf8"),
]
for (const navn of readdirSync(join(ROT, "documentation/src/content/docs"))) {
  if (!navn.endsWith(".mdx")) continue
  const tekst = readFileSync(
    join(ROT, "documentation/src/content/docs", navn),
    "utf8",
  )
  for (const [, css] of tekst.matchAll(/```css\n([\s\S]*?)```/g))
    KILDER.push(css)
}
const BITER = [
  "{",
  "}",
  ";",
  "/*",
  "*/",
  "--fs-color-accent-text: #ffffff;",
  "--fs-color-neutral-canvas: #000;",
  "--fs-color-min-merkevare-text: #123456;",
  "--fs-color-accent-fill: red;",
  "--fs-color-accent-text: #111 !important;",
  "color-scheme: dark;",
  "color-scheme: only light;",
  "color-scheme: light dark;",
  '[data-theme="dark"] {',
  ".darkmode-toggle {",
  "@media (prefers-color-scheme: dark) {",
  "--fs-color-tull: #abc;",
  "ø",
  "\n",
]
const ENDRINGER = 3000
const alle = [...KILDER]
for (let n = 0; n < ENDRINGER; n++) {
  let css = velg(KILDER)
  for (let steg = 0, ganger = 1 + tilfeldig(5); steg < ganger; steg++) {
    const ved = tilfeldig(css.length + 1)
    const valg = tilfeldig(4)
    if (valg === 0) css = css.slice(0, ved) + velg(BITER) + css.slice(ved)
    else if (valg === 1)
      css = css.slice(0, ved) + css.slice(ved + 1 + tilfeldig(40))
    else if (valg === 2) css = css.slice(0, ved)
    else css = css.replace(/#[0-9a-f]{6}/i, heks())
  }
  alle.push(css)
}
for (const css of alle) {
  sammenligninger += 1
  const ts = svar(() => inspectTheme(css))
  const rust = svar(() => kjerne.inspectTheme(css))
  if (kanonisk(ts) !== kanonisk(rust))
    avvik.push(
      `inspectTheme(${JSON.stringify(css).slice(0, 300)})\n  TS:   ${JSON.stringify(ts).slice(0, 600)}\n  Rust: ${JSON.stringify(rust).slice(0, 600)}`,
    )
}

console.log(
  `${sammenligninger} sammenligninger: ${ØNSKER} oppskrifter, ${KILDER.length} temaer og ${ENDRINGER} endrede.`,
)
if (avvik.length > 0) {
  console.error(`\n${avvik.length} avvik mellom Rust og TypeScript:\n`)
  for (const a of avvik.slice(0, 10)) console.error(`${a}\n`)
  process.exit(1)
}
console.log("Rust og TypeScript gir det samme temaet og de samme funnene.")
