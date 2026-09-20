/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { finnOverflyt, monterIsolert } from "../../../testing/isolert"
import textareaCss from "./textarea.css?inline"

import "../../../tokens/tokens.css"
import "./textarea.css"
import "../label/label.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-textarea", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <textarea id="default" class="fs-textarea"></textarea>
      <textarea id="invalid" class="fs-textarea" data-state="invalid"></textarea>
      <textarea id="success" class="fs-textarea" data-state="success"></textarea>
      <textarea id="disabled" class="fs-textarea" disabled></textarea>
    `
  })

  it("applies default styles", () => {
    const textarea = css("default")

    expect(textarea.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(textarea.borderTopColor).toBe("rgb(117, 117, 117)")
    expect(textarea.color).toBe("rgb(26, 26, 26)")
  })

  it("applies invalid styles", () => {
    const textarea = css("invalid")

    expect(textarea.backgroundColor).toBe("rgb(247, 226, 232)")
    expect(textarea.borderTopColor).toBe("rgb(168, 46, 57)")
  })

  it("applies success styles", () => {
    const textarea = css("success")

    expect(textarea.backgroundColor).toBe("rgb(227, 245, 234)")
    expect(textarea.borderTopColor).toBe("rgb(49, 111, 42)")
  })

  it("applies disabled styles", () => {
    const textarea = css("disabled")

    expect(textarea.backgroundColor).toBe("rgb(229, 229, 229)")
    expect(textarea.borderTopColor).toBe("rgb(229, 229, 229)")
    expect(textarea.color).toBe("rgb(117, 117, 117)")
    expect(textarea.pointerEvents).toBe("none")
  })
})

describe("fs-textarea tilgjengelighet", () => {
  it("har nok kontrast og ledetekst i alle tilstander", async () => {
    monter(`
      <label class="fs-label" for="a11y-melding">Melding til saksbehandler</label>
      <textarea class="fs-textarea" id="a11y-melding" rows="3"></textarea>

      <label class="fs-label" for="a11y-begrunnelse">Begrunnelse</label>
      <textarea class="fs-textarea" id="a11y-begrunnelse" rows="3" data-state="invalid" aria-invalid="true">For kort</textarea>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-textarea uten CSS-reset", () => {
  it("holder seg innenfor boksen sin", () => {
    const { boks } = monterIsolert(
      textareaCss,
      `<textarea class="fs-textarea" rows="3">Jeg flytter 1. juni.</textarea>`,
    )

    expect(finnOverflyt(boks)).toEqual([])
  })
})
