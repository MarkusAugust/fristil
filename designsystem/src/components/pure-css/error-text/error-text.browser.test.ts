/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import "../../../tokens/tokens.css"
import "./error-text.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("ds-error-text", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="error" class="ds-error-text">Feilmelding</p>
      <p id="warning" class="ds-error-text" data-variant="warning">Varsel</p>
    `
  })

  it("applies error defaults", () => {
    const text = css("error")

    expect(text.color).toBe("rgb(168, 46, 57)")
    expect(text.fontWeight).toBe("500")
  })

  it("applies warning variant", () => {
    const text = css("warning")

    expect(text.color).toBe("rgb(159, 117, 9)")
  })
})
