/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { pagination } from "./pagination"

import "../../../tokens/tokens.css"
import "./pagination.css"

describe("lt-pagination", () => {
  beforeEach(() => {
    mount(`
      <nav aria-label="Pagination">
        <ul class="lt-pagination">
          <li><a href="#">Previous</a></li>
          <li><a href="#" id="one">1</a></li>
          <li><a href="#" aria-current="page" id="two">2</a></li>
          <li><span class="lt-pagination__gap">…</span></li>
          <li><a href="#">9</a></li>
          <li><a href="#">Next</a></li>
        </ul>
      </nav>
    `)
  })

  it("gives every number a large enough target", () => {
    const rect = (
      document.getElementById("one") as HTMLElement
    ).getBoundingClientRect()

    // WCAG 2.2 requires 24 pixels. A number in a long row is easy to miss,
    // so the target here is larger than the minimum.
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
  })

  it("marks the current page with aria-current, not just colour", () => {
    const current = document.getElementById("two") as HTMLElement
    const other = document.getElementById("one") as HTMLElement

    expect(current.getAttribute("aria-current")).toBe("page")
    expect(getComputedStyle(current).backgroundColor).not.toBe(
      getComputedStyle(other).backgroundColor,
    )
  })

  it("sets the attributes from the builder function", () => {
    expect(pagination()).toEqual({ class: "lt-pagination" })
    expect(pagination.gap).toBe("lt-pagination__gap")
  })

  it("has no accessibility violations", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})

describe("lt-pagination with a disabled “Next”", () => {
  it("gives the span the same box as the links, and the disabled colour", () => {
    mount(`
      <nav class="lt-pagination" aria-label="Pages">
        <ul>
          <li><a href="#" id="link">2</a></li>
          <li><span aria-disabled="true" id="next">3</span></li>
        </ul>
      </nav>
    `)
    const box = (id: string) =>
      (document.getElementById(id) as HTMLElement).getBoundingClientRect()
    const textColor = (id: string) =>
      getComputedStyle(document.getElementById(id) as HTMLElement).color

    expect(box("next").height).toBe(box("link").height)
    expect(box("next").width).toBeGreaterThanOrEqual(box("link").width)
    expect(textColor("next")).not.toBe(textColor("link"))
  })
})
