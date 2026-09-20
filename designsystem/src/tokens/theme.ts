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

export type ThemeInput = {
  /** Lenker, knapper og fokusmarkering. */
  interactive: string
  /** Feil, sletting og avslag. */
  danger: string
  /** Fullført og godkjent. */
  success: string
  /** Noe som krever oppmerksomhet. */
  warning: string
  /** Flater, tekst og skillelinjer. Nesten uten kulør. */
  neutral?: string
  /** Besøkte lenker. Utledes fra `interactive` hvis den utelates. */
  visited?: string
}

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
  const palett = {
    interactive: buildScale(input.interactive),
    danger: buildScale(input.danger),
    success: buildScale(input.success),
    warning: buildScale(input.warning),
    visited: buildScale(input.visited ?? input.interactive),
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

    // Hover-flaten på knappen, med den samme teksten oppå.
    sett(
      "--semantic-interactive-foreground",
      palett.interactive[trinn.interaktivHover],
      [flate, kontrastfarge],
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
    css: tilCss(palett, light, dark),
  }
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
): string {
  const palett: Record<string, string> = {}
  for (const [navn, skala] of Object.entries(paletter)) {
    for (const [trinn, verdi] of Object.entries(skala)) {
      palett[`--palette-${navn}-${trinn}`] = verdi
    }
  }

  return `/*
 * Generert av @fristil/designsystem. Rediger merkefargene, ikke denne fila.
 *
 * Legges etter tokens.css, og overstyrer fargene der. Størrelser,
 * skriftstørrelser og ikoner kommer fortsatt fra tokens.css.
 */

@layer fristil {
  :root {
${linjer(palett, "    ")}

${linjer(light, "    ")}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${linjer(dark, "      ")}
    }
  }

  [data-theme="dark"] {
${linjer(dark, "    ")}
  }
}
`
}
