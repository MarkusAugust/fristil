import { beforeEach, describe, expect, it } from "vitest"

import { managedNames } from "./components/css/shared"
import { lt } from "./lt"

describe("lt.setAttributes", () => {
  it("gjør ingenting når elementet er borte", () => {
    /*
     * `document.querySelector()` gir `Element | null`, og uten dette måtte
     * hvert kallsted i en `strict`-app skrive en vakt rundt et oppslag som
     * nesten alltid treffer. Den skal ikke kaste, og den skal ikke gjøre noe.
     */
    expect(() => lt.setAttributes(null, lt.button())).not.toThrow()
    expect(() => lt.setAttributes(undefined, lt.button())).not.toThrow()
  })

  let element: HTMLInputElement

  beforeEach(() => {
    document.body.innerHTML = '<input id="felt" />'
    element = document.getElementById("felt") as HTMLInputElement
  })

  it("bruker attributtene fra en lt-funksjon", () => {
    lt.setAttributes(element, lt.input({ type: "email", state: "invalid" }))

    expect(element.className).toBe("lt-input")
    expect(element.getAttribute("type")).toBe("email")
    expect(element.getAttribute("data-state")).toBe("invalid")
    expect(element.getAttribute("aria-invalid")).toBe("true")
  })

  it("rydder bort tilstand fra forrige kall", () => {
    lt.setAttributes(element, lt.input({ type: "email", state: "invalid" }))
    lt.setAttributes(element, lt.input({ type: "email" }))

    // Byggefunksjonen utelater data-state i normaltilstand. Uten oppryddingen
    // ville feltet blitt stående rødt etter at feilen var rettet.
    expect(element.hasAttribute("data-state")).toBe(false)
    expect(element.hasAttribute("aria-invalid")).toBe(false)
    expect(element.getAttribute("type")).toBe("email")
  })

  it("lar konsumentens egne attributter være i fred", () => {
    element.setAttribute("data-testid", "epostfelt")
    element.setAttribute("name", "epost")

    lt.setAttributes(element, lt.input({ type: "email", state: "invalid" }))
    lt.setAttributes(element, lt.input({ type: "email" }))

    expect(element.getAttribute("data-testid")).toBe("epostfelt")
    expect(element.getAttribute("name")).toBe("epost")
  })

  it("beholder konsumentens egne klasser", () => {
    element.className = "min-klasse lt-gammel"

    lt.setAttributes(element, lt.input({ type: "text" }))

    expect(element.classList.contains("min-klasse")).toBe(true)
    expect(element.classList.contains("lt-input")).toBe(true)
    // lt-klasser eies av systemet og byttes ut
    expect(element.classList.contains("lt-gammel")).toBe(false)
  })

  it("virker på et helt felt sammen med lt.field", () => {
    document.body.innerHTML = `
      <label id="ledetekst"></label>
      <input id="kontroll" />
      <p id="feil"></p>
    `
    const felt = lt.field({ id: "epost", error: true, invalid: true })

    // Hentes før, siden felt.control setter id-en på kontrollen
    const ledetekst = document.getElementById("ledetekst") as HTMLLabelElement
    const kontroll = document.getElementById("kontroll") as HTMLInputElement

    lt.setAttributes(ledetekst, felt.label)
    lt.setAttributes(kontroll, lt.input({ type: "email" }), felt.control)

    expect(ledetekst.getAttribute("for")).toBe("epost")
    expect(kontroll.id).toBe("epost")
    expect(kontroll.getAttribute("aria-describedby")).toBe("epost-error")
    expect(kontroll.getAttribute("aria-invalid")).toBe("true")
    expect(kontroll.getAttribute("data-state")).toBe("invalid")
  })
})

