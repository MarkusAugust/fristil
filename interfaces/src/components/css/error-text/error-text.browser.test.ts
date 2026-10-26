/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { color } from "../../../testing/color"

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

describe("lt-error-text", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="error" class="lt-error-text">Error message</p>
      <p id="warning" class="lt-error-text" data-variant="warning">Warning</p>
    `
  })

  it("applies error defaults", () => {
    const text = css("error")

    expect(text.color).toBe(color("--lt-color-danger-text"))
    expect(text.fontWeight).toBe("500")
  })

  it("applies warning variant", () => {
    const text = css("warning")

    expect(text.color).toBe(color("--lt-color-warning-text"))
  })
})

describe("lt-error-text accessibility", () => {
  it("has enough contrast and is wired to the field", async () => {
    mount(`
      <label class="lt-label" for="a11y-error-email">Email address</label>
      <input
        class="lt-input"
        id="a11y-error-email"
        type="email"
        data-state="invalid"
        aria-invalid="true"
        aria-describedby="a11y-error-email-error"
        value="alex@"
      />
      <p class="lt-error-text" id="a11y-error-email-error">Enter an email address with an @.</p>

      <p class="lt-error-text" data-variant="warning">This address is not in the population register.</p>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
