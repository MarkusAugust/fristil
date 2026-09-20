/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { search } from "./search"

import "../../../tokens/tokens.css"
import "./search.css"
import "../button/button.css"
import "../label/label.css"

describe("fs-search", () => {
  beforeEach(() => {
    monter(`
      <form class="fs-search-row" role="search">
        <label class="fs-label fs-sr-only" for="sok">Søk i saker</label>
        <input class="fs-input fs-search" type="search" id="sok" name="q"
          placeholder="Søk i saker" />
        <button class="fs-button" type="submit">Søk</button>
      </form>
    `)
  })

  it("er et fs-input med plass til ikonet", () => {
    const felt = document.getElementById("sok") as HTMLElement
    const stil = getComputedStyle(felt)

    expect(felt.classList.contains("fs-input")).toBe(true)
    expect(stil.backgroundImage).toContain("svg")
    expect(Number.parseFloat(stil.paddingInlineStart)).toBeGreaterThan(24)
  })

  it("bruker type=search, så nettleseren gir kryss og søketastatur", () => {
    const felt = document.getElementById("sok") as HTMLInputElement

    expect(felt.type).toBe("search")
  })

  it("setter begge klassene fra byggefunksjonen", () => {
    expect(search()).toEqual({
      class: "fs-input fs-search",
      type: "search",
    })
    expect(search({ state: "invalid" })).toMatchObject({
      "data-state": "invalid",
      "aria-invalid": "true",
    })
    expect(search.row).toBe("fs-search-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
