/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { fieldset, legend } from "./fieldset"

import "../../../tokens/tokens.css"
import "./fieldset.css"
import "../radio/radio.css"

describe("fs-fieldset", () => {
  beforeEach(() => {
    monter(`
      <fieldset class="fs-fieldset" id="gruppe">
        <legend class="fs-legend" id="tittel" data-required="symbol">Leveringsmåte</legend>
        <div class="fs-radio-row">
          <input class="fs-radio" type="radio" id="post" name="levering" />
          <label for="post">Vanlig post</label>
        </div>
      </fieldset>
    `)
  })

  it("fjerner nettleserens egen ramme og innrykk", () => {
    const stil = getComputedStyle(document.getElementById("gruppe") as Element)

    expect(stil.borderTopWidth).toBe("0px")
    expect(stil.paddingInlineStart).toBe("0px")
  })

  it("markerer påkrevd på ledeteksten", () => {
    const merke = getComputedStyle(
      document.getElementById("tittel") as Element,
      "::after",
    )

    expect(merke.content).toContain("*")
  })

  it("slår av alle kontrollene i gruppen på én gang", () => {
    const gruppe = document.getElementById("gruppe") as HTMLFieldSetElement
    gruppe.disabled = true

    // Kontrollene inni arver tilstanden fra gruppen. Egenskapen `disabled` på
    // hver av dem står fortsatt til false, så det er `:disabled` som svarer
    // på om brukeren kommer til, ikke egenskapen.
    const knapp = document.getElementById("post") as HTMLInputElement
    expect(knapp.matches(":disabled")).toBe(true)
    expect(knapp.disabled).toBe(false)
  })

  it("setter attributtene fra byggefunksjonene", () => {
    expect(fieldset()).toEqual({ class: "fs-fieldset" })
    expect(fieldset({ state: "invalid" })).toEqual({
      class: "fs-fieldset",
      "data-state": "invalid",
    })
    expect(legend({ required: "text" })).toEqual({
      class: "fs-legend",
      "data-required": "text",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
