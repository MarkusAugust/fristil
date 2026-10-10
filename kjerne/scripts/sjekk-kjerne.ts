/**
 * At kjernen svarer det den skal, på alt den kan møte.
 *
 * Tre kilder til markup, fra den smaleste til den bredeste:
 *
 * 1. Fiksturene i `paritet/`. Svaret skal være nøyaktig fasiten ved siden av,
 *    felt for felt, og til sammen skal fiksturene utløse hver regel kjernen
 *    har. Fasiten for de ti første ble skrevet av TypeScript-versjonen av
 *    sjekken før den ble slettet, de andre av kjernen da de kom til. Den er
 *    en vanlig test: en endring i et svar er en endring i fasiten, og synes i
 *    diffen. En fikstur med en `.css` ved siden av sjekkes også med
 *    stilarket, som `diagnoseRendered`, og svaret står under `stylet`.
 *    `ParityTest` i `kotlin/` krever den samme fasiten fra JVM-en.
 * 2. Alt i repoet som har markup i seg: dokumentasjonen, regelbøkene,
 *    komponentene og testene deres. Det er markup skrevet av mennesker og
 *    agenter, med alt det rare det har i seg.
 * 3. Ødelagt markup: hver fikstur, klipt, skjøtet og med tegn satt inn og tatt
 *    bort, med et fast frø, så et funn kan gjenskapes.
 *
 * Temaet har sin egen fasit i `tema/`: oppskrifter til `buildTheme`, og
 * temaer skrevet som CSS til `inspectTheme`, med svaret ved siden av.
 *
 * I tillegg malene i `maler/`, én per malspråk: Thymeleaf, JTE, Go, Razor og
 * Blade. Hver har nøyaktig én skrivefeil med vilje, og skal gi nøyaktig det
 * funnet og ingen andre.
 *
 * For 2 og 3 finnes ingen fasit, men svaret må holde: kjernen kaster ikke,
 * hvert funn ligger innenfor teksten, linja og kolonnen svarer til `start`,
 * regelen er en kjernen har, og en rettelse ligger innenfor teksten. Sjekken
 * gjøres med både `diagnoseMarkup` og `diagnosePage`.
 *
 * Kjør med: bun kjerne/scripts/sjekk-kjerne.ts (etter bygg.ts)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type Finding,
  loadCore,
} from "../../designsystem/src/diagnostics/core.js"
import { MODUL } from "./bygg.js"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const kjerne = loadCore(readFileSync(MODUL))

/**
 * Reglene kjernen har, lest fra `RULES` i `kjerne/src/types.rs`. Lista sto
 * her skrevet av for hånd, og manglet de to `ustylet-*`-reglene.
 */
const REGLER = new Set(
  [
    ...(
      /pub const RULES: &\[&str\] = &\[([^\]]*)\]/.exec(
        readFileSync(join(ROT, "kjerne/src/types.rs"), "utf8"),
      )?.[1] ?? ""
    ).matchAll(/"([a-z-]+)"/g),
  ].map((m) => m[1]),
)
if (REGLER.size === 0) throw new Error("fant ikke RULES i kjerne/src/types.rs")

/** Feltene fasiten har, i fast rekkefølge, så to like funn blir like strenger. */
const kanonisk = (funn: Omit<Finding, "rule" | "line" | "column">[]) =>
  JSON.stringify(
    funn.map((f) => ({
      start: f.start,
      end: f.end,
      severity: f.severity,
      link: f.link,
      message: f.message,
      fix: f.fix && {
        title: f.fix.title,
        start: f.fix.start,
        end: f.fix.end,
        text: f.fix.text,
        preferred: f.fix.preferred ?? false,
      },
    })),
  )

let antall = 0
let funnTotalt = 0
const feil: string[] = []

/** Linja og kolonnen `start` har i teksten, fra 1. */
function plass(html: string, start: number): [number, number] {
  let linje = 1
  let linjestart = 0
  for (let i = 0; i < start; i++)
    if (html[i] === "\n") {
      linje += 1
      linjestart = i + 1
    }
  return [linje, start - linjestart + 1]
}

