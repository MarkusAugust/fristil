/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge, rgb } from "../../../testing/color"
import { contrastRatio } from "../../../tokens/color"

import "../../../tokens/tokens.css"
import "./progress.css"

describe(".lt-progress", () => {
  for (const tema of ["light", "dark"] as const) {
    it(`viser hvor langt stolpen går, mot siden (${tema})`, async () => {
      monter(`
        <div data-theme="${tema}">
          <progress class="lt-progress" id="p" value="30" max="100" aria-label="Lastet opp"></progress>
        </div>`)
      await ventPaTegning()
      const stil = getComputedStyle(document.getElementById("p") as Element)
      const side = rgb(farge("--lt-color-neutral-canvas", tema))

      // Sporet alene er 1,12:1 mot siden. Kanten holder 3:1, og fyllet skiller
      // seg fra sporet.
      expect(stil.outlineStyle).toBe("solid")
      expect(
        contrastRatio(rgb(stil.outlineColor), side),
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrastRatio(rgb(stil.color), rgb(stil.backgroundColor)),
      ).toBeGreaterThanOrEqual(3)
    })
  }

  it("tar ikke kanten av høyden, så en tynn stolpe beholder fyllet", async () => {
    // En `border` med `border-box` tok 2 piksler, og en stolpe på 2 piksler
    // ble en grå strek uten fyll.
    monter(`
      <progress class="lt-progress" id="p" value="30" max="100"
        aria-label="Lastet opp" style="--lt-progress-height: 2px"></progress>`)
    await ventPaTegning()

    expect((document.getElementById("p") as HTMLElement).clientHeight).toBe(2)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    monter(`
      <progress class="lt-progress" value="30" max="100" aria-label="Lastet opp"></progress>
      <progress class="lt-progress" aria-label="Henter"></progress>`)
    await ventPaTegning()

    await forventIngenTilgjengelighetsbrudd()
  })
})
