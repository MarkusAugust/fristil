/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"

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

describe("fs-label", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label id="default" class="fs-label" for="a">Navn</label>
      <label id="required-symbol" class="fs-label" data-required="symbol" for="b">E-post</label>
      <label id="required-text" class="fs-label" data-required="text" for="e">Telefon</label>
      <label id="optional" class="fs-label" data-optional="" for="c">Adresse</label>
      <label id="disabled" class="fs-label" aria-disabled="true" for="d">Beskrivelse</label>
    `
  })

  it("default: correct color and weight", () => {
    const label = css("default")
    expect(label.color).toBe("rgb(26, 26, 26)")
    expect(label.fontWeight).toBe("600")
  })

  it("disabled: muted color", () => {
    const label = css("disabled")
    expect(label.color).toBe("rgb(117, 117, 117)")
  })

  it("required symbol: ::after has danger color", () => {
    const after = css("required-symbol", "::after")
    expect(after.color).toBe("rgb(168, 46, 57)")
    expect(after.content).toBe('" *"')
  })

  it("required text: ::after shows (påkrevd) in danger color", () => {
    const after = css("required-text", "::after")
    expect(after.color).toBe("rgb(168, 46, 57)")
    expect(after.content).toBe('" (påkrevd)"')
  })

  it("optional: ::after has muted color", () => {
    const after = css("optional", "::after")
    expect(after.color).toBe("rgb(117, 117, 117)")
  })
})

describe("fs-label tilgjengelighet", () => {
  it("kobler ledetekst til felt i alle markeringer", async () => {
    monter(`
      <label class="fs-label" for="a11y-navn">Fullt navn</label>
      <input class="fs-input" id="a11y-navn" type="text" />

      <label class="fs-label" data-required="symbol" for="a11y-epost">E-postadresse</label>
      <input class="fs-input" id="a11y-epost" type="email" required />

      <label class="fs-label" data-required="text" for="a11y-tlf">Telefonnummer</label>
      <input class="fs-input" id="a11y-tlf" type="tel" required />

      <label class="fs-label" data-optional="" for="a11y-adresse">Adresse</label>
      <input class="fs-input" id="a11y-adresse" type="text" />
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
