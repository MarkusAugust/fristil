import {
  adjustForContrast,
  buildNeutralScale,
  buildScale,
  contrastRatio,
  parseHex,
} from "./color.js"

/**
 * Bygger et helt fargetema fra noen få merkefarger.
 *
 * Fristil har én innebygd palett. En organisasjon med egne farger måtte
 * ellers overstyre tokenene for hånd, og selv passe på at hvert par holder
 * kontrastkravet, i begge temaer. Det er mange par, og det er lett å gå glipp
 * av ett.
 *
 * Her oppgir du merkefargene, og generatoren bygger skalaene, setter de
 * semantiske verdiene, og flytter lysheten på dem som ikke holder kravet.
 * Hver justering rapporteres, så du ser hva som ble endret og hvorfor.
 *
 * ```ts
 * const tema = buildTheme({ interactive: "#7c3aed", danger: "#b3261e" })
 * console.log(tema.css)
 * ```
 */

/**
 * Typografien i temaet.
 *
 * Fargene er det som er vanskelig å få riktig, og det er derfor generatoren
 * begynte der. Men to designsystemer med samme palett ser fortsatt ulike ut
 * hvis skriften og linjeavstanden er ulik, og det er nettopp det som skiller
 * et tema fra det neste. Alt her er valgfritt: utelates det, står Fristils
 * egne verdier.
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
 * å holde: Skatteetatens knapper er helt runde, mens feltene deres har nesten
 * rette hjørner, og ett felles tall ville gjort feltene til kapsler.
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
   * feiloppsummering, filopplasting, økttidsavbrudd, forslagslista,
   * meldingen og hjelpeboblen.
   */
  surfaceRadius?: string
  /** Rammetykkelsen på knappen. */
  buttonBorderWidth?: string
  /** Vekten på knappeteksten. */
  buttonFontWeight?: string | number
}

/**
 * Oppskriften på et tema.
 *
 * Fargene hører sammen: enten oppgir du alle fire, eller ingen. Utelates de,
 * lages det et tema som bare setter skrift og form, og fargene blir stående
 * som de er i `tokens.css`.
 *
 * Det siste er ikke en kuriositet. Fristils egen palett er Skatteetatens, med
 * de samme verdiene, og da ville det å kjøre fargene gjennom generatoren
 * gjort spillet mindre likt deres og ikke mer: `#1362ae` kommer ut som
 * `#1e6ab7`, fordi skalaene regnes om i OKLCH fra merkefargen. Et tema som
 * bare setter skrift og form er da det riktige svaret.
 */
type ThemeCommon = {
  /** Flater, tekst og skillelinjer. Nesten uten kulør. */
  neutral?: string
  /** Besøkte lenker. Utledes fra `interactive` hvis den utelates. */
  visited?: string
  /** Skrift og linjeavstand. Utelates den, står Fristils egen typografi. */
  typography?: ThemeTypography
  /** Hjørner og rammer. Utelates den, står Fristils egen form. */
  shape?: ThemeShape
}

type ThemeColors = {
  /** Lenker, knapper og fokusmarkering. */
  interactive: string
  /** Feil, sletting og avslag. */
  danger: string
  /** Fullført og godkjent. */
  success: string
  /** Noe som krever oppmerksomhet. */
  warning: string
}

/**
 * Enten alle fire fargene, eller ingen.
 *
 * Unionen er her fordi vilkåret ellers bare ville stått som en `throw` i
 * kjøretid, og prosjektets egen regel sier at fella skal lukkes i typen med
 * en beskjed ved siden av for dem typen ikke når. `buildTheme({ interactive,
 * danger })` er nå en typefeil, ikke en kjøring som stopper.
 */
export type ThemeInput =
  | (ThemeColors & ThemeCommon)
  | (Partial<Record<keyof ThemeColors, never>> & ThemeCommon)

export type ThemeAdjustment = {
  /** Tokenet som ble flyttet. */
  token: string
  /** Temaet det gjelder. */
  theme: "light" | "dark"
  /** Kontrasten før og etter. */
  before: number
  after: number
}

export type Theme = {
  light: Record<string, string>
  dark: Record<string, string>
  /** Verdiene generatoren flyttet for å holde kontrastkravet. */
  adjustments: ThemeAdjustment[]
  /** Par som ikke kunne reddes. Tom når temaet holder. */
  problems: string[]
  /** Ferdig CSS, klar til å legges etter `tokens.css`. */
  css: string
}

