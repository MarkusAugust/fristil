/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./error-text.css"
import "../input/input.css"
import "../label/label.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-error-text", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="error" class="fs-error-text">Feilmelding</p>
      <p id="warning" class="fs-error-text" data-variant="warning">Varsel</p>
    `
  })

  it("applies error defaults", () => {
    const text = css("error")

    expect(text.color).toBe("rgb(168, 46, 57)")
    expect(text.fontWeight).toBe("500")
  })

  it("applies warning variant", () => {
    const text = css("warning")

    expect(text.color).toBe("rgb(137, 101, 8)")
  })
})

describe("fs-error-text tilgjengelighet", () => {
  it("har nok kontrast og er koblet til feltet", async () => {
    monter(`
      <label class="fs-label" for="a11y-feil-epost">E-postadresse</label>
      <input
        class="fs-input"
        id="a11y-feil-epost"
        type="email"
        data-state="invalid"
        aria-invalid="true"
        aria-describedby="a11y-feil-epost-feil"
        value="ola@"
      />
      <p class="fs-error-text" id="a11y-feil-epost-feil">Skriv en e-postadresse med krøllalfa.</p>

      <p class="fs-error-text" data-variant="warning">Adressen finnes ikke i folkeregisteret.</p>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
