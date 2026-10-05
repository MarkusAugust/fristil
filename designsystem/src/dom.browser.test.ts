import { beforeEach, describe, expect, it } from "vitest"

import { managedNames } from "./components/css/shared"
import { fs } from "./fs"

describe("fs.setAttributes", () => {
  it("gjør ingenting når elementet er borte", () => {
    /*
     * `document.querySelector()` gir `Element | null`, og uten dette måtte
     * hvert kallsted i en `strict`-app skrive en vakt rundt et oppslag som
     * nesten alltid treffer. Den skal ikke kaste, og den skal ikke gjøre noe.
     */
    expect(() => fs.setAttributes(null, fs.button())).not.toThrow()
    expect(() => fs.setAttributes(undefined, fs.button())).not.toThrow()
  })

  let element: HTMLInputElement

  beforeEach(() => {
    document.body.innerHTML = '<input id="felt" />'
    element = document.getElementById("felt") as HTMLInputElement
  })

  it("bruker attributtene fra en fs-funksjon", () => {
    fs.setAttributes(element, fs.input({ type: "email", state: "invalid" }))

    expect(element.className).toBe("fs-input")
    expect(element.getAttribute("type")).toBe("email")
    expect(element.getAttribute("data-state")).toBe("invalid")
    expect(element.getAttribute("aria-invalid")).toBe("true")
  })

  it("rydder bort tilstand fra forrige kall", () => {
    fs.setAttributes(element, fs.input({ type: "email", state: "invalid" }))
    fs.setAttributes(element, fs.input({ type: "email" }))

    // Byggefunksjonen utelater data-state i normaltilstand. Uten oppryddingen
    // ville feltet blitt stående rødt etter at feilen var rettet.
    expect(element.hasAttribute("data-state")).toBe(false)
    expect(element.hasAttribute("aria-invalid")).toBe(false)
    expect(element.getAttribute("type")).toBe("email")
  })

  it("lar konsumentens egne attributter være i fred", () => {
    element.setAttribute("data-testid", "epostfelt")
    element.setAttribute("name", "epost")

    fs.setAttributes(element, fs.input({ type: "email", state: "invalid" }))
    fs.setAttributes(element, fs.input({ type: "email" }))

    expect(element.getAttribute("data-testid")).toBe("epostfelt")
    expect(element.getAttribute("name")).toBe("epost")
  })

  it("beholder konsumentens egne klasser", () => {
    element.className = "min-klasse fs-gammel"

    fs.setAttributes(element, fs.input({ type: "text" }))

    expect(element.classList.contains("min-klasse")).toBe(true)
    expect(element.classList.contains("fs-input")).toBe(true)
    // fs-klasser eies av systemet og byttes ut
    expect(element.classList.contains("fs-gammel")).toBe(false)
  })

  it("virker på et helt felt sammen med fs.field", () => {
    document.body.innerHTML = `
      <label id="ledetekst"></label>
      <input id="kontroll" />
      <p id="feil"></p>
    `
    const felt = fs.field({ id: "epost", error: true, invalid: true })

    // Hentes før, siden felt.control setter id-en på kontrollen
    const ledetekst = document.getElementById("ledetekst") as HTMLLabelElement
    const kontroll = document.getElementById("kontroll") as HTMLInputElement

    fs.setAttributes(ledetekst, felt.label)
    fs.setAttributes(kontroll, fs.input({ type: "email" }), felt.control)

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

    fs.setAttributes(element, fs.switch({ disabled: true }))

    expect(element.getAttribute("disabled")).toBe("")
    expect(element.disabled).toBe(true)
    expect(element.getAttribute("role")).toBe("switch")
  })

  it("fjerner det boolske attributtet når det ikke er med lenger", () => {
    const element = document.createElement("input")

    fs.setAttributes(element, fs.switch({ disabled: true }))
    fs.setAttributes(element, fs.switch())

    expect(element.hasAttribute("disabled")).toBe(false)
  })

  it("tar imot attributtene fra et helt felt", () => {
    const element = document.createElement("input")
    const field = fs.field({ id: "epost", disabled: true })

    fs.setAttributes(element, fs.input({ type: "email" }), field.control)

    expect(element.disabled).toBe(true)
    expect(element.id).toBe("epost")
    expect(element.type).toBe("email")
  })
})