/** Kravet til tekst mot flate. */
const TEKST = 4.5
/** Kravet til en grafisk avgrensning, som rammen rundt et felt. */
const RAMME = 3

function forhold(a: string, b: string): number {
  return contrastRatio(parseHex(a), parseHex(b))
}

/**
 * Setter en forgrunnsfarge som holder kravet mot alle flatene den havner på.
 *
 * En farge brukes sjelden bare ett sted. `interactive-main` er både
 * lenkefargen på sideflaten, flaten under teksten på en primærknapp, og
 * fargen på et interaktivt merke. Holder den mot den ene, kan den likevel
 * ryke mot den neste, så alle flatene sendes inn samtidig og den vanskeligste
 * avgjør.
 */
function sikre(
  verdier: Record<string, string>,
  notater: ThemeAdjustment[],
  problemer: string[],
  tema: "light" | "dark",
  token: string,
  foreslatt: string,
  bakgrunner: string[],
  krav = TEKST,
): void {
  let farge = foreslatt
  const start = Math.min(...bakgrunner.map((flate) => forhold(farge, flate)))

  // Flere runder, fordi en justering mot den ene flaten kan gjøre fargen
  // dårligere mot en annen. I praksis stopper det etter én eller to.
  for (let runde = 0; runde < 4; runde += 1) {
    const verste = bakgrunner.reduce((a, b) =>
      forhold(farge, a) <= forhold(farge, b) ? a : b,
    )

    if (forhold(farge, verste) >= krav) break

    farge = adjustForContrast(farge, verste, krav).hex
  }

  verdier[token] = farge

  const slutt = Math.min(...bakgrunner.map((flate) => forhold(farge, flate)))

  if (farge !== foreslatt) {
    notater.push({ token, theme: tema, before: start, after: slutt })
  }

  if (slutt < krav) {
    const verste = bakgrunner.reduce((a, b) =>
      forhold(farge, a) <= forhold(farge, b) ? a : b,
    )
    problemer.push(
      `${token} i ${tema} tema kommer bare til ${slutt.toFixed(2)}:1 mot ${verste}, og kravet er ${krav}:1`,
    )
  }
}

