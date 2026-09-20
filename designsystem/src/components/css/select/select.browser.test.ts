/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./select.css"
import "../label/label.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-select", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="default" class="fs-select"><option>Velg</option></select>
      <select id="invalid" class="fs-select" data-state="invalid"><option>Velg</option></select>
      <select id="success" class="fs-select" data-state="success"><option>Velg</option></select>
      <select id="disabled" class="fs-select" disabled><option>Velg</option></select>
    `
  })

  it("applies default styles", () => {
    const select = css("default")

    expect(select.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(select.borderTopColor).toBe("rgb(178, 178, 178)")
    expect(select.color).toBe("rgb(26, 26, 26)")
  })

  it("applies invalid styles", () => {
    const select = css("invalid")

    expect(select.backgroundColor).toBe("rgb(247, 226, 232)")
    expect(select.borderTopColor).toBe("rgb(168, 46, 57)")
  })

  it("applies success styles", () => {
    const select = css("success")

    expect(select.backgroundColor).toBe("rgb(227, 245, 234)")
    expect(select.borderTopColor).toBe("rgb(49, 111, 42)")
  })

  it("applies disabled styles", () => {
    const select = css("disabled")

    expect(select.backgroundColor).toBe("rgb(229, 229, 229)")
    expect(select.borderTopColor).toBe("rgb(229, 229, 229)")
    expect(select.color).toBe("rgb(117, 117, 117)")
    expect(select.pointerEvents).toBe("none")
  })
})

describe("fs-select tilgjengelighet", () => {
  it("har nok kontrast og ledetekst i alle tilstander", async () => {
    monter(`
      <label class="fs-label" for="a11y-fylke">Fylke</label>
      <select class="fs-select" id="a11y-fylke">
        <option value="">Velg fylke</option>
        <option value="vestland">Vestland</option>
      </select>

      <label class="fs-label" for="a11y-kommune">Kommune</label>
      <select class="fs-select" id="a11y-kommune" data-state="invalid" aria-invalid="true">
        <option value="">Velg kommune</option>
      </select>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
