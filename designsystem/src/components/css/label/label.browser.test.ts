/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/color"

import "../../../tokens/tokens.css"
import "./label.css"
import "../input/input.css"

function css(id: string, pseudo?: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element, pseudo)
}

describe("lt-label", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label id="default" class="lt-label" for="a">Navn</label>
      <label id="required-symbol" class="lt-label" data-required="symbol" for="b">E-post</label>
      <label id="required-text" class="lt-label" data-required="text" for="e">Telefon</label>
      <label id="optional" class="lt-label" data-optional="" for="c">Adresse</label>
      <label id="disabled" class="lt-label" aria-disabled="true" for="d">Beskrivelse</label>
    `
  })

  it("default: correct color and weight", () => {
    const label = css("default")
    expect(label.color).toBe(farge("--lt-color-neutral-text-strong"))
    expect(label.fontWeight).toBe("600")
  })

  it("disabled: muted color", () => {
    const label = css("disabled")
    expect(label.color).toBe(farge("--lt-color-neutral-text-subtle"))
  })

  it("required symbol: ::after has danger color", () => {
    const after = css("required-symbol", "::after")
    expect(after.color).toBe(farge("--lt-color-danger-text"))
    expect(after.content).toBe('" *"')
  })

  it("required text: ::after shows (required) in danger color", () => {
    const after = css("required-text", "::after")
    expect(after.color).toBe(farge("--lt-color-danger-text"))
    expect(after.content).toBe('" (required)"')
  })

  it("optional: ::after has muted color", () => {
    const after = css("optional", "::after")
    expect(after.color).toBe(farge("--lt-color-neutral-text-subtle"))
  })
})

describe("lt-label accessibility", () => {
  it("connects the label to the field in every marker", async () => {
    monter(`
      <label class="lt-label" for="a11y-navn">Fullt navn</label>
      <input class="lt-input" id="a11y-navn" type="text" />

      <label class="lt-label" data-required="symbol" for="a11y-epost">E-postadresse</label>
      <input class="lt-input" id="a11y-epost" type="email" required />

      <label class="lt-label" data-required="text" for="a11y-tlf">Telefonnummer</label>
      <input class="lt-input" id="a11y-tlf" type="tel" required />

      <label class="lt-label" data-optional="" for="a11y-adresse">Adresse</label>
      <input class="lt-input" id="a11y-adresse" type="text" />
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("the text in the marker can be replaced", () => {
  it("is English when the variables are not set", () => {
    monter(`
      <label id="krav" class="lt-label" data-required="text">Navn</label>
      <label id="valg" class="lt-label" data-optional>Mellomnavn</label>
    `)

    expect(css("krav", "::after").content).toBe('" (required)"')
    expect(css("valg", "::after").content).toBe('" (optional)"')
  })

  it("reads the text from the variables, so it can be translated", () => {
    // A package cannot ship every language, so the text belongs to the app.
    // `:lang(nb)` is one way, a variable set from i18next another. The
    // values differ from the defaults, so the test fails if the variables
    // are not read.
    monter(`
      <div style="--lt-label-required-text: ' (påkrevd)'; --lt-label-optional-text: ' (valgfri)'; --lt-label-required-symbol: ' †'">
        <label id="krav" class="lt-label" data-required="text">Name</label>
        <label id="valg" class="lt-label" data-optional>Middle name</label>
        <label id="tegn" class="lt-label" data-required>Email</label>
      </div>
    `)

    expect(css("krav", "::after").content).toBe('" (påkrevd)"')
    expect(css("valg", "::after").content).toBe('" (valgfri)"')
    expect(css("tegn", "::after").content).toBe('" †"')
  })
})
