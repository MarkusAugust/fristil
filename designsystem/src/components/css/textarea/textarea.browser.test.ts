/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { color } from "../../../testing/color"
import { findOverflow, mountIsolated } from "../../../testing/isolated"
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

describe("lt-textarea", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <textarea id="default" class="lt-textarea"></textarea>
      <textarea id="invalid" class="lt-textarea" data-state="invalid"></textarea>
      <textarea id="success" class="lt-textarea" data-state="success"></textarea>
      <textarea id="disabled" class="lt-textarea" disabled></textarea>
    `
  })

  it("applies default styles", () => {
    const textarea = css("default")

    expect(textarea.backgroundColor).toBe(color("--lt-color-neutral-canvas"))
    expect(textarea.borderTopColor).toBe(color("--lt-color-neutral-border"))
    expect(textarea.color).toBe(color("--lt-color-neutral-text-strong"))
  })

  it("applies invalid styles", () => {
    const textarea = css("invalid")

    expect(textarea.backgroundColor).toBe(color("--lt-color-danger-surface"))
    expect(textarea.borderTopColor).toBe(color("--lt-color-danger-text"))
  })

  it("applies success styles", () => {
    const textarea = css("success")

    expect(textarea.backgroundColor).toBe(color("--lt-color-success-surface"))
    expect(textarea.borderTopColor).toBe(color("--lt-color-success-text"))
  })

  it("applies disabled styles", () => {
    const textarea = css("disabled")

    expect(textarea.backgroundColor).toBe(color("--lt-color-disabled-surface"))
    expect(textarea.borderTopColor).toBe(color("--lt-color-disabled-surface"))
    expect(textarea.color).toBe(color("--lt-color-neutral-border"))
    // Markøren vises bare hvis elementet treffes av pekeren
    expect(textarea.pointerEvents).toBe("auto")
  })
})

describe("lt-textarea tilgjengelighet", () => {
  it("har nok kontrast og ledetekst i alle tilstander", async () => {
    mount(`
      <label class="lt-label" for="a11y-melding">Melding til saksbehandler</label>
      <textarea class="lt-textarea" id="a11y-melding" rows="3"></textarea>

      <label class="lt-label" for="a11y-begrunnelse">Begrunnelse</label>
      <textarea class="lt-textarea" id="a11y-begrunnelse" rows="3" data-state="invalid" aria-invalid="true">For kort</textarea>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})

describe("lt-textarea uten CSS-reset", () => {
  it("holder seg innenfor boksen sin", () => {
    const { boks } = mountIsolated(
      textareaCss,
      `<textarea class="lt-textarea" rows="3">Jeg flytter 1. juni.</textarea>`,
    )

    expect(findOverflow(boks)).toEqual([])
  })
})

describe("lt-textarea deaktivert", () => {
  it("viser not-allowed-markøren, og blir faktisk truffet av musa", () => {
    mount(`<textarea class="lt-textarea" disabled>Av</textarea>`)

    const element = document.querySelector("textarea") as HTMLElement
    const ramme = element.getBoundingClientRect()

    expect(getComputedStyle(element).cursor).toBe("not-allowed")

    // cursor har ingen virkning hvis elementet ikke treffes av pekeren.
    // Alle disse hadde pointer-events: none, så markøren ble aldri vist.
    expect(
      document.elementFromPoint(
        ramme.x + ramme.width / 2,
        ramme.y + ramme.height / 2,
      ),
    ).toBe(element)
  })
})