export function buildTheme(input: ThemeInput): Theme {
  const { interactive, danger, success, warning } = input
  const oppgitte = [interactive, danger, success, warning].filter(Boolean)

  if (oppgitte.length > 0 && oppgitte.length < 4) {
    throw new Error(
      "Et fargetema trenger alle fire merkefargene: interactive, danger, " +
        "success og warning. Vil du bare sette skrift og form, utelat " +
        "fargene helt.",
    )
  }

  if (!interactive || !danger || !success || !warning) {
    /*
     * Uten farger er det ingen skalaer å bygge og ingen kontrast å sikre.
     *
     * At temaet faktisk setter noe kontrolleres på verdiene og ikke på at
     * blokkene finnes: `shape: {}` er et objekt, og ville ellers gitt en
     * generert fil med et tomt lag i.
     */
    const noe = {
      ...typografiVerdier(input.typography ?? {}),
      ...formVerdier(input.shape ?? {}),
    }

    if (Object.keys(noe).length === 0) {
      throw new Error(
        "Temaet er tomt. Oppgi enten merkefargene, eller skrift og form.",
      )
    }

    return {
      light: {},
      dark: {},
      adjustments: [],
      problems: [],
      css: tilCss({}, {}, {}, input.typography, input.shape),
    }
  }

  const palett = {
    interactive: buildScale(interactive),
    danger: buildScale(danger),
    success: buildScale(success),
    warning: buildScale(warning),
    visited: buildScale(input.visited ?? interactive),
    neutral: buildNeutralScale(input.neutral ?? "#1a1a1a"),
  }

  const notater: ThemeAdjustment[] = []
  const problemer: string[] = []

  /**
   * Bygger ett tema.
   *
   * Lyst og mørkt tema er samme oppskrift med motsatte trinn: flaten er lys
   * og teksten mørk, eller omvendt. Derfor står de to i samme funksjon, med
   * trinnene som parametre.
   */
  function tema(
    modus: "light" | "dark",
    trinn: {
      flate: number
      tekst: number
      statusFlate: number
      statusTekst: number
      noytralFlate: number
      noytralTekst: number
      interaktiv: number
      interaktivHover: number
      avslattFlate: number
      avslattTekst: number
      dempet: number
      rammeHover: number
      skille: number
    },
  ): Record<string, string> {
    const verdier: Record<string, string> = {}
    const flate = palett.neutral[trinn.flate]

    // Flatene først. De er utgangspunktet alt annet måles mot.
    verdier["--semantic-page-background"] = flate
    verdier["--semantic-danger-background"] = palett.danger[trinn.statusFlate]
    verdier["--semantic-warning-background"] = palett.warning[trinn.statusFlate]
    verdier["--semantic-success-background"] = palett.success[trinn.statusFlate]
    verdier["--semantic-neutral-background"] =
      palett.neutral[trinn.noytralFlate]
    verdier["--semantic-interactive-background"] =
      palett.interactive[trinn.statusFlate]
    verdier["--semantic-disabled-background"] =
      palett.neutral[trinn.avslattFlate]
    verdier["--semantic-disabled-foreground"] =
      palett.neutral[trinn.avslattTekst]
    verdier["--semantic-field-border-hover"] = palett.neutral[trinn.rammeHover]
    verdier["--semantic-divider-30"] = palett.neutral[trinn.skille]
    verdier["--semantic-divider-100"] = palett.neutral[trinn.tekst]

    // Teksten oppå en fylt knapp er flaten fra det motsatte temaet.
    const kontrastfarge = modus === "light" ? "#ffffff" : palett.neutral[100]
    verdier["--semantic-interactive-contrast"] = kontrastfarge
    verdier["--semantic-danger-contrast"] = kontrastfarge

    const sett = (
      token: string,
      foreslatt: string,
      bakgrunner: string[],
      krav?: number,
    ) =>
      sikre(
        verdier,
        notater,
        problemer,
        modus,
        token,
        foreslatt,
        bakgrunner,
        krav,
      )

    // Brødteksten står både på sideflaten og i felt med statusfarge.
    sett("--semantic-page-foreground", palett.neutral[trinn.tekst], [
      flate,
      verdier["--semantic-danger-background"],
      verdier["--semantic-warning-background"],
      verdier["--semantic-success-background"],
    ])

    sett("--semantic-muted-foreground", palett.neutral[trinn.dempet], [flate])

    /*
     * Den interaktive fargen brukes tre steder: som lenke på sideflaten, som
     * flate under teksten på en primærknapp, og som farge på et interaktivt
     * merke. Alle tre må holde.
     */
    sett("--semantic-interactive-main", palett.interactive[trinn.interaktiv], [
      flate,
      verdier["--semantic-interactive-background"],
      kontrastfarge,
    ])

    /*
     * Hover-flaten på knappen, med den samme teksten oppå. Den brukes også
     * som tekst i avataren, oppå interactive-background, så den flaten må
     * med her.
     */
    sett(
      "--semantic-interactive-foreground",
      palett.interactive[trinn.interaktivHover],
      [flate, kontrastfarge, verdier["--semantic-interactive-background"]],
    )

    sett(
      "--semantic-interactive-visited",
      palett.visited[trinn.interaktivHover],
      [flate],
    )

    // Statusfargene står både i sitt eget merke og som tekst på sideflaten.
    for (const status of ["danger", "warning", "success"] as const) {
      sett(
        `--semantic-${status}-foreground`,
        palett[status][trinn.statusTekst],
        [verdier[`--semantic-${status}-background`], flate],
      )
    }

    sett("--semantic-neutral-foreground", palett.neutral[trinn.noytralTekst], [
      verdier["--semantic-neutral-background"],
    ])

    // Den fylte sletteknappen, med lys tekst oppå.
    sett("--semantic-danger-main", palett.danger[trinn.interaktiv], [
      kontrastfarge,
    ])

    // Rammen er en grafisk avgrensning, og har derfor et lavere krav.
    sett("--semantic-field-border", palett.neutral[50], [flate], RAMME)

    return verdier
  }

  const light = tema("light", {
    flate: 0,
    tekst: 100,
    statusFlate: 10,
    statusTekst: 100,
    noytralFlate: 10,
    noytralTekst: 70,
    interaktiv: 70,
    interaktivHover: 100,
    avslattFlate: 10,
    avslattTekst: 50,
    dempet: 50,
    rammeHover: 70,
    skille: 30,
  })

  const dark = tema("dark", {
    flate: 100,
    tekst: 5,
    statusFlate: 100,
    statusTekst: 30,
    noytralFlate: 70,
    noytralTekst: 10,
    interaktiv: 30,
    interaktivHover: 10,
    avslattFlate: 70,
    avslattTekst: 30,
    dempet: 30,
    rammeHover: 30,
    skille: 70,
  })

  return {
    light,
    dark,
    adjustments: notater,
    problems: problemer,
    css: tilCss(palett, light, dark, input.typography, input.shape),
  }
}

