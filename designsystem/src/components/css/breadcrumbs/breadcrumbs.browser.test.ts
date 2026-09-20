/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { breadcrumbs } from "./breadcrumbs"

import "../../../tokens/tokens.css"
import "./breadcrumbs.css"

describe("fs-breadcrumbs", () => {
  beforeEach(() => {
    monter(`
      <nav aria-label="Du er her">
        <ol class="fs-breadcrumbs">
          <li><a href="#">Forsiden</a></li>
          <li><a href="#">Mine saker</a></li>
          <li><a href="#" aria-current="page" id="her">Søknad 2026-0481</a></li>
        </ol>
      </nav>
    `)
  })

  it("legger skilletegnet inn med CSS, ikke i markupen", () => {
    const andre = document.querySelectorAll(".fs-breadcrumbs li")[1]
    const skille = getComputedStyle(andre, "::before")

    // Sto skråstreken i markupen, ville skjermlesere lest den opp mellom
    // hvert steg.
    expect(skille.content).toContain("/")
    expect(
      document.querySelector(".fs-breadcrumbs")?.textContent,
    ).not.toContain("/")
  })

  it("skiller gjeldende side fra lenkene", () => {
    const her = getComputedStyle(document.getElementById("her") as Element)
    const foran = getComputedStyle(
      document.querySelector(".fs-breadcrumbs a") as Element,
    )

    expect(her.color).not.toBe(foran.color)
    expect(her.textDecorationLine).toBe("none")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(breadcrumbs()).toEqual({ class: "fs-breadcrumbs" })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