/** Det et svar må holde, også uten fasit. */
function holder(navn: string, html: string) {
  for (const [hva, sjekk] of [
    ["markup", kjerne.diagnoseMarkup],
    ["side", kjerne.diagnosePage],
  ] as const) {
    antall += 1
    let funn: Finding[]
    try {
      funn = sjekk(html)
    } catch (e) {
      feil.push(
        `${navn} (${hva}): kastet ${e instanceof Error ? e.message : e}`,
      )
      continue
    }
    funnTotalt += funn.length
    for (const f of funn) {
      const galt = !(0 <= f.start && f.start <= f.end && f.end <= html.length)
        ? "utenfor teksten"
        : plass(html, f.start).join(":") !== `${f.line}:${f.column}`
          ? `linje og kolonne ${f.line}:${f.column}, ventet ${plass(html, f.start).join(":")}`
          : !REGLER.has(f.rule)
            ? `ukjent regel ${f.rule}`
            : f.fix &&
                !(
                  0 <= f.fix.start &&
                  f.fix.start <= f.fix.end &&
                  f.fix.end <= html.length
                )
              ? "rettelsen er utenfor teksten"
              : undefined
      if (galt) feil.push(`${navn} (${hva}): ${galt} i ${JSON.stringify(f)}`)
    }
  }
}

// 1. Fiksturene.
const PARITET = join(ROT, "kjerne/paritet")
const fiksturer = readdirSync(PARITET)
  .filter((f) => f.endsWith(".html"))
  .map((f) => [f, readFileSync(join(PARITET, f), "utf8")] as const)
const dekket = new Set<string>()
for (const [navn, html] of fiksturer) {
  const fasit = JSON.parse(
    readFileSync(join(PARITET, navn.replace(/\.html$/, ".json")), "utf8"),
  )
  const cssFil = join(PARITET, navn.replace(/\.html$/, ".css"))
  const css = existsSync(cssFil) ? [readFileSync(cssFil, "utf8")] : undefined
  krevSammeNokler(navn, fasit, css !== undefined)
  for (const [hva, sjekk] of [
    ["markup", kjerne.diagnoseMarkup],
    ["side", kjerne.diagnosePage],
    ...(css
      ? ([
          ["stylet", (h: string) => kjerne.diagnoseStyled(h, css, true)],
        ] as const)
      : []),
  ] as const) {
    antall += 1
    const funn = sjekk(html)
    for (const f of funn) dekket.add(f.rule)
    const ventet = kanonisk(fasit[hva] ?? [])
    const svar = kanonisk(funn)
    if (svar !== ventet)
      feil.push(
        `${navn} (${hva})\n  Fasit:  ${ventet.slice(0, 600)}\n  Kjerne: ${svar.slice(0, 600)}`,
      )
  }
  holder(navn, html)
}
const udekket = [...REGLER].filter((r) => !dekket.has(r))
if (udekket.length > 0)
  feil.push(
    `ingen fikstur i paritet/ utløser ${udekket.join(", ")}. Legg til en, så regelen også testes på JVM-en.`,
  )

/** En fasit med `stylet` uten stilark, eller omvendt, sjekker ingenting. */
function krevSammeNokler(navn: string, fasit: object, harCss: boolean) {
  const nokler = Object.keys(fasit).sort().join(",")
  const ventet = harCss ? "markup,side,stylet" : "markup,side"
  if (nokler !== ventet)
    feil.push(`${navn}: fasiten har ${nokler}, ventet ${ventet}`)
}

// Temaet: oppskriftene og temaene i `tema/` mot fasiten ved siden av. Fasiten
// ble skrevet av TypeScript-utgaven av temaet før den ble slettet.
const TEMA = join(ROT, "kjerne/tema")
/** JSON med nøklene sortert: rekkefølgen i et objekt er ikke en del av svaret. */
const sortert = (verdi: unknown): string =>
  JSON.stringify(verdi, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  )
const oppskrifter: Record<
  string,
  { oppskrift: unknown; tema?: unknown; feil?: string }
