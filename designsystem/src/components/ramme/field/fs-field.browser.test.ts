/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsField } from "./fs-field"
import "../../../tokens/tokens.css"
import "./field.css"

describe("fs-field", () => {
  beforeAll(() => {
    defineFsField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("wires label[for] to the control id", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label id="label">E-post</label>
        <input id="email" class="fs-input" type="email" />
      </fs-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.htmlFor).toBe("email")
  })

  it("adds ids and aria-describedby for help and error text", async () => {
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="email">E-post</label>
        <input id="email" class="fs-input" type="email" />
        <p class="fs-help-text">Hjelp</p>
        <p class="fs-error-text">Feil</p>
      </fs-field>
    `

    await Promise.resolve()

    const field = document.querySelector("fs-field") as HTMLElement
    const input = field.querySelector("input") as HTMLInputElement
    const help = field.querySelector(".fs-help-text") as HTMLElement
    const error = field.querySelector(".fs-error-text") as HTMLElement

    expect(help.id.length).toBeGreaterThan(0)
    expect(error.id.length).toBeGreaterThan(0)
    expect(input.getAttribute("aria-invalid")).toBe("true")

    const describedBy = input.getAttribute("aria-describedby") || ""
    expect(describedBy).toContain(help.id)
    expect(describedBy).toContain(error.id)
  })

  it("hides error text until invalid is true", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="email">E-post</label>
        <input id="email" class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()

    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(error.hidden).toBe(true)
    expect(error.getAttribute("aria-hidden")).toBe("true")

    const field = document.querySelector("fs-field") as FsField
    field.invalid = true

    await Promise.resolve()

    expect(error.hidden).toBe(false)
    expect(error.getAttribute("aria-hidden")).toBe("false")
  })

  it("applies required marker and optional marker on label", async () => {
    document.body.innerHTML = `
      <fs-field required-marker="text">
        <label id="label">Navn</label>
        <input class="fs-input" />
      </fs-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.getAttribute("data-required")).toBe("text")

    document.body.innerHTML = `
      <fs-field optional>
        <label id="label-2">Telefon</label>
        <input class="fs-input" />
      </fs-field>
    `

    await Promise.resolve()

    const label2 = document.getElementById("label-2") as HTMLLabelElement
    expect(label2.hasAttribute("data-optional")).toBe(true)
  })
})

describe("fs-field tilgjengelighet", () => {
  it("gir ingen brudd for et felt med hjelpetekst og feilmelding", async () => {
    monter(`
      <fs-field required-marker="symbol" invalid>
        <label>E-postadresse</label>
        <input class="fs-input" type="email" value="ola@" required />
        <p class="fs-help-text">Vi sender kvittering til denne adressen.</p>
        <p class="fs-error-text">Skriv en e-postadresse med krøllalfa.</p>
      </fs-field>

      <fs-field optional>
        <label>Melding til saksbehandler</label>
        <textarea class="fs-textarea" rows="3"></textarea>
        <p class="fs-help-text">Du kan skrive opptil 500 tegn.</p>
      </fs-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })

  it("gir ingen brudd for et felt uten hjelpetekst", async () => {
    monter(`
      <fs-field>
        <label>Fullt navn</label>
        <input class="fs-input" type="text" />
      </fs-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-field ledetekst", () => {
  it("gir ledeteksten fs-label, slik at required-marker faktisk vises", async () => {
    monter(`
      <fs-field required-marker="text">
        <label>E-postadresse</label>
        <input class="fs-input" type="email" />
      </fs-field>
    `)

    await ventPaTegning()

    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.classList.contains("fs-label")).toBe(true)
    expect(label.getAttribute("data-required")).toBe("text")

    // Attributtet alene er dødt uten klassen — markeringen kommer fra ::after
    const markering = getComputedStyle(label, "::after").content
    expect(markering).toContain("påkrevd")
  })

  it("markerer valgfrie felt på samme måte", async () => {
    monter(`
      <fs-field optional>
        <label>Adresse</label>
        <input class="fs-input" type="text" />
      </fs-field>
    `)

    await ventPaTegning()

    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.classList.contains("fs-label")).toBe(true)
    expect(getComputedStyle(label, "::after").content).toContain("valgfri")
  })
})
