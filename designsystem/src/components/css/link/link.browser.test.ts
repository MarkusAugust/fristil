/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import "../../../tokens/tokens.css"
import "./link.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-link variants", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a id="default" class="fs-link" href="#">Default</a>
      <a id="disabled" class="fs-link" aria-disabled="true" href="#">Disabled</a>
    `
  })

  it("applies default link styles", () => {
    const defaultLink = css("default")

    expect(defaultLink.color).toBe("rgb(19, 98, 174)")
    expect(defaultLink.textDecorationLine).toBe("underline")
  })

  it("applies aria-disabled styles", () => {
    const disabled = css("disabled")

    expect(disabled.color).toBe("rgb(117, 117, 117)")
    expect(disabled.textDecorationLine).toBe("none")
    expect(disabled.pointerEvents).toBe("none")
  })
})