describe("boolske attributter", () => {
  it("setter et boolsk attributt som tom streng, slik HTML forventer", () => {
    const element = document.createElement("input")

    lt.setAttributes(element, lt.switch({ disabled: true }))

    expect(element.getAttribute("disabled")).toBe("")
    expect(element.disabled).toBe(true)
    expect(element.getAttribute("role")).toBe("switch")
  })

  it("fjerner det boolske attributtet når det ikke er med lenger", () => {
    const element = document.createElement("input")

    lt.setAttributes(element, lt.switch({ disabled: true }))
    lt.setAttributes(element, lt.switch())

    expect(element.hasAttribute("disabled")).toBe(false)
  })

  it("tar imot attributtene fra et helt felt", () => {
    const element = document.createElement("input")
    const field = lt.field({ id: "epost", disabled: true })

    lt.setAttributes(element, lt.input({ type: "email" }), field.control)

    expect(element.disabled).toBe(true)
    expect(element.id).toBe("epost")
    expect(element.type).toBe("email")
  })
})

/** Valg som gir de sammensatte byggefunksjonene noe å bygge. */
const GRUNNVALG: Record<string, Record<string, unknown>> = {
  field: { id: "felt", help: true, error: true },
  tabs: { id: "faner", keys: ["a", "b"], label: "Faner" },
  suggestion: { id: "forslag", keys: ["a", "b"] },
  dialog: { titleId: "tittel" },
  popover: { id: "panel" },
  errorSummary: { count: 1 },
  sessionTimeout: { titleId: "okt" },
}

/**
 * Hvert valg en byggefunksjon kan ta, slått på samtidig.
 *
 * En byggefunksjon bryr seg bare om valgene den kjenner, så ett felles
 * objekt holder. Verdilistene, som `variants` og `colors`, leses av
 * funksjonen selv og legges til i `valgsettene()`.
 */
const ALT_PAA: Record<string, unknown> = {
  interactive: true,
  hoverable: true,
  selectable: true,
  disabled: true,
  multiple: true,
  accept: ".pdf",
  open: true,
  pending: true,
  invalid: true,
  optional: true,
  required: "symbol",
  help: true,
  error: true,
  label: "Navn",
  placement: "top-end",
  activeIndex: 0,
  selected: 1,
  describedBy: ["annet"],
  offlineText: "Nede",
  onlineText: "Oppe",
  warnAt: 10,
  expiresAt: 20,
  value: 4,
  max: 10,
  autofocus: false,
  direction: "descending",
}

/** `lt.label({ required: "symbol" })` henger på `label.markers`. */
const NOKKEL: Record<string, string> = { markers: "required" }

type Byggefunksjon = ((valg?: unknown) => unknown) & Record<string, unknown>

function byggefunksjonene(): [string, Byggefunksjon][] {
  return Object.entries(lt).filter(([navn, verdi]) => {
    if (typeof verdi !== "function") return false
    return !["setAttributes", "isState", "isMarker"].includes(navn)
  }) as [string, Byggefunksjon][]
}

/**
 * Valgsettene hver byggefunksjon kalles med.
 *
 * Ett sett holder ikke. Noen valg skygger for hverandre: `required` slår
 * `optional` på ledeteksten, og den siste verdien i `states` er `success`,
 * som aldri gir `aria-invalid`. Med bare «alt på» ble `data-optional` og
 * `aria-invalid` aldri slått på, og en byggefunksjon som ikke kunne ta dem
 * bort igjen, hadde gått gjennom.
 */
function valgsettene(navn: string, byggefunksjon: Byggefunksjon) {
  const lister = Object.entries(byggefunksjon).filter(([, verdier]) =>
    Array.isArray(verdier),
  ) as [string, string[]][]
  const nokkel = (liste: string) => NOKKEL[liste] ?? liste.replace(/s$/, "")
  const grunn = GRUNNVALG[navn] ?? {}

  const sett: Record<string, unknown>[] = []
  // Alt på, med den siste verdien i hver liste.
  const alt: Record<string, unknown> = { ...ALT_PAA, ...grunn }
  for (const [liste, verdier] of lister) {
    alt[nokkel(liste)] = verdier[verdier.length - 1]
  }
  sett.push(alt)
  // Hver verdi i hver liste for seg, ved siden av de boolske valgene.
  for (const [liste, verdier] of lister) {
    for (const verdi of verdier) {
      sett.push({ ...ALT_PAA, ...grunn, [nokkel(liste)]: verdi })
    }
  }
  // Uten `required`, så `optional` slipper til.
  sett.push({ ...alt, required: undefined })
  return sett
}

