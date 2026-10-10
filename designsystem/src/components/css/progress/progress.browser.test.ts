/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/farge"
import { contrastRatio } from "../../../tokens/color"

import "../../../tokens/tokens.css"
import "./progress.css"

function rgb(verdi: string) {
  const [r, g, b] = verdi.match(/[\d.]+/g)?.map(Number) ?? []
  return { r, g, b }
}

describe(".fs-progress", () => {
  for (const tema of ["light", "dark"] as const) {
    it(`viser hvor langt stolpen går, mot siden (${tema})`, async () => {
      monter(`
        <div data-theme="${tema}">
          <progress class="fs-progress" id="p" value="30" max="100" aria-label="Lastet opp"></progress>
        </div>`)
      await ventPaTegning()
      const stil = getComputedStyle(document.getElementById("p") as Element)
      const side = rgb(farge("--fs-color-neutral-canvas", tema))

      // Sporet alene er 1,12:1 mot siden. Kanten holder 3:1, og fyllet skiller
      // seg fra sporet.
      expect(
        contrastRatio(rgb(stil.borderTopColor), side),
      ).toBeGreaterThanOrEqual(3)
      expect(stil.borderTopWidth).not.toBe("0px")
      expect(
        contrastRatio(rgb(stil.color), rgb(stil.backgroundColor)),
      ).toBeGreaterThanOrEqual(3)
    })
  }

  it("har ingen tilgjengelighetsbrudd", async () => {
    monter(`
      <progress class="fs-progress" value="30" max="100" aria-label="Lastet opp"></progress>
      <progress class="fs-progress" aria-label="Henter"></progress>`)
    await ventPaTegning()

    await forventIngenTilgjengelighetsbrudd()
  })
})
