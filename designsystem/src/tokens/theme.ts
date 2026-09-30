import type { Appearance, Violation } from "./contract.js"
import { buildMatrix, FAMILIES, type Family, FRISTIL_BRANDS } from "./matrix.js"

/**
 * Bygger et helt fargetema av noen få merkefarger.
 *
 * Temaet er kontrakten anvendt på konsumentens kulører. Kuløren er deres,
 * lysheten er rollens, og løftene holder av konstruksjon. Derfor finnes det
 * ikke noe justeringspass her: det er ingenting å flytte på.
 *
 * ```ts
 * const tema = buildTheme({ accent: "#7c3aed", danger: "#b3261e" })
 * console.log(tema.css)
 * ```
 */

export type ThemeTypography = {
  /** Skriftstakken hele temaet skal bruke, skrevet som i CSS. */
  fontFamily?: string
  /** Vektene, som tall eller nøkkelord. */
  weights?: {
    regular?: string | number
    medium?: string | number
    semibold?: string | number
    bold?: string | number
  }
  /** Linjeavstand for kontroller, overskrifter, brødtekst og små flater. */
  lineHeights?: {
    default?: string | number
    heading?: string | number
    article?: string | number
    compact?: string | number
  }
}

/**
 * Formen i temaet: hjørner og rammer.
 *
 * Knappen står for seg, feltet for seg, og flatene for seg. Skillet er verdt
 * å holde: et annet norsk designsystem har helt runde knapper, mens feltene
 * har nesten rette hjørner, og ett felles tall ville gjort feltene til
 * kapsler.
 *
 * Avkryssingsboksen, merket, etiketten, valggruppa, avataren og skjelettet
 * står med vilje utenfor. Der er hjørnet ikke et stilvalg, men
 * selve formen: en avkryssingsboks som blir rund, ser ut som en radioknapp,
 * og et merke som blir firkantet, ser ut som en knapp.
 */
export type ThemeShape = {
  /** Hjørner på knappen, paginering og hopplenken. */
  buttonRadius?: string
  /** Hjørner på feltet, tekstområdet og nedtrekkslista. */
  fieldRadius?: string
  /**
   * Hjørner på kort, dialog, sprettoppvindu, varsel, trekkspill,
   * feiloppsummering, filopplasting, økttidsvarsel, forslagslista,
   * meldingen og hjelpeboblen.
   */
  surfaceRadius?: string
  /** Rammetykkelsen på knappen. */
  buttonBorderWidth?: string
  /** Vekten på knappeteksten. */
  buttonFontWeight?: string | number
}

/**
 * Merkefargene.
 *
 * Hver familie er valgfri for seg, og en du utelater arver Fristils egen
 * kulør. Utelater du alle, blir temaet et som bare setter skrift og form.
 */
export type ThemeColors = Partial<Record<Family, string>>

export type ThemeInput = ThemeColors & {
  /** Skrift og linjeavstand. Utelates den, står Fristils egen typografi. */
  typography?: ThemeTypography
  /** Hjørner og rammer. Utelates den, står Fristils egen form. */
  shape?: ThemeShape
}

export type Theme = {
  light: Record<string, string>
  dark: Record<string, string>
  /** Løfter som ikke holder. Tom når temaet er i orden. */
  violations: Violation[]
  css: string
}

const KNAPPER = ["button", "pagination", "skip-link"] as const

const FELT = ["input", "select", "textarea"] as const

const FLATER = [
  "card",
  "dialog",
  "popover",
  "alert",
  "accordion",
  "error-summary",
  "file-upload",
  "session-timeout",
  "suggestion",
  "toast",
  "tooltip",
] as const

/** Tegn som lar en verdi bryte ut av erklæringen sin. */
const FARLIGE = /[;{}<>\\]|\/\*|\*\//

/**
 * Om parenteser og anførselstegn går opp.
 *
 * En ubalansert `(` er nok alene: `1px (` åpner en blokk som sluker
 * semikolonet, begge krøllparentesene og alt som står etter i fila. Testet i
 * Chromium, der både temaet og konsumentens eget stilark forsvant.
 */
function balansert(verdi: string): boolean {
  let nivå = 0
  let sitat: string | null = null

  for (const tegn of verdi) {
    if (sitat) {
      if (tegn === sitat) sitat = null
      continue
    }
    if (tegn === '"' || tegn === "'") sitat = tegn
    else if (tegn === "(") nivå += 1
    else if (tegn === ")" && --nivå < 0) return false
  }

  return nivå === 0 && sitat === null
}

