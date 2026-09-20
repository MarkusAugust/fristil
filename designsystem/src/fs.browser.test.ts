import { describe, expect, it } from "vitest"

import { fs } from "./fs"

describe("fs — felles form", () => {
  it("gir samme form for alle komponentene: valgobjekt inn, attributter ut", () => {
    expect(fs.button()).toEqual({ class: "fs-button" })
    expect(fs.badge()).toEqual({ class: "fs-badge" })
    expect(fs.link()).toEqual({ class: "fs-link" })
    expect(fs.label()).toEqual({ class: "fs-label" })
    expect(fs.textarea()).toEqual({ class: "fs-textarea" })
    expect(fs.select()).toEqual({ class: "fs-select" })
    expect(fs.helpText()).toEqual({ class: "fs-help-text" })
    expect(fs.errorText()).toEqual({ class: "fs-error-text" })
  })

  it("utelater attributtet når verdien er standardverdien", () => {
    expect(fs.button({ variant: "primary" })).toEqual({ class: "fs-button" })
    expect(fs.button({ variant: "danger" })).toEqual({
      class: "fs-button",
      "data-variant": "danger",
    })
  })

  it("eksponerer lovlige verdier og en vakt på hver komponent", () => {
    expect(fs.button.variants).toContain("ghost")
    expect(fs.button.isVariant("ghost")).toBe(true)
    expect(fs.button.isVariant("gost")).toBe(false)

    expect(fs.badge.colors).toContain("neutral")
    expect(fs.badge.isColor("neutral")).toBe(true)
  })
})

describe("fs.input", () => {
  it("setter type og ikonvariant fra samme verdi", () => {
    // Den vanligste feilen med håndskrevet markup er at data-variant og
    // type kommer i utakt. Her er det umulig.
    expect(fs.input({ type: "date" })).toEqual({
      class: "fs-input",
      type: "date",
      "data-variant": "date",
    })
  })

  it("gir ikke ikonvariant til typer som ikke har et ikon", () => {
    expect(fs.input({ type: "email" })).toEqual({
      class: "fs-input",
      type: "email",
    })
  })

  it("setter aria-invalid sammen med data-state", () => {
    expect(fs.input({ state: "invalid" })).toEqual({
      class: "fs-input",
      type: "text",
      "data-state": "invalid",
      "aria-invalid": "true",
    })

    expect(fs.input({ state: "success" })).toEqual({
      class: "fs-input",
      type: "text",
      "data-state": "success",
    })
  })

  it("deler tilstandstype med textarea og select", () => {
    const tilstand = fs.isState("invalid") ? "invalid" : "default"
    expect(fs.input({ state: tilstand })["data-state"]).toBe("invalid")
    expect(fs.textarea({ state: tilstand })["data-state"]).toBe("invalid")
    expect(fs.select({ state: tilstand })["data-state"]).toBe("invalid")
  })
})

describe("fs.label", () => {
  it("lar required vinne over optional, så bare én markering vises", () => {
    expect(fs.label({ required: "text", optional: true })).toEqual({
      class: "fs-label",
      "data-required": "text",
    })
  })
})

describe("fs.field", () => {
  it("kobler ledetekst og kontroll", () => {
    const felt = fs.field({ id: "epost" })

    expect(felt.label.for).toBe("epost")
    expect(felt.control.id).toBe("epost")
  })

  it("tar hjelpeteksten med i aria-describedby", () => {
    const felt = fs.field({ id: "epost", help: true })

    expect(felt.control["aria-describedby"]).toBe("epost-help")
    expect(felt.help.id).toBe("epost-help")
  })

  it("tar feilmeldingen med bare når feltet er ugyldig", () => {
    const gyldig = fs.field({ id: "epost", help: true, error: true })
    const ugyldig = fs.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })

    // En skjult feilmelding skal ikke stå i aria-describedby. Da ville
    // skjermleseren pekt på noe som ikke finnes på skjermen.
    expect(gyldig.control["aria-describedby"]).toBe("epost-help")
    expect(gyldig.error.hidden).toBe(true)
    expect(gyldig.control["aria-invalid"]).toBeUndefined()

    expect(ugyldig.control["aria-describedby"]).toBe("epost-help epost-error")
    expect(ugyldig.error.hidden).toBeUndefined()
    expect(ugyldig.control["aria-invalid"]).toBe("true")
  })

  it("gir en tilstand som kan sendes rett inn i input()", () => {
    const felt = fs.field({ id: "epost", invalid: true })

    expect(fs.input({ type: "email", state: felt.state })).toEqual({
      class: "fs-input",
      type: "email",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
  })

  it("tar med ekstra id-er kalleren oppgir", () => {
    const felt = fs.field({
      id: "epost",
      help: true,
      describedBy: ["vilkaar"],
    })

    expect(felt.control["aria-describedby"]).toBe("epost-help vilkaar")
  })

  it("lager en unik id når den ikke oppgis", () => {
    expect(fs.field().control.id).not.toBe(fs.field().control.id)
  })
})

describe("fs.field sammen med feltfunksjonene", () => {
  it("overlapper ikke med input(), så attributter ikke settes dobbelt", () => {
    const felt = fs.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })
    const input = fs.input({ type: "email" })

    const felles = Object.keys(input).filter((navn) => navn in felt.control)

    // I JSX overskriver den siste spredningen den første, men i maler som
    // skriver ut attributtene bokstavelig — Astro, ren HTML — blir de
    // stående dobbelt. Da er markupen ugyldig.
    expect(felles, "Disse settes av begge").toEqual([])
  })

  it("lar control bære både tilstandsfargen og aria-invalid", () => {
    const felt = fs.field({ id: "epost", invalid: true })

    expect(felt.control["data-state"]).toBe("invalid")
    expect(felt.control["aria-invalid"]).toBe("true")
  })

  it("setter ingen av dem når feltet er gyldig", () => {
    const felt = fs.field({ id: "epost" })

    expect(felt.control["data-state"]).toBeUndefined()
    expect(felt.control["aria-invalid"]).toBeUndefined()
  })
})
