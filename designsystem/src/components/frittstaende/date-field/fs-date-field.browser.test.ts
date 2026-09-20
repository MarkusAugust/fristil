import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsDateField } from "./fs-date-field"
import "../../../tokens/tokens.css"
import "./date-field.css"

describe("fs-date-field", () => {
  beforeAll(() => {
    defineFsDateField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("gives the icon button a large enough target", async () => {
    document.body.innerHTML = `<fs-date-field label="Fødselsdato"></fs-date-field>`

    await Promise.resolve()
    await ventPaTegning()

    const button = document.querySelector(
      ".fs-date-field__icon-btn",
    ) as HTMLElement
    const rect = button.getBoundingClientRect()

    // WCAG 2.2 krever 24 piksler i begge retninger. Knappen var 16 fordi
    // reserven pekte på --size-7, som ikke fantes, og hele regelen ble ugyldig.
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
  })

  it("renders input and calendar together", async () => {
    document.body.innerHTML = `<fs-date-field label="Fødselsdato"></fs-date-field>`

    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const calendar = el.querySelector("fs-calendar") as HTMLElement

    expect(input).toBeTruthy()
    expect(calendar).toBeTruthy()
    expect(input.getAttribute("data-variant")).toBeNull()
    expect(input.type).toBe("text")
  })

  it("updates input value when date is selected from calendar popup", async () => {
    document.body.innerHTML = `<fs-date-field value="2026-05-31"></fs-date-field>`

    await Promise.resolve()
    await customElements.whenDefined("fs-calendar")
    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const calendar = el.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
    }

    const trigger = calendar.shadowRoot.querySelector(
      ".trigger",
    ) as HTMLButtonElement
    trigger.click()
    await Promise.resolve()

    const day = calendar.shadowRoot.querySelector(
      '.day[data-date="2026-05-15"]',
    ) as HTMLButtonElement
    day.click()
    await Promise.resolve()

    expect(input.value).toBe("15-05-2026")
  })

  it("applies invalid state and toggles error visibility", async () => {
    document.body.innerHTML = `<fs-date-field invalid error-text="Skriv en gyldig dato"></fs-date-field>`

    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const error = el.querySelector(".fs-error-text") as HTMLElement

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)

    el.removeAttribute("invalid")
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBeNull()
    expect(error.hidden).toBe(true)
  })

  it("shows error feedback when the user leaves an invalid typed date", async () => {
    document.body.innerHTML = `<fs-date-field error-text="Skriv en gyldig dato"></fs-date-field>`

    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const error = el.querySelector(".fs-error-text") as HTMLElement

    input.value = "32-06-2026"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new FocusEvent("blur"))
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)
  })
})

