/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { lt } from "../../../lt"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { icon } from "./icon"

import "../../../tokens/tokens.css"
import "../button/button.css"
import "./icon.css"

const STROKE = `<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2"/>`

describe("lt-icon", () => {
  beforeEach(() => {
    mount(`
      <p style="font-size: 32px">
        Large text <svg class="lt-icon" id="large" aria-hidden="true" viewBox="0 0 24 24" fill="none">${STROKE}</svg>
      </p>
      <p style="font-size: 16px">
        Small text <svg class="lt-icon" id="small" aria-hidden="true" viewBox="0 0 24 24">${STROKE}</svg>
      </p>
      <button class="lt-button" aria-label="Next page">
        <svg class="lt-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">${STROKE}</svg>
      </button>
      <button class="lt-button">
        <svg class="lt-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">${STROKE}</svg>
        Next page
      </button>
      <svg class="lt-icon" role="img" aria-label="Warning" viewBox="0 0 24 24">${STROKE}</svg>
    `)
  })

  it("is as large as the surrounding text", () => {
    const large = document.getElementById("large") as Element
    const small = document.getElementById("small") as Element

    expect(large.getBoundingClientRect().width).toBeCloseTo(32, 0)
    expect(small.getBoundingClientRect().width).toBeCloseTo(16, 0)
    expect(large.getBoundingClientRect().height).toBeCloseTo(32, 0)
  })

  it("leaves an icon drawn with strokes unfilled", () => {
    expect(
      getComputedStyle(document.getElementById("large") as Element).fill,
    ).toBe("none")
  })

  it("is decoration without a label, and an image with one", () => {
    expect(icon()).toEqual({ class: "lt-icon", "aria-hidden": "true" })
    expect(icon({ label: "" })).toEqual({
      class: "lt-icon",
      "aria-hidden": "true",
    })
    expect(icon({ label: "Warning" })).toEqual({
      class: "lt-icon",
      role: "img",
      "aria-label": "Warning",
    })
  })

  it("can be set on an svg that is already there", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("class", "app-icon")
    document.body.append(svg)

    lt.setAttributes(svg, lt.icon({ label: "Warning" }))
    expect(svg.getAttribute("class")).toBe("lt-icon app-icon")
    expect(svg.getAttribute("role")).toBe("img")
    expect(svg.getAttribute("aria-label")).toBe("Warning")

    lt.setAttributes(svg, lt.icon())
    expect(svg.getAttribute("aria-hidden")).toBe("true")
    expect(svg.hasAttribute("role")).toBe(false)
    expect(svg.hasAttribute("aria-label")).toBe(false)
    svg.remove()
  })

  it("has no accessibility violations", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
