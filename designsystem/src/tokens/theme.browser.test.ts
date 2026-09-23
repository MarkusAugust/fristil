import { afterEach, describe, expect, it } from "vitest"

import { farge, kontrast, PAR } from "../testing/kontrast"
import { adjustForContrast, parseHex, rgbToOklch } from "./color"
import { buildTheme } from "./theme"

import "./tokens.css"

/**
 * At et tema laget av andre sine merkefarger holder de samme løftene.
 *
 * Generatoren regner kontrasten selv mens den bygger temaet. Denne testen
 * kontrollerer den regningen mot nettleseren, og mot nøyaktig den lista over
 * par som de innebygde fargene måles mot. Regner generatoren feil, eller
 * glemmer den et par som systemet faktisk bruker, kommer det fram her.
 */

const MERKER = [
  {
    navn: "lilla",
    farger: {
      interactive: "#7c3aed",
      danger: "#b3261e",
      success: "#2b6940",
      warning: "#8a5a00",
      neutral: "#1a1a1a",
    },
  },
  {
    navn: "turkis med blå nøytral",
    farger: {
      interactive: "#0f766e",
      danger: "#9f1239",
      success: "#15803d",
      warning: "#a16207",
      neutral: "#111827",
    },
  },
  {
    navn: "knallrosa, altså en vanskelig kulør",
    farger: {
      interactive: "#ec4899",
      danger: "#dc2626",
      success: "#65a30d",
      warning: "#f59e0b",
      neutral: "#1c1917",
    },
  },
]

/** Legger temaet inn på siden, slik en konsument ville gjort. */
function bruk(css: string): HTMLStyleElement {
  const stil = document.createElement("style")
  stil.dataset.tema = ""
  stil.textContent = css
  document.head.append(stil)
  return stil
}

afterEach(() => {
  for (const stil of document.querySelectorAll("style[data-tema]")) {
    stil.remove()
  }
  document.documentElement.removeAttribute("data-theme")
})

describe.each(MERKER)("tema fra $navn", ({ farger }) => {
  const tema = buildTheme(farger)

  it("kommer fram til et tema uten uløste problemer", () => {
    expect(tema.problems).toEqual([])
  })

  describe.each(["light", "dark"] as const)("i %s tema", (modus) => {
    it.each(PAR)("%s holder 4,5:1", (_navn, forgrunn, bakgrunn) => {
      bruk(tema.css)

      const forhold = kontrast(farge(forgrunn, modus), farge(bakgrunn, modus))
      expect(forhold).toBeGreaterThanOrEqual(4.5)
    })

    it("har en synlig feltramme mot flaten", () => {
      bruk(tema.css)

      const forhold = kontrast(
        farge("--semantic-field-border", modus),
        farge("--semantic-page-background", modus),
      )
      expect(forhold).toBeGreaterThanOrEqual(3)
    })
  })
})

