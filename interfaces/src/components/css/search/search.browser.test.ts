/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { search } from "./search"

import "../../../tokens/tokens.css"
import "./search.css"
import "../button/button.css"
import "../label/label.css"

describe("lt-search", () => {
  beforeEach(() => {
    mount(`
      <form class="lt-search-row" role="search">
        <label class="lt-label lt-sr-only" for="sok">Søk i saker</label>
        <input class="lt-input lt-search" type="search" id="sok" name="q"
          placeholder="Søk i saker" />
        <button class="lt-button" type="submit">Søk</button>
      </form>
    `)
  })

  it("er et lt-input med plass til ikonet", () => {
    const felt = document.getElementById("sok") as HTMLElement
    const stil = getComputedStyle(felt)

    expect(felt.classList.contains("lt-input")).toBe(true)
    expect(stil.backgroundImage).toContain("svg")
    expect(Number.parseFloat(stil.paddingInlineStart)).toBeGreaterThan(24)
  })

  it("bruker type=search, så nettleseren gir kryss og søketastatur", () => {
    const felt = document.getElementById("sok") as HTMLInputElement

    expect(felt.type).toBe("search")
  })

  it("setter begge klassene fra byggefunksjonen", () => {
    expect(search()).toEqual({
      class: "lt-input lt-search",
      type: "search",
    })
    expect(search({ state: "invalid" })).toMatchObject({
      "data-state": "invalid",
      "aria-invalid": "true",
    })
    expect(search.row).toBe("lt-search-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
