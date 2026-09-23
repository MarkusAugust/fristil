import { describe, expect, it } from "vitest"
import { fs } from "./fs"
import { fs as fsReact } from "./react"

describe("fs fra /react", () => {
  it("gir className i stedet for class", () => {
    expect(fsReact.button({ variant: "danger" })).toEqual({
      className: "fs-button",
      "data-variant": "danger",
    })
  })

  it("gir htmlFor i stedet for for på ledeteksten", () => {
    const felt = fsReact.field({ id: "epost" })

    expect(felt.label).toEqual({ className: "fs-label", htmlFor: "epost" })
  })

  it("lar dataattributter og aria stå urørt", () => {
    expect(fsReact.input({ type: "date", state: "invalid" })).toEqual({
      className: "fs-input",
      type: "date",
      "data-variant": "date",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
  })

  it("beholder lovlige verdier og vaktene fra funksjonen", () => {
    expect(fsReact.button.variants).toEqual(fs.button.variants)
    expect(fsReact.button.isVariant("ghost")).toBe(true)
    expect(fsReact.badge.isColor("neutral")).toBe(true)
    expect(fsReact.input.isType("date")).toBe(true)
  })

  it("gir samme kobling som fs.field for alt som ikke må døpes om", () => {
    const vanlig = fs.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })
    const forReact = fsReact.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })

    expect(forReact.control).toEqual(vanlig.control)
    expect(forReact.help).toEqual(vanlig.help)
    expect(forReact.error).toEqual(vanlig.error)
    expect(forReact.state).toBe(vanlig.state)
  })

  /**
   * Attributter React staver annerledes enn HTML.
   *
   * Lista er hentet fra Reacts egen tabell over DOM-egenskaper, og er lengre
   * enn de fire vi faktisk døper om. Det er poenget: en byggefunksjon som en
   * dag sender ut `readonly` eller `maxlength` skal stoppe her, ikke i
   * konsollen hos en konsument.
   */
  const STAVES_ANNERLEDES = [
    "accesskey",
    "autocapitalize",
    "autocomplete",
    "autofocus",
    "class",
    "colspan",
    "contenteditable",
    "crossorigin",
    "datetime",
    "enctype",
    "for",
    "formaction",
    "formnovalidate",
    "inputmode",
    "maxlength",
    "minlength",
    "novalidate",
    "readonly",
    "rowspan",
    "spellcheck",
    "srcset",
    "tabindex",
    "usemap",
  ]

  /** Alle attributtnavn i et svar, også de som ligger i lister og undernivå. */
  function alleNokler(verdi: unknown, samlet = new Set<string>()): Set<string> {
    if (Array.isArray(verdi)) {
      for (const del of verdi) alleNokler(del, samlet)
    } else if (verdi && typeof verdi === "object") {
      for (const [navn, under] of Object.entries(verdi)) {
        samlet.add(navn)
        alleNokler(under, samlet)
      }
    }
    return samlet
  }

  /**
   * Hvert kall vi klarer å sette sammen av byggefunksjonens egne opplysninger.
   *
   * Kallet uten argumenter alene er ikke nok: `class` kommer fra hver av dem,
   * men `for` kommer bare når feltet har en id, og `tabindex` bare når fanene
   * får et antall. Lovlige verdier henger på funksjonen, så de kan hentes ut
   * uten en håndskrevet liste.
   */
  function kall(
    bygger: (valg?: Record<string, unknown>) => unknown,
  ): unknown[] {
    const ekstra: Record<string, unknown>[] = [
      {},
      { id: "sak", count: 2, help: true, error: true, invalid: true },
    ]
    const holder = bygger as unknown as Record<string, unknown>
    for (const [navn, verdier] of Object.entries(holder)) {
      if (!navn.endsWith("s") || !Array.isArray(verdier)) continue
      const opsjon =
        { markers: "required", types: "type" }[navn] ?? navn.slice(0, -1)
      for (const verdi of verdier)
        ekstra.push({ [opsjon]: verdi, id: "sak", count: 2 })
    }

    const svar: unknown[] = []
    for (const valg of ekstra) {
      try {
        svar.push(bygger(valg))
      } catch {
        // En byggefunksjon som avviser kombinasjonen sier ikke noe om navn.
      }
    }
    return svar
  }

  /** `setAttributes` tar et element og skriver på det, og bygger ingenting. */
  const IKKE_BYGGERE = ["setAttributes"]

  const byggere = Object.entries(fsReact).filter(
    ([navn, verdi]) =>
      typeof verdi === "function" && !IKKE_BYGGERE.includes(navn),
  ) as [string, (valg?: Record<string, unknown>) => unknown][]

  it("dekker hver byggefunksjon i /react", () => {
    // Uten denne kan vaktposten under bli tom uten at noe sier fra.
    expect(byggere.length).toBeGreaterThan(30)
    for (const [navn, bygger] of byggere) {
      expect(kall(bygger).length, `${navn}() svarte aldri`).toBeGreaterThan(0)
    }
  })

  it("har ingen nøkler React ville klaget på", () => {
    for (const [navn, bygger] of byggere) {
      for (const svar of kall(bygger)) {
        for (const nokkel of alleNokler(svar)) {
          expect(STAVES_ANNERLEDES, `${navn}() gir «${nokkel}»`).not.toContain(
            nokkel,
          )
        }
      }
    }
  })

  it("har nøyaktig de samme byggefunksjonene som hovedinngangen", () => {
    // `react.ts` har sin egen liste, og en ny komponent må inn i begge.
    // Sjekken går begge veier: en funksjon som bare finnes i den ene er like
    // gal uansett hvilken av dem det er.
    expect(Object.keys(fsReact).sort()).toEqual(Object.keys(fs).sort())
  })
})

/**
 * `tabindex` er ikke bare et annet navn.
 *
 * I HTML er verdien en streng, i React er `tabIndex` et tall. Lot vi
 * strengen stå, kom `fs.tabs()` ut med `tabIndex: "0"`, og TypeScript avviste
 * den i enhver React-app. Den virket i nettleseren, siden React gjør om
 * verdien selv, så feilen viste seg bare som en typefeil hos konsumenten.
 * Det ble funnet i en ekte React-app, ikke her.
 */
describe("tabIndex kommer ut som et tall", () => {
  it("på fanene", () => {
    const faner = fsReact.tabs({ id: "sak", count: 2 })

    expect(typeof faner.tabs[0]?.tabIndex).toBe("number")
    expect(faner.tabs[0]?.tabIndex).toBe(0)
    expect(faner.tabs[1]?.tabIndex).toBe(-1)
    expect(typeof faner.panels[0]?.tabIndex).toBe("number")
  })

  it("på feiloppsummeringen", () => {
    expect(typeof fsReact.errorSummary({ count: 1 }).container.tabIndex).toBe(
      "number",
    )
  })
})
