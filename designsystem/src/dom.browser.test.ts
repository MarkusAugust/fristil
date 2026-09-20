import { beforeEach, describe, expect, it } from "vitest"

import { fs } from "./fs"

describe("fs.setAttributes", () => {
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