/**
 * Avviser en verdi som kan bryte ut av regelen den skrives inn i.
 *
 * Oppskriften er en JSON-fil, og den kan komme fra et annet repo eller fra et
 * byggesteg. Tre veier ut er etterprøvd i nettleser, og alle tre var åpne da
 * sjekken bare så etter `;`, `{`, `}` og `/*`:
 *
 * - `4px; } html { display: none } :root { --x: 1` lukket erklæringen og
 *   `:root`-blokka, og fikk en vilkårlig regel inn i `@layer fristil`.
 * - `1px (` åpnet en parentes som slukte resten av fila, inkludert stilarket
 *   konsumenten la etter den.
 * - `Arial\` lot baksnabelen spise semikolonet, så neste erklæring ble en
 *   del av skriftnavnet.
 * - `Arial</style><script>…` kjørte skriptet i en side der den genererte
 *   CSS-en står inline i et `<style>`-element.
 *
 * Derfor både en liste over farlige tegn og et krav om at parenteser og
 * anførselstegn går opp. `calc(1rem + 2px)` og `"Segoe UI", Arial` er
 * fortsatt lovlige verdier.
 */
function kontroller(navn: string, verdi: string): string {
  /*
   * Styretegn ses etter med kodepunktet framfor med et regulært uttrykk.
   * Biome avviser et uttrykk med styretegn i, og med god grunn: de er
   * vanskelige å se i kilden. Her er de nettopp det vi leter etter.
   */
  const harStyretegn = [...verdi].some(
    (tegn) => (tegn.codePointAt(0) ?? 0) < 0x20,
  )

  if (FARLIGE.test(verdi) || harStyretegn) {
    throw new Error(
      `Verdien til ${oppskriftsnavn(navn)} kan ikke inneholde «;», «{», «}», «<», «>», ` +
        `«\\», «/*» eller styretegn. Den skrives rett inn i en CSS-regel. ` +
        `Fikk: ${verdi}`,
    )
  }

  if (!balansert(verdi)) {
    throw new Error(
      `Verdien til ${oppskriftsnavn(navn)} har en parentes eller et anførselstegn som ikke ` +
        `går opp. En parentes som ikke lukkes sluker resten av stilarket. ` +
        `Fikk: ${verdi}`,
    )
  }

  return verdi
}

/**
 * Skriver en variabel bare når den er oppgitt.
 *
 * `0` er oppgitt. Sannhetssjekken sto her først, og ga to motsatte utfall for
 * den samme nullen: `buttonRadius: 0` ble ignorert, mens `buttonFontWeight: 0`
 * slapp gjennom.
 */
function kanskje(
  verdier: Record<string, string>,
  navn: string,
  verdi: string | number | undefined,
): void {
  if (verdi === undefined || verdi === "") return
  verdier[navn] = kontroller(navn, String(verdi))
}

function typografiVerdier(t: ThemeTypography): Record<string, string> {
  const verdier: Record<string, string> = {}
  kanskje(verdier, "--font-family-base", t.fontFamily)
  kanskje(verdier, "--font-weight-regular", t.weights?.regular)
  kanskje(verdier, "--font-weight-medium", t.weights?.medium)
  kanskje(verdier, "--font-weight-semibold", t.weights?.semibold)
  kanskje(verdier, "--font-weight-bold", t.weights?.bold)
  kanskje(verdier, "--fs-line-height-default", t.lineHeights?.default)
  kanskje(verdier, "--fs-line-height-heading", t.lineHeights?.heading)
  kanskje(verdier, "--fs-line-height-article", t.lineHeights?.article)
  kanskje(verdier, "--fs-line-height-compact", t.lineHeights?.compact)
  return verdier
}

/**
 * Navnet brukeren skrev, til feilmeldingen.
 *
 * Verdien lander i `--fs-button-radius`, men det var `buttonRadius` eller
 * `--knapp-hjorner` som ble skrevet. En feilmelding som navngir vår egen
 * variabel sender leseren til feil sted i sin egen fil.
 */
const OPPSKRIFTSNAVN: Record<string, string> = {
  "--font-family-base": "fontFamily",
  "--font-weight-regular": "weights.regular",
  "--font-weight-medium": "weights.medium",
  "--font-weight-semibold": "weights.semibold",
  "--font-weight-bold": "weights.bold",
  "--fs-line-height-default": "lineHeights.default",
  "--fs-line-height-heading": "lineHeights.heading",
  "--fs-line-height-article": "lineHeights.article",
  "--fs-line-height-compact": "lineHeights.compact",
  "--fs-button-border-width": "buttonBorderWidth",
  "--fs-button-font-weight": "buttonFontWeight",
}

function oppskriftsnavn(variabel: string): string {
  if (OPPSKRIFTSNAVN[variabel]) return OPPSKRIFTSNAVN[variabel]
  if (variabel.endsWith("-radius")) {
    const navn = variabel.slice("--fs-".length, -"-radius".length)
    if ((KNAPPER as readonly string[]).includes(navn)) return "buttonRadius"
    if ((FELT as readonly string[]).includes(navn)) return "fieldRadius"
    return "surfaceRadius"
  }
  return variabel
}