> = JSON.parse(readFileSync(join(TEMA, "oppskrifter.json"), "utf8"))
for (const [navn, { oppskrift, tema, feil: ventetFeil }] of Object.entries(
  oppskrifter,
)) {
  antall += 1
  let svar: unknown
  try {
    svar = { tema: kjerne.buildTheme(oppskrift) }
  } catch (e) {
    svar = { feil: e instanceof Error ? e.message : String(e) }
  }
  const ventet = ventetFeil === undefined ? { tema } : { feil: ventetFeil }
  if (sortert(svar) !== sortert(ventet))
    feil.push(
      `tema/oppskrifter.json, ${navn}\n  Fasit:  ${sortert(ventet).slice(0, 400)}\n  Kjerne: ${sortert(svar).slice(0, 400)}`,
    )
}
const rapporter: Record<string, unknown> = JSON.parse(
  readFileSync(join(TEMA, "rapporter.json"), "utf8"),
)
for (const [navn, ventet] of Object.entries(rapporter)) {
  antall += 1
  const svar = kjerne.inspectTheme(
    readFileSync(join(TEMA, `${navn}.css`), "utf8"),
  )
  if (sortert(svar) !== sortert(ventet))
    feil.push(
      `tema/${navn}.css\n  Fasit:  ${sortert(ventet).slice(0, 400)}\n  Kjerne: ${sortert(svar).slice(0, 400)}`,
    )
}

// Temaene ødelagt, klipt og skjøtet: kjernen skal svare, ikke krasje. En
// panikk i Rust blir et krasj i WebAssembly, og da får verten bare
// «unreachable». En oppskrift kan avvises, men bare med en forklaring.
let temafrø = 20261008
const temaTilfeldig = (n: number) => {
  temafrø = (temafrø * 1103515245 + 12345) % 2 ** 31
  return temafrø % n
}
const temaKilder = readdirSync(TEMA)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(TEMA, f), "utf8"))
const TEMABITER = [
  "{",
  "}",
  ";",
  ":",
  '"',
  "'",
  "/*",
  "*/",
  "\\",
  "url(",
  ")",
  "@media x {",
  "!important",
  "\n",
  "ø",
  "#",
]
const ØDELAGTE_TEMAER = 2000
for (let n = 0; n < ØDELAGTE_TEMAER; n++) {
  let css = temaKilder[temaTilfeldig(temaKilder.length)]
  for (let steg = 0, ganger = 1 + temaTilfeldig(6); steg < ganger; steg++) {
    const ved = temaTilfeldig(css.length + 1)
    const valg = temaTilfeldig(3)
    if (valg === 0)
      css =
        css.slice(0, ved) +
        TEMABITER[temaTilfeldig(TEMABITER.length)] +
        css.slice(ved)
    else if (valg === 1)
      css = css.slice(0, ved) + css.slice(ved + 1 + temaTilfeldig(30))
    else css = css.slice(0, ved)
  }
  antall += 1
  try {
    kjerne.inspectTheme(css)
  } catch (e) {
    feil.push(
      `inspectTheme krasjet på ${JSON.stringify(css).slice(0, 300)}: ${e}`,
    )
  }
  // Den samme ødelagte CSS-en gjennom leseren for selektorer, og som
  // stilark til sjekken.
  try {
    kjerne.inspectStyles(css)
    kjerne.diagnoseStyled(
      '<div class="fs-card fs-button" data-variant="ghost"></div>',
      [css],
      true,
    )
  } catch (e) {
    feil.push(
      `inspectStyles krasjet på ${JSON.stringify(css).slice(0, 300)}: ${e}`,
    )
  }
}
for (const [navn, { oppskrift }] of Object.entries(oppskrifter)) {
  for (const ødelagt of [
    { ...(oppskrift as object), accent: 42 },
    { typography: { fontFamily: ["Arial"] } },
    { shape: { buttonRadius: null } },
    "ikke et objekt",
    [],
  ]) {
    antall += 1
    try {
      kjerne.buildTheme(ødelagt)
    } catch (e) {
      if (!(e instanceof Error) || /unreachable|RuntimeError/.test(String(e)))
        feil.push(
          `buildTheme krasjet på ${navn}, ${JSON.stringify(ødelagt)}: ${e}`,
        )
    }
  }
}