/** Hvert attributtsett i en returverdi, med stien dit. */
function settene(
  verdi: unknown,
  sti: string,
  ut: [string, Record<string, unknown>][] = [],
) {
  if (Array.isArray(verdi)) {
    verdi.forEach((under, i) => {
      settene(under, `${sti}[${i}]`, ut)
    })
  } else if (verdi && typeof verdi === "object") {
    const harSett = Object.values(verdi).some(
      (under) => under && typeof under === "object",
    )
    if (harSett) {
      for (const [navn, under] of Object.entries(verdi)) {
        settene(under, `${sti}.${navn}`, ut)
      }
    } else {
      ut.push([sti, verdi as Record<string, unknown>])
    }
  }
  return ut
}

describe("hvert sett vet hva det forvalter", () => {
  /*
   * `setAttributes` rydder det byggefunksjonen forvalter, og det vet den
   * fra `attributes()`, som noterer hver nøkkel den får inn. Hele ordningen
   * hviler på to ting ingen ellers ville sett brudd på: at hvert sett går
   * gjennom `attributes()`, og at hver valgfri nøkkel sendes inn også når
   * valget er av. En betinget spredning, `...(x ? { a } : {})`, ville gitt
   * et attributt som kan settes og aldri fjernes.
   */
  const alle = byggefunksjonene()

  it("finner byggefunksjonene", () => {
    expect(alle.length).toBeGreaterThan(40)
  })

  it.each(alle)("lt.%s() sender hvert sett gjennom attributes()", (navn, f) => {
    const sett = settene(f(GRUNNVALG[navn] ?? {}), navn)

    expect(sett.length).toBeGreaterThan(0)
    for (const [sti, ett] of sett) {
      expect(managedNames(ett), sti).toBeDefined()
    }
  })

  it.each(
    alle,
  )("lt.%s() forvalter de samme navnene uansett valg", (navn, f) => {
    const av = new Map(settene(f(GRUNNVALG[navn] ?? {}), navn))

    for (const valg of valgsettene(navn, f)) {
      for (const [sti, ett] of settene(f(valg), navn)) {
        const grunn = av.get(sti)
        // Et sett som bare finnes når et valg er på, som feilmeldingen i et
        // felt, har ikke noe å sammenlignes med.
        if (!grunn) continue
        expect([...(managedNames(ett) ?? [])].sort(), sti).toEqual(
          [...(managedNames(grunn) ?? [])].sort(),
        )
      }
    }
  })

  /** Navnene som teller, utenom klassen og dem som aldri fjernes. */
  const teller = (n: string) => n !== "class" && n !== "id" && n !== "for"

  function navnPaa(element: Element): string[] {
    return [...element.attributes]
      .map((a) => a.name)
      .filter(teller)
      .sort()
  }

  function navnI(sett: Record<string, unknown>): string[] {
    return Object.keys(sett).filter(teller).sort()
  }

  it.each(
    alle,
  )("lt.%s() kan gå mellom hvert valgsett og grunnsettet, begge veier", (navn, f) => {
    type Sett = Parameters<typeof lt.setAttributes>[1]
    const av = new Map(settene(f(GRUNNVALG[navn] ?? {}), navn))
    let sjekket = 0

    for (const valg of valgsettene(navn, f)) {
      for (const [sti, paa] of settene(f(valg), navn)) {
        const grunn = av.get(sti)
        if (!grunn) continue

        // Fra valgene og tilbake: alt valget satte, skal bort.
        const ned = document.createElement("div")
        lt.setAttributes(ned, paa as Sett)
        lt.setAttributes(ned, grunn as Sett)
        expect(navnPaa(ned), `${sti}, tilbake til grunnsettet`).toEqual(
          navnI(grunn),
        )

        // Og motsatt vei: det grunnsettet hadde og valget ikke har, som
        // `hidden` på en feilmelding, skal også bort.
        const opp = document.createElement("div")
        lt.setAttributes(opp, grunn as Sett)
        lt.setAttributes(opp, paa as Sett)
        expect(navnPaa(opp), `${sti}, fra grunnsettet`).toEqual(navnI(paa))
        sjekket++
      }
    }

    expect(sjekket).toBeGreaterThan(0)
  })
})

