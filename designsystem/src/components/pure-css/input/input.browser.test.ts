/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import "../../../tokens/tokens.css"
import "./input.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("ds-input", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="default" class="ds-input" />
      <input id="date" class="ds-input" type="date" data-variant="date" value="2026-05-31" />
      <input id="time" class="ds-input" type="time" data-variant="time" value="10:30" />
      <input id="datetime" class="ds-input" type="datetime-local" data-variant="datetime-local" value="2026-05-31T10:30" />
      <input id="invalid" class="ds-input" data-state="invalid" />
      <input id="success" class="ds-input" data-state="success" />
      <input id="disabled" class="ds-input" disabled />
    `
  })

  it("applies default styles", () => {
    const input = css("default")

    expect(input.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(input.borderTopColor).toBe("rgb(178, 178, 178)")
    expect(input.color).toBe("rgb(26, 26, 26)")
  })

  it("applies invalid styles", () => {
    const input = css("invalid")

    expect(input.backgroundColor).toBe("rgb(247, 226, 232)")
    expect(input.borderTopColor).toBe("rgb(168, 46, 57)")
  })

  it("applies date variant styles", () => {
    const input = css("date")

    expect(input.fontVariantNumeric).toContain("tabular-nums")
    expect(input.backgroundImage).toContain("data:image")
  })

  it("applies time variant icon styles", () => {
    const input = css("time")

    expect(input.backgroundImage).toContain("data:image")
  })

  it("applies datetime-local variant icon styles", () => {
    const input = css("datetime")

    expect(input.backgroundImage).toContain("data:image")
  })

  it("applies success styles", () => {
    const input = css("success")

    expect(input.backgroundColor).toBe("rgb(227, 245, 234)")
    expect(input.borderTopColor).toBe("rgb(49, 111, 42)")
  })

  it("applies disabled styles", () => {
    const input = css("disabled")

    expect(input.backgroundColor).toBe("rgb(229, 229, 229)")
    expect(input.borderTopColor).toBe("rgb(229, 229, 229)")
    expect(input.color).toBe("rgb(117, 117, 117)")
    expect(input.pointerEvents).toBe("none")
  })
})
