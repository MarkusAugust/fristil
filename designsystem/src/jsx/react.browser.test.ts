import { describe, expect, it } from "vitest"
import { FsConnectionStatus } from "../components/frittstaende/connection-status/fs-connection-status"
import { FsSessionTimeout } from "../components/frittstaende/session-timeout/fs-session-timeout"
import { FsToast } from "../components/frittstaende/toast/fs-toast"
import { FsErrorSummary } from "../components/ramme/error-summary/fs-error-summary"
import { FsField } from "../components/ramme/field/fs-field"
import { FsPopover } from "../components/ramme/popover/fs-popover"
import { FsSuggestion } from "../components/ramme/suggestion/fs-suggestion"
import { FsTabs } from "../components/ramme/tabs/fs-tabs"
import { fs } from "../fs"
import { toReactAttributes } from "../react"
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

/**
 * Attributter React allerede kjenner gjennom `HTMLAttributes`.
 *
 * `<fs-error-summary>` observerer `hidden`, fordi serveren kan ta det bort
 * for å vise boksen. Det er ikke et attributt vi har funnet på, og å
 * deklarere det på nytt ville vært å gjenta nettleseren.
 */
const STANDARD = new Set([
  "hidden",
  "id",
  "class",
  "title",
  "lang",
  "dir",
  "slot",
])

/** Attributtene komponenten faktisk lytter på, utenom de standardiserte. */
function attributtnavn(klasse: { observedAttributes?: unknown }): string[] {
  return [...((klasse.observedAttributes ?? []) as string[])].filter(
    (navn) => !STANDARD.has(navn),
  )
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

describe("React-inngangen dekker alle attributtene byggefunksjonene sender ut", () => {
  /**
   * `autocomplete` slapp gjennom til React-demoen og ga «Invalid DOM property
   * `autocomplete`. Did you mean `autoComplete`?» i konsollen. `tabindex`
   * hadde sluppet gjennom på samme måte en runde tidligere.
   *
   * Testen teller opp hvert attributtnavn `fs` faktisk sender ut, og krever at
   * ingen av dem er et React staver med stor bokstav inni uten at `react.ts`
   * døper det om.
   */
  const KAMELFORMER: Record<string, string> = {
    class: "className",
    for: "htmlFor",
    tabindex: "tabIndex",
    autocomplete: "autoComplete",
    maxlength: "maxLength",
    minlength: "minLength",
    readonly: "readOnly",
    colspan: "colSpan",
    rowspan: "rowSpan",
    inputmode: "inputMode",
    novalidate: "noValidate",
    spellcheck: "spellCheck",
    datetime: "dateTime",
    crossorigin: "crossOrigin",
  }

  /** Hvert attributtnavn en byggefunksjon kan sende ut. */
  function alleAttributtnavn(): string[] {
    const funnet = new Set<string>()
    const samle = (verdi: unknown) => {
      if (!verdi || typeof verdi !== "object") return
      if (Array.isArray(verdi)) {
        for (const del of verdi) samle(del)
        return
      }
      for (const [navn, under] of Object.entries(verdi)) {
        if (under && typeof under === "object") samle(under)
        else funnet.add(navn)
      }
    }

    const medArgumenter: Record<string, unknown> = {
      popover: { id: "x" },
      tabs: { id: "x", count: 2 },
      suggestion: { id: "x", count: 2 },
      field: { id: "x", help: true, error: true },
    }

    for (const [navn, verdi] of Object.entries(fs)) {
      if (typeof verdi !== "function") continue
      try {
        const bygger = verdi as (valg?: unknown) => unknown
        samle(bygger(medArgumenter[navn]))
      } catch {
        // Vakter og hjelpefunksjoner tåler ikke å bli kalt slik. De sender
        // ikke ut attributter, så de er uinteressante her.
      }
    }
    return [...funnet]
  }

  it("døper om hvert navn React staver annerledes", () => {
    // Sjekker hva funksjonen gjør, ikke hva som står i kildeteksten. Navnet
    // finnes uansett i typen og i kommentaren, så et tekstsøk ville meldt
    // grønt selv om omdøpingen manglet.
    const mangler = alleAttributtnavn()
      .filter((navn) => navn in KAMELFORMER)
      .filter((navn) => {
        const ut = toReactAttributes({ [navn]: "x" })
        return !(KAMELFORMER[navn] in ut)
      })

    expect(
      mangler,
      "Disse må inn i NAVN-tabellen i src/react.ts, ellers advarer React",
    ).toEqual([])
  })

  it("lar aria- og data-attributter stå", () => {
    // React sender dem videre uendret, så en omdøping ville gitt ugyldig
    // HTML. Her kjøres hvert navn gjennom funksjonen og sjekkes at det kommer
    // ut med samme nøkkel. Den forrige utgaven filtrerte bare på navn som
    // fantes i KAMELFORMER, og siden ingen aria- eller data-navn står der,
    // kunne den aldri feile.
    const navnene = alleAttributtnavn().filter(
      (navn) => navn.startsWith("aria-") || navn.startsWith("data-"),
    )

    expect(navnene.length, "fant ingen å sjekke").toBeGreaterThan(5)

    const dopt = navnene.filter(
      (navn) => !(navn in toReactAttributes({ [navn]: "x" })),
    )

    expect(dopt, "Disse skal stå som de er i React").toEqual([])
  })
})
