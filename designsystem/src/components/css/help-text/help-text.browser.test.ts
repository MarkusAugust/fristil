/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/color"

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

describe("lt-help-text", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="muted" class="lt-help-text">Muted help</p>
      <p id="strong" class="lt-help-text" data-variant="strong">Strong help</p>
      <p id="success" class="lt-help-text" data-variant="success">Success help</p>
      <p id="warning" class="lt-help-text" data-variant="warning">Warning help</p>
    `
  })

  it("applies muted defaults", () => {
    const help = css("muted")

    expect(help.color).toBe(farge("--lt-color-neutral-text-subtle"))
  })

  it("applies strong variant", () => {
    const help = css("strong")

    expect(help.color).toBe(farge("--lt-color-neutral-text-strong"))
  })

  it("applies success variant", () => {
    const help = css("success")

    expect(help.color).toBe(farge("--lt-color-success-text"))
  })

  it("applies warning variant", () => {
    const help = css("warning")

    expect(help.color).toBe(farge("--lt-color-warning-text"))
  })
})

describe("lt-help-text tilgjengelighet", () => {
  it("har nok kontrast og er koblet til feltet", async () => {
    monter(`
      <label class="lt-label" for="a11y-kid">KID-nummer</label>
      <input class="lt-input" id="a11y-kid" inputmode="numeric" aria-describedby="a11y-kid-hjelp" />
      <p class="lt-help-text" id="a11y-kid-hjelp">Du finner nummeret øverst på fakturaen.</p>

      <p class="lt-help-text" data-variant="strong">Endringen gjelder fra neste månedsskifte.</p>
      <p class="lt-help-text" data-variant="success">Vedlegget er lastet opp.</p>
      <p class="lt-help-text" data-variant="warning">Søknadsfristen går ut om tre dager.</p>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
