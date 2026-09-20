import { describe, expect, it } from "vitest"

import { FsField } from "../components/ramme/field/fs-field"
import { FsCalendar } from "../components/sammensatt/calendar/fs-calendar"
import { FsDateField } from "../components/sammensatt/date-field/fs-date-field"
import kilde from "./react?raw"

/**
 * JSX-deklarasjonene er håndskrevet, og kan derfor komme i utakt med
 * komponentene de beskriver. Legger noen til en egenskap på `<fs-date-field>`
 * uten å legge den inn her, er den usynlig for TypeScript — og da er vi
 * tilbake til at skrivefeil går rett gjennom.
 *
 * Testen leser `static properties` fra komponentene og krever at hvert
 * attributt finnes i deklarasjonsfila.
 */

type LitEgenskaper = Record<string, { attribute?: string | boolean }>

/** Attributtnavnet Lit faktisk lytter på for hver egenskap. */
function attributtnavn(klasse: { properties?: unknown }): string[] {
  const egenskaper = (klasse.properties ?? {}) as LitEgenskaper
  return Object.entries(egenskaper)
    .filter(([, valg]) => valg.attribute !== false)
    .map(([navn, valg]) =>
      typeof valg.attribute === "string" ? valg.attribute : navn.toLowerCase(),
    )
}

describe("JSX-deklarasjonene følger komponentene", () => {
  it.each([
    ["fs-field", FsField],
    ["fs-calendar", FsCalendar],
    ["fs-date-field", FsDateField],
  ])("%s har alle attributtene sine deklarert", (tagg, klasse) => {
    const attributter = attributtnavn(klasse)

    // Selve taggen må finnes i IntrinsicElements
    expect(kilde).toContain(`"${tagg}"`)

    const mangler = attributter.filter(
      (navn) => !new RegExp(`(^|\\W)"?${navn}"?\\??:`, "m").test(kilde),
    )

    expect(
      mangler,
      `Disse attributtene på <${tagg}> mangler i src/jsx/react.ts`,
    ).toEqual([])
  })

  it("deklarerer ikke attributter komponentene ikke har", () => {
    const kjente = new Set([
      ...attributtnavn(FsField),
      ...attributtnavn(FsCalendar),
      ...attributtnavn(FsDateField),
    ])

    // Bare attributtblokkene — taggnavnene i IntrinsicElements står under
    // `declare module`, og skal ikke med.
    const attributtblokker = kilde.slice(0, kilde.indexOf("declare module"))
    const deklarerte = [
      ...attributtblokker.matchAll(/^\s+"?([a-z-]+)"?\??: /gm),
    ].map((treff) => treff[1] as string)

    const ukjente = deklarerte.filter((navn) => !kjente.has(navn))

    expect(
      ukjente,
      "Disse er deklarert i src/jsx/react.ts, men finnes ikke på noen komponent",
    ).toEqual([])
  })
})
