/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { srOnly } from "./sr-only"

import "../../../tokens/tokens.css"
import "./sr-only.css"

describe("fs-sr-only", () => {
  beforeEach(() => {
    monter(`
      <button type="button">
        Slett<span id="skjult" class="fs-sr-only"> søknaden fra 4. mars</span>
      </button>
    `)
  })

  it("tar ikke plass i visningen", () => {
    const skjult = document.getElementById("skjult") as HTMLElement
    const stil = getComputedStyle(skjult)

    expect(stil.position).toBe("absolute")
    expect(skjult.getBoundingClientRect().width).toBeLessThanOrEqual(1)
  })

  it("blir stående i tilgjengelighetstreet", () => {
    const knapp = document.querySelector("button") as HTMLButtonElement

    // Teksten skal være med i navnet skjermleseren leser opp. Hadde vi brukt
    // display: none eller visibility: hidden, hadde den vært borte også her.
    expect(knapp.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Slett søknaden fra 4. mars",
    )
  })

  it("gir klassen fra byggefunksjonen", () => {
    expect(srOnly()).toEqual({ class: "fs-sr-only" })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
