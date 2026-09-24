import { beforeEach, describe, expect, it } from "vitest"

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

    // Byggeren utelater data-state i normaltilstand. Uten oppryddingen
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
    fs.setAttributes(kontroll, {
      ...fs.input({ type: "email" }),
      ...felt.control,
    })

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

    fs.setAttributes(element, {
      ...fs.input({ type: "email" }),
      ...field.control,
    })

    expect(element.disabled).toBe(true)
    expect(element.id).toBe("epost")
    expect(element.type).toBe("email")
  })
})

/**
 * At hvert valgfritt attributt en byggefunksjon kan sende ut, også kan
 * fjernes igjen.
 *
 * `setAttributes` rydder bare i en lukket liste, og den lista er håndskrevet.
 * `data-picker` kom til med nedtrekkslista som tegnes i siden, og `data-size` hadde
 * stått utenfor lenge: begge lot seg sette, men ikke fjerne. Et felt gikk
 * altså aldri tilbake til standardutseendet sitt uten at noen skrev
 * `removeAttribute` selv.
 *
 * Testen kaller hver byggefunksjon med hver lovlige verdi den selv oppgir, og
 * regner et attributt som valgfritt når det ikke er med i kallet uten
 * argumenter. Nettopp de må lista dekke.
 */
describe("setAttributes rydder i alt byggefunksjonene kan sette", () => {
  /** `fs.label({ required: "symbol" })` henger på `label.markers`. */
  const NOKKEL: Record<string, string> = { markers: "required" }

  function attributtnavn(verdi: unknown, ut = new Set<string>()): Set<string> {
    if (!verdi || typeof verdi !== "object") return ut
    for (const [navn, under] of Object.entries(verdi)) {
      if (under && typeof under === "object") attributtnavn(under, ut)
      else ut.add(navn)
    }
    return ut
  }

  /** Attributtene som kommer av et valg, og derfor kan utebli. */
  function valgfrieNavn(): string[] {
    const valgfrie = new Set<string>()

    for (const bygger of Object.values(fs)) {
      if (typeof bygger !== "function") continue

      let alltid: Set<string>
      try {
        alltid = attributtnavn((bygger as (valg?: unknown) => unknown)())
      } catch {
        // Vakter og hjelpefunksjoner sender ikke ut attributter.
        continue
      }

      for (const [liste, verdier] of Object.entries(bygger)) {
        if (!Array.isArray(verdier)) continue
        const nokkel = NOKKEL[liste] ?? liste.replace(/s$/, "")

        for (const verdi of verdier as string[]) {
          const ut = attributtnavn(
            (bygger as (valg?: unknown) => unknown)({ [nokkel]: verdi }),
          )
          for (const navn of ut) if (!alltid.has(navn)) valgfrie.add(navn)
        }
      }
    }

    return [...valgfrie].sort()
  }

  it("finner noe å sjekke", () => {
    // Uten dette kunne et navnebytte på listene gjort testen tom og grønn.
    expect(valgfrieNavn().length).toBeGreaterThan(4)
  })

  it.each(valgfrieNavn())("%s kan fjernes igjen", (navn) => {
    const element = document.createElement("div")
    element.setAttribute(navn, "noe")

    fs.setAttributes(element, { class: "fs-noe" })

    expect(element.hasAttribute(navn)).toBe(false)
  })
})

/**
 * `open` kommer fra `fs.dialog()`, men sveipen over byggerne hopper over
 * den, siden den krever et valgobjekt. Uten `open` i `SYSTEM_ATTRIBUTES`
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