describe("generatoren", () => {
  it("setter alle tokenene systemet leser", () => {
    const tema = buildTheme(MERKER[0].farger)

    // Hvert par i lista peker på to tokens. Mangler ett av dem i temaet,
    // faller komponenten tilbake til Fristils egen farge, og konsumenten
    // sitter med to paletter uten å vite det.
    const brukte = new Set(PAR.flatMap(([, fg, bg]) => [fg, bg]))
    const mangler = [...brukte].filter((navn) => !(navn in tema.light))

    expect(mangler).toEqual([])
  })

  it("tar kuløren fra merkefargen og lysheten fra skalaen", () => {
    /*
     * Samme lilla kulør, én lys og én mørk variant. Lysheten i det som kommer
     * ut settes av trinnet i skalaen og av kontrastkravet, ikke av hvor lys
     * fargen du oppga var. Ellers kunne ikke kontrasten garanteres.
     *
     * Metningen følger derimot med: en dus merkefarge gir en dus skala.
     */
    const felles = {
      danger: "#b3261e",
      success: "#2b6940",
      warning: "#8a5a00",
      neutral: "#1a1a1a",
    }
    const lys = buildTheme({ ...felles, interactive: "#c4b5fd" })
    const mork = buildTheme({ ...felles, interactive: "#4c1d95" })

    const ut = (tema: typeof lys) =>
      rgbToOklch(parseHex(tema.light["--semantic-interactive-main"]))

    // Lysheten inn spriker med 0,47. Lysheten ut skal ligge tett sammen.
    expect(rgbToOklch(parseHex("#c4b5fd")).l).toBeGreaterThan(
      rgbToOklch(parseHex("#4c1d95")).l + 0.4,
    )
    expect(Math.abs(ut(lys).l - ut(mork).l)).toBeLessThan(0.05)

    // Og kuløren skal være den samme lilla i begge.
    expect(Math.abs(ut(lys).h - ut(mork).h)).toBeLessThan(8)
  })

  it("forteller hva den flyttet", () => {
    const tema = buildTheme(MERKER[0].farger)

    // Lilla på 55 prosent lyshet kommer til 4,19:1 mot sitt eget merke, og
    // må mørknes litt. Generatoren sier fra framfor å gjøre det i stillhet.
    const flyttet = tema.adjustments.find(
      (justering) =>
        justering.token === "--semantic-interactive-main" &&
        justering.theme === "light",
    )

    expect(flyttet).toBeDefined()
    expect(flyttet?.before).toBeLessThan(4.5)
    expect(flyttet?.after).toBeGreaterThanOrEqual(4.5)
  })

  it("sier fra når et krav ikke kan oppfylles", () => {
    // Mot en flate midt på skalaen finnes det ingen farge som holder 7:1,
    // hverken mørkere eller lysere. Da skal justeringen gi det beste
    // forsøket og kalleren få vite at det ikke holdt.
    const forsok = adjustForContrast("#808080", "#808080", 7)

    expect(forsok.ratio).toBeLessThan(7)
  })

  it("beholder kuløren i merkefargen", () => {
    const tema = buildTheme(MERKER[0].farger)

    // Lilla inn skal gi lilla ut. Generatoren flytter lysheten, ikke kuløren.
    expect(tema.light["--semantic-interactive-main"]).toMatch(/^#[0-9a-f]{6}$/)

    const [, r, g, b] = /^#(..)(..)(..)$/.exec(
      tema.light["--semantic-interactive-main"],
    ) as RegExpExecArray

    expect(Number.parseInt(b, 16)).toBeGreaterThan(Number.parseInt(g, 16))
    expect(Number.parseInt(r, 16)).toBeGreaterThan(Number.parseInt(g, 16))
  })
})

/**
 * Skrift og form.
 *
 * Fargene er det vanskeligste å få riktig, og derfor begynte generatoren
 * der. Men to systemer med samme palett ser fortsatt ulike ut hvis skriften
 * og hjørnene er ulike, og da er det ikke det samme temaet.
 */
