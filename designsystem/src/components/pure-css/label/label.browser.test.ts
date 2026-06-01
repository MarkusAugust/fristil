/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import "../../../tokens/tokens.css"
import "./label.css"

function css(id: string, pseudo?: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element, pseudo)
}

describe("ds-label", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label id="default" class="ds-label" for="a">Navn</label>
      <label id="required-symbol" class="ds-label" data-required="symbol" for="b">E-post</label>
      <label id="required-text" class="ds-label" data-required="text" for="e">Telefon</label>
      <label id="optional" class="ds-label" data-optional="" for="c">Adresse</label>
      <label id="disabled" class="ds-label" aria-disabled="true" for="d">Beskrivelse</label>
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