describe("setAttributes lar det byggefunksjonen ikke forvalter, stå", () => {
  /** Elementet har attributtene fra før, og mister ingen av dem. */
  const TILFELLER: [string, Record<string, string>, () => unknown][] = [
    [
      "en deaktivert knapp og lt.button()",
      { type: "submit", disabled: "" },
      () => lt.button({ variant: "secondary" }),
    ],
    [
      "et deaktivert felt med hjelpetekst og lt.input()",
      { disabled: "", "aria-describedby": "hjelp", name: "epost" },
      () => lt.input({ state: "invalid" }),
    ],
    [
      "et åpent details og lt.accordion()",
      { open: "" },
      () => lt.accordion({ variant: "plain" }),
    ],
    [
      "et skjult avsnitt og lt.helpText()",
      { hidden: "" },
      () => lt.helpText({ variant: "warning" }),
    ],
    [
      "en deaktivert nedtrekksliste og lt.select()",
      { disabled: "" },
      () => lt.select(),
    ],
    [
      "et tekstområde koblet til en teller og lt.textarea()",
      { "aria-describedby": "teller" },
      () => lt.textarea(),
    ],
    [
      "en deaktivert avkryssingsboks og lt.checkbox()",
      { disabled: "", "aria-describedby": "feil" },
      () => lt.checkbox({ state: "invalid" }),
    ],
  ]

  it.each(TILFELLER)("%s", (_navn, fraFor, sett) => {
    const element = document.createElement("div")
    for (const [navn, verdi] of Object.entries(fraFor)) {
      element.setAttribute(navn, verdi)
    }

    lt.setAttributes(element, sett() as Parameters<typeof lt.setAttributes>[1])

    for (const navn of Object.keys(fraFor)) {
      expect(element.hasAttribute(navn), navn).toBe(true)
    }
  })

  it("rydder fortsatt det byggefunksjonen selv forvalter", () => {
    const bryter = document.createElement("input")
    lt.setAttributes(bryter, lt.switch({ disabled: true }))
    expect(bryter.hasAttribute("disabled")).toBe(true)
    lt.setAttributes(bryter, lt.switch())
    expect(bryter.hasAttribute("disabled"), "bryteren").toBe(false)

    const filfelt = document.createElement("input")
    lt.setAttributes(filfelt, lt.fileUpload({ multiple: true, accept: ".pdf" }))
    lt.setAttributes(filfelt, lt.fileUpload())
    expect(filfelt.hasAttribute("multiple"), "multiple").toBe(false)
    expect(filfelt.hasAttribute("accept"), "accept").toBe(false)

    const lenke = document.createElement("a")
    lt.setAttributes(lenke, lt.link({ disabled: true }))
    lt.setAttributes(lenke, lt.link())
    expect(lenke.hasAttribute("aria-disabled"), "lenken").toBe(false)
  })

  it("lar data-attributter et annet sett forvalter stå", () => {
    // Den felles lista over `data-*` gjaldt også sett rett fra en
    // byggefunksjon, og utløseren til et sprettoppvindu gjorde en
    // sekundærknapp primær.
    const knapp = document.createElement("button")
    lt.setAttributes(knapp, lt.button({ variant: "secondary" }))
    lt.setAttributes(knapp, lt.popover({ id: "p" }).trigger)
    expect(knapp.getAttribute("data-variant")).toBe("secondary")

    const dato = document.createElement("input")
    lt.setAttributes(dato, lt.input({ type: "date", state: "success" }))
    lt.setAttributes(dato, lt.field({ id: "d", help: true }).help)
    expect(dato.getAttribute("data-variant")).toBe("date")
    expect(dato.getAttribute("data-state")).toBe("success")
  })

  it("fjerner aldri id, heller ikke når byggefunksjonen har et valg for den", () => {
    const boks = document.createElement("lt-error-summary")
    boks.id = "skjemafeil"

    lt.setAttributes(boks, lt.errorSummary({ count: 2 }).host)

    expect(boks.id).toBe("skjemafeil")
  })

  it("lar byggefunksjonen eie attributtene den har et valg for", () => {
    // `lt.spinner()` har `label`. Skrev du `aria-label` for hånd og kaller
    // uten valget, er det byggefunksjonens ord som gjelder.
    const ring = document.createElement("span")
    lt.setAttributes(ring, lt.spinner({ label: "Laster" }))
    expect(ring.getAttribute("role")).toBe("status")

    lt.setAttributes(ring, lt.spinner())

    expect(ring.hasAttribute("role")).toBe(false)
    expect(ring.hasAttribute("aria-label")).toBe(false)
  })

  it("skjuler og viser feiloppsummeringen etter antallet", () => {
    const boks = document.createElement("lt-error-summary")
    lt.setAttributes(boks, lt.errorSummary({ count: 0 }).host)
    expect(boks.hasAttribute("hidden")).toBe(true)

    lt.setAttributes(boks, lt.errorSummary({ count: 2 }).host)
    expect(boks.hasAttribute("hidden")).toBe(false)
  })

  it("gjør ingenting uten et sett", () => {
    const felt = document.createElement("input")
    felt.setAttribute("data-state", "invalid")

    lt.setAttributes(felt)

    expect(felt.getAttribute("data-state")).toBe("invalid")
  })

  it("lar et håndskrevet sett ta bort et attributt med false, ikke med undefined", () => {
    const felt = document.createElement("input")
    lt.setAttributes(felt, lt.input({ state: "invalid" }), {
      "aria-invalid": undefined,
    })
    expect(felt.getAttribute("aria-invalid"), "undefined overstyrer ikke").toBe(
      "true",
    )

    lt.setAttributes(felt, lt.input({ state: "invalid" }), {
      "aria-invalid": false,
    })
    expect(felt.hasAttribute("aria-invalid"), "false fjerner").toBe(false)
  })

  it("rydder data-attributtene serveren skrev, når settet forvalter dem", () => {
    // Serveren skrev tilstanden, og nettleseren skal kunne ta den bort.
    const felt = document.createElement("input")
    felt.setAttribute("data-state", "invalid")

    lt.setAttributes(felt, lt.input())

    expect(felt.hasAttribute("data-state")).toBe(false)
  })
})

