/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import "../../../tokens/tokens.css"
import "./button.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-button variants", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="primary" class="fs-button">Primary</button>
      <button id="secondary" class="fs-button" data-variant="secondary">Secondary</button>
      <button id="ghost" class="fs-button" data-variant="ghost">Ghost</button>
      <button id="danger" class="fs-button" data-variant="danger">Danger</button>
      <button id="disabled" class="fs-button" disabled>Disabled</button>
    `
  })

  it("applies primary defaults", () => {
    const primary = css("primary")

    expect(primary.backgroundColor).toBe("rgb(19, 98, 174)")
    expect(primary.borderTopColor).toBe("rgb(19, 98, 174)")
    expect(primary.color).toBe("rgb(255, 255, 255)")
  })

  it("applies secondary variant styles", () => {
    const secondary = css("secondary")

    expect(secondary.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(secondary.borderTopColor).toBe("rgb(19, 98, 174)")
    expect(secondary.color).toBe("rgb(19, 98, 174)")
  })

  it("applies ghost variant styles", () => {
    const ghost = css("ghost")

    expect(ghost.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(ghost.borderTopColor).toBe("rgba(0, 0, 0, 0)")
    expect(ghost.color).toBe("rgb(19, 98, 174)")
  })

  it("applies danger variant styles", () => {
    const danger = css("danger")

    expect(danger.backgroundColor).toBe("rgb(247, 226, 232)")
    expect(danger.borderTopColor).toBe("rgb(168, 46, 57)")
    expect(danger.color).toBe("rgb(168, 46, 57)")
  })

  it("applies disabled styles", () => {
    const disabled = css("disabled")

    expect(disabled.backgroundColor).toBe("rgb(229, 229, 229)")
    expect(disabled.borderTopColor).toBe("rgb(229, 229, 229)")
    expect(disabled.color).toBe("rgb(117, 117, 117)")
    expect(disabled.pointerEvents).toBe("none")
  })
})
