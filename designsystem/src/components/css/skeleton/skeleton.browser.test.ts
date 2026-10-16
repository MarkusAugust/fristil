/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { skeleton } from "./skeleton"

import "../../../tokens/tokens.css"
import "./skeleton.css"

describe("fs-skeleton", () => {
  beforeEach(() => {
    monter(`
      <p role="status">Henter søknadene dine</p>
      <div class="fs-skeleton" data-variant="circle" id="sirkel" aria-hidden="true"></div>
      <div class="fs-skeleton" data-variant="text" id="tekst" aria-hidden="true"></div>
      <div class="fs-skeleton" id="blokk" aria-hidden="true"></div>
    `)
  })

  it("er rund i sirkelvarianten", () => {
    const sirkel = getComputedStyle(
      document.getElementById("sirkel") as Element,
    )

    expect(sirkel.borderRadius).toMatch(/50%|9999px/)
  })

  it("lar --fs-skeleton-radius gjelde tekstlinjene også", () => {
    // Tekstvarianten hadde en fast radius og leste ikke variabelen.
    for (const id of ["tekst", "blokk"]) {
      const element = document.getElementById(id) as HTMLElement
      element.style.setProperty("--fs-skeleton-radius", "20px")
      expect(getComputedStyle(element).borderTopLeftRadius, id).toBe("20px")
    }
  })

  it("holdes utenfor tilgjengelighetstreet", () => {
    // En rekke tomme bokser som leses opp er verre enn stillhet. Ventingen
    // meldes ett sted, i elementet med role="status".
    for (const form of document.querySelectorAll(".fs-skeleton")) {
      expect(form.getAttribute("aria-hidden")).toBe("true")
    }
  })

  it("setter aria-hidden fra byggefunksjonen", () => {
    expect(skeleton()).toEqual({ class: "fs-skeleton", "aria-hidden": "true" })
    expect(skeleton({ variant: "text" })).toEqual({
      class: "fs-skeleton",
      "data-variant": "text",
      "aria-hidden": "true",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