describe("setAttributes med flere sett", () => {
  it("setter begge, og rydder det begge forvalter", () => {
    const kontroll = document.createElement("input")
    const ugyldig = lt.field({ id: "epost", error: true, invalid: true })
    lt.setAttributes(kontroll, lt.input({ type: "email" }), ugyldig.control)
    expect(kontroll.getAttribute("aria-invalid")).toBe("true")
    expect(kontroll.className).toBe("lt-input")
    expect(kontroll.id).toBe("epost")

    const gyldig = lt.field({ id: "epost", error: true })
    lt.setAttributes(kontroll, lt.input({ type: "email" }), gyldig.control)

    expect(kontroll.hasAttribute("aria-invalid")).toBe(false)
    expect(kontroll.hasAttribute("aria-describedby")).toBe(false)
    expect(kontroll.id).toBe("epost")
  })

  it("sier fra én gang om et spredd sett, og rydder bare data-attributtene", async () => {
    /*
     * Advarselen kommer én gang per side, og flagget ligger i modulen. En
     * fersk utgave av modulen, hentet med et spørreledd, har sitt eget flagg.
     * Uten det brukte en annen test i fila opp advarselen, og denne var
     * grønn også om `console.warn` ble fjernet helt.
     */
    // @ts-expect-error Spørreleddet er Vites, og gir en fersk modul.
    const fersk = (await import("./dom?advarsel")) as typeof import("./dom")
    const advarsler: string[] = []
    const ekte = console.warn
    console.warn = (melding: unknown) => {
      advarsler.push(String(melding))
    }
    try {
      const kontroll = document.createElement("input")
      kontroll.setAttribute("disabled", "")

      fersk.setAttributes(kontroll, { ...lt.input({ state: "invalid" }) })
      fersk.setAttributes(kontroll, { ...lt.input() })

      expect(kontroll.hasAttribute("data-state"), "data-state").toBe(false)
      expect(kontroll.hasAttribute("disabled"), "disabled").toBe(true)
      expect(
        advarsler.filter((a) => a.includes("lt.setAttributes()")),
      ).toHaveLength(1)
    } finally {
      console.warn = ekte
    }
  })

  it("advarer ikke om et sett rett fra en byggefunksjon", async () => {
    // @ts-expect-error Spørreleddet er Vites, og gir en fersk modul.
    const fersk = (await import("./dom?stille")) as typeof import("./dom")
    const advarsler: string[] = []
    const ekte = console.warn
    console.warn = (melding: unknown) => {
      advarsler.push(String(melding))
    }
    try {
      const kontroll = document.createElement("input")
      fersk.setAttributes(kontroll, lt.input(), lt.field({ id: "a" }).control)
      expect(advarsler).toEqual([])
    } finally {
      console.warn = ekte
    }
  })
})