/**
 * Kontrollene og flatene som har en hjørnevariabel.
 *
 * Lista er skrevet ut med vilje framfor å utledes. Et tema skal ikke endre
 * en komponent ingen har tenkt på, og en ny komponent skal ikke begynne å
 * følge et tema uten at noen har bestemt at den hører hjemme i den ene eller
 * andre gruppa.
 */
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
  kanskje(verdier, "--semantic-line-height-default", t.lineHeights?.default)
  kanskje(verdier, "--semantic-line-height-heading", t.lineHeights?.heading)
  kanskje(verdier, "--semantic-line-height-article", t.lineHeights?.article)
  kanskje(verdier, "--semantic-line-height-compact", t.lineHeights?.compact)
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
  "--semantic-line-height-default": "lineHeights.default",
  "--semantic-line-height-heading": "lineHeights.heading",
  "--semantic-line-height-article": "lineHeights.article",
  "--semantic-line-height-compact": "lineHeights.compact",
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

function linjer(verdier: Record<string, string>, innrykk: string): string {
  return Object.entries(verdier)
    .map(([navn, verdi]) => `${innrykk}${navn}: ${verdi};`)
    .join("\n")
}

function tilCss(
  paletter: Record<string, Record<number, string>>,
  light: Record<string, string>,
  dark: Record<string, string>,
  typografi?: ThemeTypography,
  form?: ThemeShape,
): string {
  const palett: Record<string, string> = {}
  for (const [navn, skala] of Object.entries(paletter)) {
    for (const [trinn, verdi] of Object.entries(skala)) {
      palett[`--palette-${navn}-${trinn}`] = verdi
    }
  }

  const typografiske = typografi ? typografiVerdier(typografi) : {}
  const formen = form ? formVerdier(form) : {}

  /*
   * Blokkene settes sammen av det som faktisk finnes.
   *
   * Et tema uten farger skal ikke gi tomme `:root {}` og en tom mørk blokk.
   * En generert fil som er full av tomrom ser ut som en feil, og den skal
   * kunne leses av den som lurer på hva temaet gjorde.
   */
  const rotverdier = { ...palett, ...light, ...typografiske, ...formen }
  const deler: string[] = []

  if (Object.keys(rotverdier).length > 0) {
    deler.push(`  :root {\n${linjer(rotverdier, "    ")}\n  }`)
  }

  /*
   * Skriften settes som en ekte regel, ikke bare som et token.
   *
   * Fristil arver skrift med vilje, så et token alene ville ikke endret én
   * eneste bokstav. Regelen står i det samme laget som resten, slik at
   * konsumentens egen CSS fortsatt vinner over den.
   */
  if (typografi?.fontFamily) {
    deler.push("  :root {\n    font-family: var(--font-family-base);\n  }")
  }

  if (Object.keys(dark).length > 0) {
    deler.push(
      `  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme="light"]) {\n${linjer(dark, "      ")}\n    }\n  }`,
    )
    deler.push(`  [data-theme="dark"] {\n${linjer(dark, "    ")}\n  }`)
  }

  /*
   * Temaet ligger i sitt eget lag, og laget er erklært etter `fristil`.
   *
   * Det sto i `@layer fristil` før, sammen med pakkens egne stilark, og da
   * avgjorde rekkefølgen filene ble lastet i. Den rekkefølgen har ikke
   * konsumenten alltid i hånda: både Astro og TanStack Start legger sin
   * bundlede CSS inn rett før `</head>`, altså etter en `<link>` appen selv
   * har skrevet. Temaet tapte da mot pakkens standardverdier, og det viste
   * seg først når et token fantes begge steder.
   *
   * Erklæringen `@layer fristil, fristil-tema;` avgjør rekkefølgen uavhengig
   * av når filene lastes. Begge lagene ligger fortsatt foran usortert CSS, så
   * konsumentens egne regler vinner som før.
   */
  return `/*
 * Generert av @fristil/designsystem. Rediger oppskriften, ikke denne fila.
 *
 * Overstyrer verdiene i tokens.css. Det som ikke står i oppskriften, står
 * fortsatt der.
 *
 * Laget er erklært etter «fristil», så temaet vinner over pakkens
 * standardverdier uansett hvilken rekkefølge stilarkene lastes i. Din egen
 * CSS er usortert, og vinner fortsatt over begge.
 */

@layer fristil, fristil-tema;

@layer fristil-tema {
${deler.join("\n\n")}
}
`
}
