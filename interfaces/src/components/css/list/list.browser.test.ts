/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { list } from "./list"

import "../../../tokens/tokens.css"
import "./list.css"

describe("lt-list", () => {
  beforeEach(() => {
    mount(`
      <ul class="lt-list" id="regular">
        <li>Birth certificate</li>
        <li>Confirmation from employer</li>
      </ul>
      <ul class="lt-list" data-variant="plain" id="plain">
        <li>Sent 4 March</li>
        <li>In progress</li>
      </ul>
      <ul class="lt-list" data-variant="divided" id="divided">
        <li>Invoice 2026-0481</li>
        <li>Invoice 2026-0482</li>
      </ul>
    `)
  })

  it("removes the bullets without removing the list", () => {
    const plain = document.getElementById("plain") as HTMLElement

    expect(getComputedStyle(plain).listStyleType).toBe("none")
    // The element is still a <ul>, so the screen reader says how many
    // items the list has. That is exactly why the variant exists.
    expect(plain.tagName).toBe("UL")
    expect(plain.querySelectorAll("li")).toHaveLength(2)
  })

  it("draws a line between the rows in the divided variant", () => {
    const second = document.querySelectorAll("#divided li")[1] as HTMLElement

    expect(getComputedStyle(second).borderBlockStartWidth).toBe("1px")
  })

  it("sets the attributes from the builder function", () => {
    expect(list()).toEqual({ class: "lt-list" })
    expect(list({ variant: "divided" })).toEqual({
      class: "lt-list",
      "data-variant": "divided",
    })
  })

  it("has no accessibility violations", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