function formVerdier(f: ThemeShape): Record<string, string> {
  const verdier: Record<string, string> = {}
  for (const [verdi, navnene] of [
    [f.buttonRadius, KNAPPER],
    [f.fieldRadius, FELT],
    [f.surfaceRadius, FLATER],
  ] as const) {
    for (const navn of navnene) kanskje(verdier, `--fs-${navn}-radius`, verdi)
  }
  kanskje(verdier, "--fs-button-border-width", f.buttonBorderWidth)
  kanskje(verdier, "--fs-button-font-weight", f.buttonFontWeight)
  return verdier
}

function lines(verdier: Record<string, string>, innrykk: string): string {
  return Object.entries(verdier)
    .map(([navn, verdi]) => `${innrykk}${navn}: ${verdi};`)
    .join("\n")
}

/**
 * Setter temaet sammen.
 *
 * Fila legger seg i sitt eget lag, `fristil-tema`, erklært etter `fristil`.
 * Erklæringen avgjør rekkefølgen uavhengig av når stilarkene lastes, og det er
 * ikke en detalj: både Astro og TanStack Start legger bundlet CSS inn rett før
 * `</head>`, altså etter en `<link>` appen selv har skrevet.
 */
function tilCss(
  light: Record<string, string>,
  dark: Record<string, string>,
  typografi?: ThemeTypography,
  form?: ThemeShape,
): string {
  const typografiske = typografi ? typografiVerdier(typografi) : {}
  const formen = form ? formVerdier(form) : {}
  const rot = { ...light, ...typografiske, ...formen }

  const deler: string[] = []
  if (Object.keys(rot).length > 0)
    deler.push(`  :root {\n${lines(rot, "    ")}\n  }`)

  /*
   * Skriften settes som en ekte regel, ikke bare som et token.
   *
   * Fristil arver skrift med vilje, så et token alene ville ikke endret én
   * eneste bokstav.
   */
  if (typografi?.fontFamily)
    deler.push("  :root {\n    font-family: var(--font-family-base);\n  }")

  /*
   * Begge attributtene skrives, ikke bare det mørke.
   *
   * `data-theme` er en temagrense og virker på et hvilket som helst element.
   * En deklarasjon på elementet selv vinner over en verdi det arver, uansett
   * hvilket lag arven kom fra, så uten den lyse blokken sto Fristils egen
   * farge inne i en lys grense mens temaets farge gjaldt ellers på siden.
   * Det rammet nettopp mønsteret en innebygd komponent skal bruke.
   *
   * Bare fargene er med. Typografi og form er ikke temaavhengige, så de hører
   * i `:root` alene og ville bare vært en kopi her.
   */
  if (Object.keys(dark).length > 0)
    deler.push(
      `  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme="light"]) {\n${lines(dark, "      ")}\n    }\n  }`,
      `  [data-theme="light"] {\n${lines(light, "    ")}\n  }`,
      `  [data-theme="dark"] {\n${lines(dark, "    ")}\n  }`,
    )

  return [
    "/* Generert av @fristil/designsystem. Rediger oppskriften, ikke denne fila. */",
    "",
    "@layer fristil, fristil-tema;",
    "",
    "@layer fristil-tema {",
    deler.join("\n\n"),
    "}",
    "",
  ].join("\n")
}

/** Bygger temaet, og kontrollerer hvert løfte mens det bygges. */
export function buildTheme(input: ThemeInput): Theme {
  const oppgitte = FAMILIES.filter((navn) => input[navn])

  if (oppgitte.length === 0 && !input.typography && !input.shape) {
    throw new Error(
      "Temaet er tomt. Oppgi enten merkefarger, eller skrift og form.",
    )
  }

  /*
   * Et tema uten farger er ikke en kuriositet.
   *
   * Bruker organisasjonen Fristils farger fra før, er det nettopp skriften og
   * hjørnene som skiller, og da skal fargeblokkene ikke skrives i det hele
   * tatt.
   */
  if (oppgitte.length === 0)
    return {
      light: {},
      dark: {},
      violations: [],
      css: tilCss({}, {}, input.typography, input.shape),
    }

  const merker = { ...FRISTIL_BRANDS } as Record<string, string>
  for (const navn of oppgitte) merker[navn] = input[navn] as string

  const bygg = (utseende: Appearance) => buildMatrix(merker, utseende)
  const lys = bygg("light")
  const mørk = bygg("dark")

  return {
    light: lys.tokens,
    dark: mørk.tokens,
    violations: [...lys.violations, ...mørk.violations],
    css: tilCss(lys.tokens, mørk.tokens, input.typography, input.shape),
  }
}
