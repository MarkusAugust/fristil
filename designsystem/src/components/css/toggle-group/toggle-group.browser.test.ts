/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
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
