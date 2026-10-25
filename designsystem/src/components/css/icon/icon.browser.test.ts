/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { lt } from "../../../lt"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { icon } from "./icon"

import "../../../tokens/tokens.css"
import "../button/button.css"
import "./icon.css"

const STREK = `<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2"/>`

describe("lt-icon", () => {
  beforeEach(() => {
    monter(`
      <p style="font-size: 32px">
        Stor tekst <svg class="lt-icon" id="stor" aria-hidden="true" viewBox="0 0 24 24" fill="none">${STREK}</svg>
      </p>
      <p style="font-size: 16px">
        Liten tekst <svg class="lt-icon" id="liten" aria-hidden="true" viewBox="0 0 24 24">${STREK}</svg>
      </p>
      <button class="lt-button" aria-label="Neste side">
        <svg class="lt-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">${STREK}</svg>
      </button>
      <button class="lt-button">
        <svg class="lt-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">${STREK}</svg>
        Neste side
      </button>
      <svg class="lt-icon" role="img" aria-label="Advarsel" viewBox="0 0 24 24">${STREK}</svg>
    `)
  })

  it("er like stort som teksten rundt", () => {
    const stor = document.getElementById("stor") as Element
    const liten = document.getElementById("liten") as Element

    expect(stor.getBoundingClientRect().width).toBeCloseTo(32, 0)
    expect(liten.getBoundingClientRect().width).toBeCloseTo(16, 0)
    expect(stor.getBoundingClientRect().height).toBeCloseTo(32, 0)
  })

  it("lar et ikon tegnet med strek være ufylt", () => {
    expect(
      getComputedStyle(document.getElementById("stor") as Element).fill,
    ).toBe("none")
  })

  it("er pynt uten label, og et bilde med", () => {
    expect(icon()).toEqual({ class: "lt-icon", "aria-hidden": "true" })
    expect(icon({ label: "" })).toEqual({
      class: "lt-icon",
      "aria-hidden": "true",
    })
    expect(icon({ label: "Advarsel" })).toEqual({
      class: "lt-icon",
      role: "img",
      "aria-label": "Advarsel",
    })
  })

  it("kan settes på en svg som står der fra før", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("class", "app-ikon")
    document.body.append(svg)

    lt.setAttributes(svg, lt.icon({ label: "Advarsel" }))
    expect(svg.getAttribute("class")).toBe("lt-icon app-ikon")
    expect(svg.getAttribute("role")).toBe("img")
    expect(svg.getAttribute("aria-label")).toBe("Advarsel")

    lt.setAttributes(svg, lt.icon())
    expect(svg.getAttribute("aria-hidden")).toBe("true")
    expect(svg.hasAttribute("role")).toBe(false)
    expect(svg.hasAttribute("aria-label")).toBe(false)
    svg.remove()
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