describe("fs-date-field tilgjengelighet", () => {
  it("gir ingen brudd med hjelpetekst og feilmelding", async () => {
    monter(`
      <fs-date-field
        label="Reisedato"
        value="2026-05-31"
        help-text="Skriv datoen som DD-MM-ÅÅÅÅ, eller velg den i kalenderen."
        error-text="Skriv en dato som finnes."
        invalid
      ></fs-date-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })

  it("flytter fokus til inputfeltet når en dato velges i kalenderen", async () => {
    const flate = monter(
      `<fs-date-field label="Reisedato" value="2026-05-31"></fs-date-field>`,
    )
    await ventPaTegning()

    const felt = flate.querySelector("fs-date-field") as HTMLElement
    const input = felt.querySelector("input") as HTMLInputElement
    const kalender = felt.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
    }

    kalender.shadowRoot.querySelector<HTMLButtonElement>(".trigger")?.click()
    await ventPaTegning()

    kalender.shadowRoot
      .querySelector<HTMLButtonElement>('.day[data-selected="true"]')
      ?.click()
    await ventPaTegning()

    expect(document.activeElement).toBe(input)
  })
})

/**
 * Tilgjengelighetskontrakten, altså koblingen mellom ledetekst, felt,
 * hjelpetekst og feilmelding.
 *
 * Komponenten hadde lenge sin egen utgave av denne logikken, ved siden av
 * `computeFieldAttributes`, og ingen test dekket den. Da kan de to gå fra
 * hverandre uten at noe sier fra. Disse testene holder dem sammen.
 */
describe("fs-date-field: kobling og tilstand", () => {
  beforeAll(() => {
    defineFsDateField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  async function lagFelt(attributter: string) {
    document.body.innerHTML = `<fs-date-field ${attributter}></fs-date-field>`
    const felt = document.querySelector("fs-date-field") as HTMLElement
    await ventPaTegning(felt)
    return {
      felt,
      ledetekst: felt.querySelector("label") as HTMLLabelElement,
      input: felt.querySelector("input.fs-input") as HTMLInputElement,
    }
  }

  it("kobler ledeteksten til feltet", async () => {
    const { ledetekst, input } = await lagFelt('label="Fødselsdato"')

    expect(ledetekst.getAttribute("for")).toBe(input.id)
    expect(input.id).toBeTruthy()
  })

  it("peker på hjelpeteksten, og på feilmeldingen først når feltet er ugyldig", async () => {
    const { felt, input } = await lagFelt(
      'label="Fødselsdato" help-text="Skriv DD-MM-ÅÅÅÅ." error-text="Skriv en dato som finnes."',
    )
    const hjelp = felt.querySelector(".fs-help-text") as HTMLElement
    const feil = felt.querySelector(".fs-error-text") as HTMLElement

    expect(input.getAttribute("aria-describedby")).toBe(hjelp.id)

    felt.setAttribute("invalid", "")
    await ventPaTegning(felt)

    // Feilmeldingen tas med først nå. Ellers ville skjermleseren pekt på et
    // skjult element.
    expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([
      hjelp.id,
      feil.id,
    ])
  })

  it("tar med konsumentens egne id-er uten å gjenta noen", async () => {
    const { input } = await lagFelt(
      'label="Fødselsdato" help-text="Hjelp." described-by="min-tekst min-tekst"',
    )

    const ider = input.getAttribute("aria-describedby")?.split(" ") ?? []
    expect(ider).toContain("min-tekst")
    expect(ider.filter((id) => id === "min-tekst")).toHaveLength(1)
  })

  it("markerer ledeteksten som påkrevd eller valgfri", async () => {
    const påkrevd = await lagFelt('label="Fødselsdato" required')
    expect(påkrevd.ledetekst.getAttribute("data-required")).toBe("symbol")
    expect(påkrevd.ledetekst.hasAttribute("data-optional")).toBe(false)

    const valgfri = await lagFelt('label="Fødselsdato" optional')
    expect(valgfri.ledetekst.getAttribute("data-optional")).toBe("")
    expect(valgfri.ledetekst.hasAttribute("data-required")).toBe(false)
  })

  it("melder ledeteksten som av når feltet er av", async () => {
    const { ledetekst } = await lagFelt('label="Fødselsdato" disabled')

    expect(ledetekst.getAttribute("aria-disabled")).toBe("true")
  })

  it("lytter fortsatt på kalenderen etter at komponenten er tegnet på nytt", async () => {
    // Lytteren ble tidligere fjernet og lagt på igjen ved hver oppdatering,
    // av frykt for å miste den. Nå står den i malen, og Lit holder på den.
    const { felt, input } = await lagFelt('label="Fødselsdato"')

    felt.setAttribute("help-text", "En ny hjelpetekst")
    await ventPaTegning(felt)

    const kalender = felt.querySelector("fs-calendar") as HTMLElement
    kalender.dispatchEvent(
      new CustomEvent("date-select", {
        detail: { value: "2026-05-15" },
        bubbles: true,
      }),
    )
    await ventPaTegning(felt)

    expect(felt.getAttribute("value")).toBe("2026-05-15")
    expect(input.value).toBe("15-05-2026")
  })

  it("lar det brukeren har skrevet stå når komponenten tegnes på nytt", async () => {
    const { felt, input } = await lagFelt('label="Fødselsdato"')

    // Brukeren skriver halve datoen
    input.focus()
    input.value = "01-01-20"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning(felt)

    felt.setAttribute("help-text", "En ny hjelpetekst")
    await ventPaTegning(felt)

    // Halvskrevet tekst er ikke en gyldig dato, så this.value står stille.
    // Malen må likevel ikke overskrive det som står i feltet.
    expect(input.value).toBe("01-01-20")
  })

  it("setter feltet tilbake når verdien settes utenfra på nytt", async () => {
    // Motstykket til testen over: står ikke brukeren i feltet, skal
    // visningen følge `value`, også når `value` settes til det samme igjen.
    const { felt, input } = await lagFelt(
      'label="Fødselsdato" value="2026-05-31"',
    )
    expect(input.value).toBe("31-05-2026")

    input.value = "rot"
    felt.setAttribute("value", "2026-05-31")
    felt.setAttribute("help-text", "En ny hjelpetekst")
    await ventPaTegning(felt)

    expect(input.value).toBe("31-05-2026")
  })
})
