/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import "../../../tokens/tokens.css"
import "./textarea.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("ds-textarea", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <textarea id="default" class="ds-textarea"></textarea>
      <textarea id="invalid" class="ds-textarea" data-state="invalid"></textarea>
      <textarea id="success" class="ds-textarea" data-state="success"></textarea>
      <textarea id="disabled" class="ds-textarea" disabled></textarea>
    `
  })

  it("applies default styles", () => {
    const textarea = css("default")

    expect(textarea.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(textarea.borderTopColor).toBe("rgb(178, 178, 178)")
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
