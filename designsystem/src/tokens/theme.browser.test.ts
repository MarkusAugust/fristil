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