// Malspråkene: hver fil i `maler/` har markup med malsyntaks, og nøyaktig én
// skrivefeil med vilje. Malsyntaksen skal ikke gi funn, og skrivefeilen skal.
const MALER = join(ROT, "kjerne/maler")
const SKRIVEFEILEN: Record<string, string> = {
  "thymeleaf.html": "ukjent-klasse",
  "jte.kte": "ugyldig-klasseverdi",
  "go.tmpl": "ukjent-klasse",
  "razor.cshtml": "ugyldig-klasseverdi",
  "blade.blade.php": "ukjent-element",
}
for (const navn of readdirSync(MALER)) {
  antall += 1
  const funn = kjerne.diagnoseMarkup(readFileSync(join(MALER, navn), "utf8"))
  const regler = funn.map((f) => f.rule).join(", ") || "ingen"
  if (!(navn in SKRIVEFEILEN))
    feil.push(`maler/${navn}: står ikke i SKRIVEFEILEN i sjekk-kjerne.ts`)
  else if (regler !== SKRIVEFEILEN[navn])
    feil.push(
      `maler/${navn}: ventet ett funn, ${SKRIVEFEILEN[navn]}, fikk ${regler}: ${funn.map((f) => f.message).join(" | ")}`,
    )
}

// 2. Markupen i repoet.
const UTVIDELSER = /\.(html|astro|mdx?|ts)$/
const HOPP = new Set([
  "node_modules",
  "dist",
  ".astro",
  "target",
  "build",
  ".gradle",
])
function* filer(mappe: string): Generator<string> {
  for (const navn of readdirSync(mappe)) {
    if (HOPP.has(navn) || navn.startsWith(".")) continue
    const sti = join(mappe, navn)
    if (statSync(sti).isDirectory()) yield* filer(sti)
    else if (UTVIDELSER.test(navn)) yield sti
  }
}
let repofiler = 0
for (const mappe of [
  "documentation/src",
  "designsystem/src",
  "designsystem/agent",
  "editor/src",
]) {
  for (const sti of filer(join(ROT, mappe))) {
    const tekst = readFileSync(sti, "utf8")
    if (!tekst.includes("<")) continue
    repofiler += 1
    holder(relative(ROT, sti), tekst)
  }
}

// 3. Ødelagt markup, med et fast frø.
let frø = 20261007
const tilfeldig = (n: number) => {
  frø = (frø * 1103515245 + 12345) % 2 ** 31
  return frø % n
}
const BITER = [
  "<",
  ">",
  '"',
  "'",
  "=",
  "/",
  " ",
  "\n",
  "fs-",
  "<fs-field>",
  "</fs-field>",
  "<label>",
  "{{",
  "}}",
  "<!--",
  "-->",
  "<script>",
  "&amp;",
  "&#x41;",
  "%C3%B8",
  "#",
  "ø",
  "🧾",
  'class="fs-',
  'aria-describedby="',
  'id="x"',
]
const ØDELAGTE = 4000
for (let n = 0; n < ØDELAGTE; n++) {
  const [navn, original] = fiksturer[tilfeldig(fiksturer.length)]
  let html = original
  for (let steg = 0, ganger = 1 + tilfeldig(6); steg < ganger; steg++) {
    const ved = tilfeldig(html.length + 1)
    const valg = tilfeldig(4)
    if (valg === 0)
      html =
        html.slice(0, ved) + BITER[tilfeldig(BITER.length)] + html.slice(ved)
    else if (valg === 1)
      html = html.slice(0, ved) + html.slice(ved + 1 + tilfeldig(8))
    else if (valg === 2) html = html.slice(0, ved)
    else
      html =
        html.slice(ved) +
        fiksturer[tilfeldig(fiksturer.length)][1].slice(0, tilfeldig(200))
  }
  holder(
    `ødelagt #${n} fra ${navn}: ${JSON.stringify(html).slice(0, 300)}`,
    html,
  )
}

console.log(
  `${antall} sjekker: ${fiksturer.length} fiksturer mot fasiten med ${dekket.size} av ${REGLER.size} regler, ${readdirSync(MALER).length} maler, ${Object.keys(oppskrifter).length + Object.keys(rapporter).length} temaer og ${ØDELAGTE_TEMAER} ødelagte, ${repofiler} filer fra repoet og ${ØDELAGTE} ødelagte, med ${funnTotalt} funn til sammen.`,
)
if (feil.length > 0) {
  console.error(`\n${feil.length} feil:\n`)
  for (const f of feil.slice(0, 15)) console.error(`${f}\n`)
  process.exit(1)
}
console.log("Kjernen svarer det den skal på alt.")
