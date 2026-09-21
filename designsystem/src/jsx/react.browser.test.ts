import { describe, expect, it } from "vitest"
import { FsConnectionStatus } from "../components/frittstaende/connection-status/fs-connection-status"
import { FsSessionTimeout } from "../components/frittstaende/session-timeout/fs-session-timeout"
import { FsToast } from "../components/frittstaende/toast/fs-toast"
import { FsErrorSummary } from "../components/ramme/error-summary/fs-error-summary"
import { FsField } from "../components/ramme/field/fs-field"
import { FsPopover } from "../components/ramme/popover/fs-popover"
import { FsSuggestion } from "../components/ramme/suggestion/fs-suggestion"
import { FsTabs } from "../components/ramme/tabs/fs-tabs"
import kilde from "./react?raw"

/**
 * JSX-deklarasjonene er håndskrevet, og kan derfor komme i utakt med
 * komponentene de beskriver. Legger noen til en egenskap på `<fs-suggestion>`
 * uten å legge den inn her, er den usynlig for TypeScript, og da er vi
 * tilbake til at skrivefeil går rett gjennom.
 *
 * Testen leser `static observedAttributes` fra komponentene og krever at
 * hvert attributt finnes i deklarasjonsfila.
 */

/** Attributtene komponenten faktisk lytter på. */
function attributtnavn(klasse: { observedAttributes?: unknown }): string[] {
  return [...((klasse.observedAttributes ?? []) as string[])]
}

describe("JSX-deklarasjonene følger komponentene", () => {
  it.each([
    ["fs-field", FsField],
    ["fs-tabs", FsTabs],
    ["fs-error-summary", FsErrorSummary],
    ["fs-popover", FsPopover],
    ["fs-toast", FsToast],
    ["fs-session-timeout", FsSessionTimeout],
    ["fs-connection-status", FsConnectionStatus],
    ["fs-suggestion", FsSuggestion],
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
      ...attributtnavn(FsTabs),
      ...attributtnavn(FsErrorSummary),
      ...attributtnavn(FsPopover),
      ...attributtnavn(FsToast),
      ...attributtnavn(FsSessionTimeout),
      ...attributtnavn(FsConnectionStatus),
      ...attributtnavn(FsSuggestion),
    ])

    // Bare attributtblokkene. Taggnavnene i IntrinsicElements står under
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