describe("temaet kan også sette skrift og form", () => {
  const farger = {
    interactive: "#1362ae",
    danger: "#a82e39",
    success: "#316f2a",
    warning: "#9f7509",
  }

  it("lar være å skrive noe når ingenting er oppgitt", () => {
    // Det er hele bakoverforeneligheten: et tema uten skrift og form skal
    // være nøyaktig det temaet var før disse kom til.
    const tema = buildTheme(farger)

    expect(tema.css).not.toContain("--font-family-base")
    expect(tema.css).not.toContain("--fs-button-radius")
    expect(tema.css).not.toContain("font-family:")
  })

  it("setter skriften som en ekte regel, ikke bare som et token", () => {
    // Fristil arver skrift med vilje, så et token alene ville ikke endret
    // én eneste bokstav på skjermen.
    const tema = buildTheme({
      ...farger,
      typography: { fontFamily: "Helvetica, Arial, sans-serif" },
    })

    expect(tema.css).toContain(
      "--font-family-base: Helvetica, Arial, sans-serif;",
    )
    expect(tema.css).toContain("font-family: var(--font-family-base);")
  })

  it("skriver bare de vektene og linjeavstandene som er oppgitt", () => {
    const tema = buildTheme({
      ...farger,
      typography: { weights: { bold: 700 }, lineHeights: { article: 1.666 } },
    })

    expect(tema.css).toContain("--font-weight-bold: 700;")
    expect(tema.css).toContain("--semantic-line-height-article: 1.666;")
    expect(tema.css).not.toContain("--font-weight-regular")
    expect(tema.css).not.toContain("--semantic-line-height-heading")
  })

  it("skiller knapp, felt og flate", () => {
    // Skatteetatens knapper er helt runde, mens feltene deres har nesten
    // rette hjørner. Ett felles tall ville gjort feltene til kapsler.
    const tema = buildTheme({
      ...farger,
      shape: {
        buttonRadius: "2.75rem",
        fieldRadius: "0.25rem",
        surfaceRadius: "0.5rem",
      },
    })

    expect(tema.css).toContain("--fs-button-radius: 2.75rem;")
    expect(tema.css).toContain("--fs-pagination-radius: 2.75rem;")
    expect(tema.css).toContain("--fs-input-radius: 0.25rem;")
    expect(tema.css).toContain("--fs-card-radius: 0.5rem;")
    expect(tema.css).toContain("--fs-dialog-radius: 0.5rem;")
  })

  it("rører ikke det som har hjørnet sitt som form", () => {
    // En avkryssingsboks som blir rund ser ut som en radioknapp, og en
    // avatar er rund fordi den er en avatar.
    const tema = buildTheme({
      ...farger,
      shape: {
        buttonRadius: "2.75rem",
        fieldRadius: "2.75rem",
        surfaceRadius: "2.75rem",
      },
    })

    expect(tema.css).not.toContain("--fs-checkbox-radius")
    expect(tema.css).not.toContain("--fs-avatar-radius")
    expect(tema.css).not.toContain("--fs-skeleton-radius")
    expect(tema.css).not.toContain("--fs-badge-radius")
  })

  it("virker i nettleseren, ikke bare som tekst", async () => {
    // Det holder ikke at strengen står der. Regelen må også slå gjennom på
    // et ekte element, og komponenten må faktisk lese variabelen.
    const tema = buildTheme({
      ...farger,
      typography: { fontFamily: "Courier, monospace" },
      shape: {
        buttonRadius: "2.75rem",
        buttonBorderWidth: "3px",
        buttonFontWeight: 700,
      },
    })

    const stil = document.createElement("style")
    stil.textContent = `@layer fristil;\n${tema.css}`
    document.head.append(stil)

    const knappestil = await import(
      "../components/css/button/button.css?inline"
    )
    const knappeark = document.createElement("style")
    knappeark.textContent = knappestil.default
    document.head.append(knappeark)

    const knapp = document.createElement("button")
    knapp.className = "fs-button"
    knapp.textContent = "Send søknad"
    document.body.append(knapp)

    const beregnet = getComputedStyle(knapp)
    expect(beregnet.borderTopWidth).toBe("3px")
    expect(beregnet.fontWeight).toBe("700")
    expect(beregnet.borderTopLeftRadius).toBe("44px")
    expect(beregnet.fontFamily).toContain("Courier")

    knapp.remove()
    stil.remove()
    knappeark.remove()
  })
})

/**
 * Temaet uten farger.
 *
 * Fristils egen palett er Skatteetatens, verdi for verdi. Å kjøre fargene
 * deres gjennom generatoren ville derfor flyttet dem bort fra der de skal
 * være: `#1362ae` kommer ut som `#1e6ab7`, siden skalaene regnes om i OKLCH
 * fra merkefargen. Et tema som bare setter skrift og form er svaret.
 */
describe("et tema kan la fargene stå", () => {
  it("skriver verken palett eller semantiske farger", () => {
    const tema = buildTheme({
      typography: { fontFamily: "Helvetica, Arial, sans-serif" },
      shape: { buttonRadius: "2.75rem" },
    })

    expect(tema.css).not.toContain("--palette-")
    expect(tema.css).not.toContain("--semantic-")
    expect(tema.css).toContain("--font-family-base")
    expect(tema.light).toEqual({})
    expect(tema.dark).toEqual({})
  })

  it("lar være å skrive tomme blokker", () => {
    // En generert fil full av tomrom ser ut som en feil.
    const tema = buildTheme({ shape: { buttonRadius: "2.75rem" } })

    expect(tema.css).not.toContain("prefers-color-scheme")
    expect(tema.css).not.toMatch(/\{\s*\}/)
  })

  it("krever alle fire fargene, eller ingen", () => {
    // To farger er alltid en feil: resten av temaet ville blitt bygget av
    // standardfarger, og ingen ba om den blandingen.
    expect(() =>
      buildTheme({ interactive: "#1362ae", danger: "#a82e39" }),
    ).toThrow(/alle fire/)
  })

  it("sier fra når oppskriften er tom", () => {
    expect(() => buildTheme({})).toThrow(/tomt/)
  })
})
