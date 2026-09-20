import { describe, expect, it } from "vitest"

import { farge, kontrast, PAR } from "../testing/kontrast"
import "./tokens.css"
import { cssTokens, darkTokens } from "./tokens"

/**
 * Kontrasten i begge temaer, målt på ekte utregnede farger.
 *
 * Verdiene i `tokens.ts` er `var()`-henvisninger, så de kan ikke regnes på
 * direkte. Testen setter dem på et element og leser hva nettleseren faktisk
 * kommer fram til. Da fanges også feil som oppstår når en henvisning peker
 * på noe som ikke finnes.
 */

describe.each(["light", "dark"] as const)("tokens i %s tema", (tema) => {
  it.each(PAR)("%s holder 4,5:1", (_navn, forgrunn, bakgrunn) => {
    const forhold = kontrast(farge(forgrunn, tema), farge(bakgrunn, tema))
    expect(forhold).toBeGreaterThanOrEqual(4.5)
  })

  it("har en synlig feltramme mot flaten", () => {
    // Rammen er ikke tekst, men en grafisk avgrensning, så kravet er 3:1.
    const forhold = kontrast(
      farge("--semantic-field-border", tema),
      farge("--semantic-page-background", tema),
    )
    expect(forhold).toBeGreaterThanOrEqual(3)
  })
})

describe("testen selv", () => {
  it("bruker bare tokennavn som finnes", () => {
    // var(--feilstavet) faller tilbake til arvet farge, og da ville paret
    // passert uten å måle noe. Navnene sjekkes derfor mot kilden.
    const brukte = new Set(PAR.flatMap(([, fg, bg]) => [fg, bg]))
    const ukjente = [...brukte].filter((navn) => !(navn in cssTokens))

    expect(ukjente).toEqual([])
  })
})

describe("temaoppsett", () => {
  it("overstyrer bare semantiske verdier i mørkt tema", () => {
    const ikkeSemantiske = Object.keys(darkTokens).filter(
      (navn) => !navn.startsWith("--semantic-"),
    )

    // Paletten er råverdier og skal være lik i begge temaer. Det er hva
    // fargene betyr som snur, ikke hvilke farger som finnes.
    expect(ikkeSemantiske).toEqual([])
  })

  it("overstyrer bare tokens som finnes fra før", () => {
    const ukjente = Object.keys(darkTokens).filter(
      (navn) => !(navn in cssTokens),
    )

    expect(ukjente).toEqual([])
  })
})
