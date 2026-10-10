/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { rgb } from "../../../testing/farge"
import { contrastRatio } from "../../../tokens/color"
import { toggleGroup } from "./toggle-group"

import "../../../tokens/tokens.css"
import "./toggle-group.css"
import "../sr-only/sr-only.css"

describe("fs-toggle-group", () => {
  beforeEach(() => {
    monter(`
      <fieldset class="fs-toggle-group">
        <legend class="fs-sr-only">Visning</legend>
        <label class="fs-toggle-group__option" id="liste">
          <input type="radio" name="visning" value="liste" checked /> Liste
        </label>
        <label class="fs-toggle-group__option" id="kart">
          <input type="radio" name="visning" value="kart" /> Kart
        </label>
      </fieldset>
    `)
  })

  it("markerer det valgte alternativet", () => {
    const valgt = getComputedStyle(document.getElementById("liste") as Element)
    const uvalgt = getComputedStyle(document.getElementById("kart") as Element)

    expect(valgt.backgroundColor).not.toBe(uvalgt.backgroundColor)
  })

  it("er radioknapper under overflaten", () => {
    const kart = document.querySelector("#kart input") as HTMLInputElement
    kart.click()

    // Piltaster, FormData og «2 av 2» fra skjermleseren følger med gratis
    // fordi kontrollene er ekte radioknapper.
    expect(kart.checked).toBe(true)
    expect(
      (document.querySelector("#liste input") as HTMLInputElement).checked,
    ).toBe(false)
  })

  it("holder radioknappen i tastaturrekkefølgen", () => {
    const input = document.querySelector("#liste input") as HTMLInputElement
    const stil = getComputedStyle(input)

    expect(stil.display).not.toBe("none")
    expect(stil.visibility).not.toBe("hidden")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(toggleGroup()).toEqual({ class: "fs-toggle-group" })
    expect(toggleGroup.option).toBe("fs-toggle-group__option")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fokusringen på det valgte alternativet", () => {
  for (const tema of ["light", "dark"] as const) {
    it(`synes mot den valgte flaten (${tema})`, async () => {
      monter(`
        <div data-theme="${tema}">
          <fieldset class="fs-toggle-group">
            <legend class="fs-sr-only">Visning</legend>
            <label class="fs-toggle-group__option">
              <input type="radio" name="visning" value="liste" id="liste" checked /> Liste
            </label>
            <label class="fs-toggle-group__option">
              <input type="radio" name="visning" value="kart" /> Kart
            </label>
          </fieldset>
        </div>`)
      // Fokus fra tastaturet, så `:focus-visible` gjelder. I en radiogruppe
      // er det fokuserte alternativet alltid det valgte. Tab alene når ikke
      // fram i WebKit på macOS, der Tab hopper over radioknapper som i
      // Safari, så fokus settes fra kode etter det ene tastetrykket. Det
      // teller som tastaturstyrt i alle tre motorene, som i fokustesten.
      await userEvent.tab()
      const valgt = document.getElementById("liste") as HTMLInputElement
      valgt.focus()
      expect(document.activeElement).toBe(valgt)
      await ventPaTegning()

      const stil = getComputedStyle(valgt.closest("label") as Element)
      expect(stil.outlineStyle).toBe("solid")
      // Før var ringen 1,23:1 i lyst tema og 2,01:1 i mørkt.
      expect(
        contrastRatio(rgb(stil.outlineColor), rgb(stil.backgroundColor)),
      ).toBeGreaterThanOrEqual(3)
    })
  }
})