/**
 * `open` kommer fra `lt.dialog()`, men sveipen over byggefunksjonene hopper over
 * den, siden den krever et valgobjekt. Forvaltet ikke `lt.dialog()` `open`,
 * kunne `setAttributes` åpne en dialog, men aldri lukke den igjen, og det er
 * nøyaktig feilen `data-size` hadde.
 */
describe("setAttributes og dialogen", () => {
  it("kan både sette og fjerne open på verten", () => {
    const vert = document.createElement("lt-dialog")

    lt.setAttributes(vert, lt.dialog({ titleId: "t", open: true }).host)
    expect(vert.hasAttribute("open")).toBe(true)

    lt.setAttributes(vert, lt.dialog({ titleId: "t" }).host)
    expect(vert.hasAttribute("open")).toBe(false)
  })
})

describe("setAttributes og de boolske valgene", () => {
  it("fjerner de boolske valgene på kort, tabell og etikett", () => {
    const kort = document.createElement("a")
    lt.setAttributes(kort, lt.card({ interactive: true }))
    lt.setAttributes(kort, lt.card())
    expect(kort.hasAttribute("data-interactive")).toBe(false)

    const tabell = document.createElement("table")
    lt.setAttributes(tabell, lt.table({ hoverable: true }))
    lt.setAttributes(tabell, lt.table())
    expect(tabell.hasAttribute("data-hoverable")).toBe(false)

    const etikett = document.createElement("span")
    lt.setAttributes(etikett, lt.tag({ selectable: true }))
    lt.setAttributes(etikett, lt.tag())
    expect(etikett.hasAttribute("data-selectable")).toBe(false)
  })

  it("lar id, name og role stå når to ulike sett brukes etter hverandre", () => {
    // Ledetekstens `for` peker på id-en. Ryddet det andre kallet den bort,
    // var koblingen brutt uten at noe sa fra. Det samme gjelder rollen et
    // forslagsfelt har fått.
    const kontroll = document.createElement("input")
    const felt = lt.field({ id: "epost" })
    lt.setAttributes(kontroll, {
      ...lt.input(),
      ...felt.control,
      name: "epost",
    })

    lt.setAttributes(kontroll, lt.input({ state: "invalid" }))

    expect(kontroll.id).toBe("epost")
    expect(kontroll.getAttribute("name")).toBe("epost")

    const sok = document.createElement("input")
    lt.setAttributes(
      sok,
      lt.suggestion({ id: "by", keys: ["a", "b", "c"] }).control,
    )
    lt.setAttributes(sok, lt.input({ state: "invalid" }))
    expect(sok.getAttribute("role")).toBe("combobox")
  })

  it("lar type stå på en knapp", () => {
    // `type` sto i lista over det som ryddes, og `lt.button()` skriver den
    // aldri: knappen mistet `type="submit"` uten at noe sa fra.
    const knapp = document.createElement("button")
    knapp.setAttribute("type", "submit")

    lt.setAttributes(knapp, lt.button({ variant: "secondary" }))

    expect(knapp.getAttribute("type")).toBe("submit")
  })

  it("fjerner placement når sprettoppvinduet går tilbake til standard", () => {
    const vert = document.createElement("lt-popover")
    lt.setAttributes(vert, lt.popover({ id: "p", placement: "top-end" }).host)
    expect(vert.getAttribute("placement")).toBe("top-end")

    lt.setAttributes(vert, lt.popover({ id: "p" }).host)

    expect(vert.hasAttribute("placement")).toBe(false)
  })
})
