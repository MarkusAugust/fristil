/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./help-text.css"
import "../input/input.css"
import "../label/label.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-help-text", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="muted" class="fs-help-text">Muted help</p>
      <p id="default" class="fs-help-text" data-variant="default">Default help</p>
      <p id="success" class="fs-help-text" data-variant="success">Success help</p>
      <p id="warning" class="fs-help-text" data-variant="warning">Warning help</p>
    `
  })

  it("applies muted defaults", () => {
    const help = css("muted")

    expect(help.color).toBe("rgb(117, 117, 117)")
  })

  it("applies default variant", () => {
    const help = css("default")

    expect(help.color).toBe("rgb(26, 26, 26)")
  })

  it("applies success variant", () => {
    const help = css("success")

    expect(help.color).toBe("rgb(49, 111, 42)")
  })

  it("applies warning variant", () => {
    const help = css("warning")

    expect(help.color).toBe("rgb(137, 101, 8)")
  })
})

describe("fs-help-text tilgjengelighet", () => {
  it("har nok kontrast og er koblet til feltet", async () => {
    monter(`
      <label class="fs-label" for="a11y-kid">KID-nummer</label>
      <input class="fs-input" id="a11y-kid" inputmode="numeric" aria-describedby="a11y-kid-hjelp" />
      <p class="fs-help-text" id="a11y-kid-hjelp">Du finner nummeret øverst på fakturaen.</p>

      <p class="fs-help-text" data-variant="default">Endringen gjelder fra neste månedsskifte.</p>
      <p class="fs-help-text" data-variant="success">Vedlegget er lastet opp.</p>
      <p class="fs-help-text" data-variant="warning">Søknadsfristen går ut om tre dager.</p>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
