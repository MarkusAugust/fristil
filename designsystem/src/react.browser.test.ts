import { describe, expect, it } from "vitest"
import type { Attributes } from "./dom"
import { fs } from "./fs"
import { fs as fsReact, type ReactSet } from "./react"

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
    byggefunksjon: (valg?: Record<string, unknown>) => unknown,
  ): unknown[] {
    /*
     * Det minste kallet er med fordi de fleste byggefunksjonene skal virke uten
     * argumenter. `id` sendes likevel, siden byggefunksjonene som tar en id krever
     * den: uten den ville vakten prøvd et kall som ikke er lovlig, og fått en
     * advarsel i konsollen i tillegg.
     */
    // `label` fordi `fs.tabs()` krever et navn på raden og kaster uten.
    const ekstra: Record<string, unknown>[] = [
      { id: "sak" },
      {
        id: "sak",
        count: 2,
        keys: ["a", "b"],
        label: "Deler",
        help: true,
        error: true,
        invalid: true,
      },
    ]
    const holder = byggefunksjon as unknown as Record<string, unknown>
    for (const [navn, verdier] of Object.entries(holder)) {
      if (!navn.endsWith("s") || !Array.isArray(verdier)) continue
      const opsjon =
        { markers: "required", types: "type" }[navn] ?? navn.slice(0, -1)
      for (const verdi of verdier)
        ekstra.push({
          [opsjon]: verdi,
          id: "sak",
          count: 2,
          keys: ["a", "b"],
          label: "Deler",
        })
    }

    const svar: unknown[] = []
    for (const valg of ekstra) {
      try {
        svar.push(byggefunksjon(valg))
      } catch {
        // En byggefunksjon som avviser kombinasjonen sier ikke noe om navn.
      }
    }
    return svar
  }

  /** `setAttributes` tar et element og skriver på det, og bygger ingenting. */
  const IKKE_BYGGEFUNKSJONER = ["setAttributes"]

  const byggefunksjoner = Object.entries(fsReact).filter(
    ([navn, verdi]) =>
      typeof verdi === "function" && !IKKE_BYGGEFUNKSJONER.includes(navn),
  ) as [string, (valg?: Record<string, unknown>) => unknown][]

  it("dekker hver byggefunksjon i /react", () => {
    // Uten denne kan vaktposten under bli tom uten at noe sier fra.
    expect(byggefunksjoner.length).toBeGreaterThan(30)
    for (const [navn, byggefunksjon] of byggefunksjoner) {
      expect(
        kall(byggefunksjon).length,
        `${navn}() svarte aldri`,
      ).toBeGreaterThan(0)
    }
  })

  it("har ingen nøkler React ville klaget på", () => {
    for (const [navn, byggefunksjon] of byggefunksjoner) {
      for (const svar of kall(byggefunksjon)) {
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
  it("på feiloppsummeringen", () => {
    expect(typeof fsReact.errorSummary({ count: 1 }).host.tabIndex).toBe(
      "number",
    )
  })
})

/**
 * `setAttributes` herfra får sett med React-navnene, og må oversette dem
 * tilbake. Sendt rett til hovedinngangens funksjon ble `className` til
 * attributtet `classname` og `htmlFor` til `htmlfor`, og det nye objektet
 * fra omdøpingen sto ikke i kartet over hva settet forvalter, så
 * `aria-invalid` ble stående etter at feltet var rettet. Funnet med et
 * falskt element i et skript, ikke i en app, men en `ref` i React er nettopp
 * et element å kalle den på.
 */
describe("fs.setAttributes fra /react", () => {
  it("skriver class og for, ikke className og htmlFor", () => {
    const ledetekst = document.createElement("label")

    fsReact.setAttributes(
      ledetekst,
      fsReact.label(),
      fsReact.field({ id: "epost" }).label,
    )

    expect(ledetekst.getAttribute("class")).toBe("fs-label")
    expect(ledetekst.getAttribute("for")).toBe("epost")
    expect(ledetekst.hasAttribute("classname")).toBe(false)
    expect(ledetekst.hasAttribute("htmlfor")).toBe(false)
  })

  it("rydder det byggefunksjonen forvalter, som hovedinngangen", () => {
    const felt = document.createElement("input")

    fsReact.setAttributes(felt, fsReact.input({ state: "invalid" }))
    expect(felt.getAttribute("aria-invalid")).toBe("true")
    expect(felt.getAttribute("data-state")).toBe("invalid")

    fsReact.setAttributes(felt, fsReact.input())
    expect(felt.hasAttribute("aria-invalid")).toBe(false)
    expect(felt.hasAttribute("data-state")).toBe(false)
    expect(felt.className).toBe("fs-input")
  })

  it("skriver tabIndex som tabindex", () => {
    const boks = document.createElement("div")
    const { host } = fsReact.errorSummary({ count: 1 })

    fsReact.setAttributes(boks, host)

    expect(boks.getAttribute("tabindex")).toBe(String(host.tabIndex))
  })

  it("gir det samme elementet som hovedinngangen", () => {
    const par: [Attributes, ReactSet][] = [
      [fs.button({ variant: "danger" }), fsReact.button({ variant: "danger" })],
      [
        fs.input({ type: "date", state: "invalid" }),
        fsReact.input({ type: "date", state: "invalid" }),
      ],
      [fs.field({ id: "a" }).label, fsReact.field({ id: "a" }).label],
      [
        fs.errorSummary({ count: 1 }).host,
        fsReact.errorSummary({ count: 1 }).host,
      ],
      [fs.suggestion({ id: "s" }).list, fsReact.suggestion({ id: "s" }).list],
    ]
    for (const [vanlig, forReact] of par) {
      const a = document.createElement("div")
      const b = document.createElement("div")
      fs.setAttributes(a, vanlig)
      fsReact.setAttributes(b, forReact)
      expect(b.outerHTML).toBe(a.outerHTML)
    }
  })
})