/** Valg som gir de sammensatte byggefunksjonene noe å bygge. */
const GRUNNVALG: Record<string, Record<string, unknown>> = {
  field: { id: "felt", help: true, error: true },
  tabs: { id: "faner", count: 2 },
  suggestion: { id: "forslag", count: 2 },
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

/** `fs.label({ required: "symbol" })` henger på `label.markers`. */
const NOKKEL: Record<string, string> = { markers: "required" }

type Byggefunksjon = ((valg?: unknown) => unknown) & Record<string, unknown>

function byggefunksjonene(): [string, Byggefunksjon][] {
  return Object.entries(fs).filter(([navn, verdi]) => {
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

  it.each(alle)("fs.%s() sender hvert sett gjennom attributes()", (navn, f) => {
    const sett = settene(f(GRUNNVALG[navn] ?? {}), navn)

    expect(sett.length).toBeGreaterThan(0)
    for (const [sti, ett] of sett) {
      expect(managedNames(ett), sti).toBeDefined()
    }
  })

  it.each(
    alle,
  )("fs.%s() forvalter de samme navnene uansett valg", (navn, f) => {
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
  )("fs.%s() kan gå mellom hvert valgsett og grunnsettet, begge veier", (navn, f) => {
    type Sett = Parameters<typeof fs.setAttributes>[1]
    const av = new Map(settene(f(GRUNNVALG[navn] ?? {}), navn))
    let sjekket = 0

    for (const valg of valgsettene(navn, f)) {
      for (const [sti, paa] of settene(f(valg), navn)) {
        const grunn = av.get(sti)
        if (!grunn) continue

        // Fra valgene og tilbake: alt valget satte, skal bort.
        const ned = document.createElement("div")
        fs.setAttributes(ned, paa as Sett)
        fs.setAttributes(ned, grunn as Sett)
        expect(navnPaa(ned), `${sti}, tilbake til grunnsettet`).toEqual(
          navnI(grunn),
        )

        // Og motsatt vei: det grunnsettet hadde og valget ikke har, som
        // `hidden` på en feilmelding, skal også bort.
        const opp = document.createElement("div")
        fs.setAttributes(opp, grunn as Sett)
        fs.setAttributes(opp, paa as Sett)
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
      "en deaktivert knapp og fs.button()",
      { type: "submit", disabled: "" },
      () => fs.button({ variant: "secondary" }),
    ],
    [
      "et deaktivert felt med hjelpetekst og fs.input()",
      { disabled: "", "aria-describedby": "hjelp", name: "epost" },
      () => fs.input({ state: "invalid" }),
    ],
    [
      "et åpent details og fs.accordion()",
      { open: "" },
      () => fs.accordion({ variant: "plain" }),
    ],
    [
      "et skjult avsnitt og fs.helpText()",
      { hidden: "" },
      () => fs.helpText({ variant: "warning" }),
    ],
    [
      "en deaktivert nedtrekksliste og fs.select()",
      { disabled: "" },
      () => fs.select(),
    ],
    [
      "et tekstområde koblet til en teller og fs.textarea()",
      { "aria-describedby": "teller" },
      () => fs.textarea(),
    ],
    [
      "en deaktivert avkryssingsboks og fs.checkbox()",
      { disabled: "", "aria-describedby": "feil" },
      () => fs.checkbox({ state: "invalid" }),
    ],
  ]

  it.each(TILFELLER)("%s", (_navn, fraFor, sett) => {
    const element = document.createElement("div")
    for (const [navn, verdi] of Object.entries(fraFor)) {
      element.setAttribute(navn, verdi)
    }

    fs.setAttributes(element, sett() as Parameters<typeof fs.setAttributes>[1])

    for (const navn of Object.keys(fraFor)) {
      expect(element.hasAttribute(navn), navn).toBe(true)
    }
  })

  it("rydder fortsatt det byggefunksjonen selv forvalter", () => {
    const bryter = document.createElement("input")
    fs.setAttributes(bryter, fs.switch({ disabled: true }))
    expect(bryter.hasAttribute("disabled")).toBe(true)
    fs.setAttributes(bryter, fs.switch())
    expect(bryter.hasAttribute("disabled"), "bryteren").toBe(false)

    const filfelt = document.createElement("input")
    fs.setAttributes(filfelt, fs.fileUpload({ multiple: true, accept: ".pdf" }))
    fs.setAttributes(filfelt, fs.fileUpload())
    expect(filfelt.hasAttribute("multiple"), "multiple").toBe(false)
    expect(filfelt.hasAttribute("accept"), "accept").toBe(false)

    const lenke = document.createElement("a")
    fs.setAttributes(lenke, fs.link({ disabled: true }))
    fs.setAttributes(lenke, fs.link())
    expect(lenke.hasAttribute("aria-disabled"), "lenken").toBe(false)
  })

  it("lar data-attributter et annet sett forvalter stå", () => {
    // Den felles lista over `data-*` gjaldt også sett rett fra en
    // byggefunksjon, og utløseren til et sprettoppvindu gjorde en
    // sekundærknapp primær.
    const knapp = document.createElement("button")
    fs.setAttributes(knapp, fs.button({ variant: "secondary" }))
    fs.setAttributes(knapp, fs.popover({ id: "p" }).trigger)
    expect(knapp.getAttribute("data-variant")).toBe("secondary")

    const dato = document.createElement("input")
    fs.setAttributes(dato, fs.input({ type: "date", state: "success" }))
    fs.setAttributes(dato, fs.field({ id: "d", help: true }).help)
    expect(dato.getAttribute("data-variant")).toBe("date")
    expect(dato.getAttribute("data-state")).toBe("success")
  })

  it("fjerner aldri id, heller ikke når byggefunksjonen har et valg for den", () => {
    const boks = document.createElement("fs-error-summary")
    boks.id = "skjemafeil"

    fs.setAttributes(boks, fs.errorSummary({ count: 2 }).host)

    expect(boks.id).toBe("skjemafeil")
  })

  it("lar byggefunksjonen eie attributtene den har et valg for", () => {
    // `fs.spinner()` har `label`. Skrev du `aria-label` for hånd og kaller
    // uten valget, er det byggefunksjonens ord som gjelder.
    const ring = document.createElement("span")
    fs.setAttributes(ring, fs.spinner({ label: "Laster" }))
    expect(ring.getAttribute("role")).toBe("status")

    fs.setAttributes(ring, fs.spinner())

    expect(ring.hasAttribute("role")).toBe(false)
    expect(ring.hasAttribute("aria-label")).toBe(false)
  })

  it("skjuler og viser feiloppsummeringen etter antallet", () => {
    const boks = document.createElement("fs-error-summary")
    fs.setAttributes(boks, fs.errorSummary({ count: 0 }).host)
    expect(boks.hasAttribute("hidden")).toBe(true)

    fs.setAttributes(boks, fs.errorSummary({ count: 2 }).host)
    expect(boks.hasAttribute("hidden")).toBe(false)
  })

  it("gjør ingenting uten et sett", () => {
    const felt = document.createElement("input")
    felt.setAttribute("data-state", "invalid")

    fs.setAttributes(felt)

    expect(felt.getAttribute("data-state")).toBe("invalid")
  })

  it("lar et håndskrevet sett ta bort et attributt med false, ikke med undefined", () => {
    const felt = document.createElement("input")
    fs.setAttributes(felt, fs.input({ state: "invalid" }), {
      "aria-invalid": undefined,
    })
    expect(felt.getAttribute("aria-invalid"), "undefined overstyrer ikke").toBe(
      "true",
    )

    fs.setAttributes(felt, fs.input({ state: "invalid" }), {
      "aria-invalid": false,
    })
    expect(felt.hasAttribute("aria-invalid"), "false fjerner").toBe(false)
  })

  it("rydder data-attributtene serveren skrev, når settet forvalter dem", () => {
    // Serveren skrev tilstanden, og nettleseren skal kunne ta den bort.
    const felt = document.createElement("input")
    felt.setAttribute("data-state", "invalid")

    fs.setAttributes(felt, fs.input())

    expect(felt.hasAttribute("data-state")).toBe(false)
  })
})

describe("setAttributes med flere sett", () => {
  it("setter begge, og rydder det begge forvalter", () => {
    const kontroll = document.createElement("input")
    const ugyldig = fs.field({ id: "epost", error: true, invalid: true })
    fs.setAttributes(kontroll, fs.input({ type: "email" }), ugyldig.control)
    expect(kontroll.getAttribute("aria-invalid")).toBe("true")
    expect(kontroll.className).toBe("fs-input")
    expect(kontroll.id).toBe("epost")

    const gyldig = fs.field({ id: "epost", error: true })
    fs.setAttributes(kontroll, fs.input({ type: "email" }), gyldig.control)

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

      fersk.setAttributes(kontroll, { ...fs.input({ state: "invalid" }) })
      fersk.setAttributes(kontroll, { ...fs.input() })

      expect(kontroll.hasAttribute("data-state"), "data-state").toBe(false)
      expect(kontroll.hasAttribute("disabled"), "disabled").toBe(true)
      expect(
        advarsler.filter((a) => a.includes("fs.setAttributes()")),
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
      fersk.setAttributes(kontroll, fs.input(), fs.field({ id: "a" }).control)
      expect(advarsler).toEqual([])
    } finally {
      console.warn = ekte
    }
  })
})

/**
 * `open` kommer fra `fs.dialog()`, men sveipen over byggefunksjonene hopper over
 * den, siden den krever et valgobjekt. Forvaltet ikke `fs.dialog()` `open`,
 * kunne `setAttributes` åpne en dialog, men aldri lukke den igjen, og det er
 * nøyaktig feilen `data-size` hadde.
 */
describe("setAttributes og dialogen", () => {
  it("kan både sette og fjerne open på verten", () => {
    const vert = document.createElement("fs-dialog")

    fs.setAttributes(vert, fs.dialog({ titleId: "t", open: true }).host)
    expect(vert.hasAttribute("open")).toBe(true)

    fs.setAttributes(vert, fs.dialog({ titleId: "t" }).host)
    expect(vert.hasAttribute("open")).toBe(false)
  })
})

describe("setAttributes og de boolske valgene", () => {
  it("fjerner de boolske valgene på kort, tabell og etikett", () => {
    const kort = document.createElement("a")
    fs.setAttributes(kort, fs.card({ interactive: true }))
    fs.setAttributes(kort, fs.card())
    expect(kort.hasAttribute("data-interactive")).toBe(false)

    const tabell = document.createElement("table")
    fs.setAttributes(tabell, fs.table({ hoverable: true }))
    fs.setAttributes(tabell, fs.table())
    expect(tabell.hasAttribute("data-hoverable")).toBe(false)

    const etikett = document.createElement("span")
    fs.setAttributes(etikett, fs.tag({ selectable: true }))
    fs.setAttributes(etikett, fs.tag())
    expect(etikett.hasAttribute("data-selectable")).toBe(false)
  })

  it("lar id, name og role stå når to ulike sett brukes etter hverandre", () => {
    // Ledetekstens `for` peker på id-en. Ryddet det andre kallet den bort,
    // var koblingen brutt uten at noe sa fra. Det samme gjelder rollen et
    // forslagsfelt har fått.
    const kontroll = document.createElement("input")
    const felt = fs.field({ id: "epost" })
    fs.setAttributes(kontroll, {
      ...fs.input(),
      ...felt.control,
      name: "epost",
    })

    fs.setAttributes(kontroll, fs.input({ state: "invalid" }))

    expect(kontroll.id).toBe("epost")
    expect(kontroll.getAttribute("name")).toBe("epost")

    const sok = document.createElement("input")
    fs.setAttributes(sok, fs.suggestion({ id: "by", count: 3 }).control)
    fs.setAttributes(sok, fs.input({ state: "invalid" }))
    expect(sok.getAttribute("role")).toBe("combobox")
  })

  it("lar type stå på en knapp", () => {
    // `type` sto i lista over det som ryddes, og `fs.button()` skriver den
    // aldri: knappen mistet `type="submit"` uten at noe sa fra.
    const knapp = document.createElement("button")
    knapp.setAttribute("type", "submit")

    fs.setAttributes(knapp, fs.button({ variant: "secondary" }))

    expect(knapp.getAttribute("type")).toBe("submit")
  })

  it("fjerner placement når sprettoppvinduet går tilbake til standard", () => {
    const vert = document.createElement("fs-popover")
    fs.setAttributes(vert, fs.popover({ id: "p", placement: "top-end" }).host)
    expect(vert.getAttribute("placement")).toBe("top-end")

    fs.setAttributes(vert, fs.popover({ id: "p" }).host)

    expect(vert.hasAttribute("placement")).toBe(false)
  })
})
