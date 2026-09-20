/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { radio } from "./radio"

import "../../../tokens/tokens.css"
import "./radio.css"
import "../label/label.css"
import "../fieldset/fieldset.css"

describe("fs-radio", () => {
  beforeEach(() => {
    monter(`
      <fieldset class="fs-fieldset">
        <legend class="fs-legend">Leveringsmåte</legend>
        <div class="fs-radio-row">
          <input class="fs-radio" type="radio" id="post" name="levering" checked />
          <label class="fs-label" for="post">Vanlig post</label>
        </div>
        <div class="fs-radio-row">
          <input class="fs-radio" type="radio" id="hentes" name="levering" />
          <label class="fs-label" for="hentes">Hentes på kontoret</label>
        </div>
      </fieldset>
    `)
  })

  it("er rund, i motsetning til avkryssingsboksen", () => {
    const knapp = document.getElementById("post") as HTMLElement
    const radius = getComputedStyle(knapp).borderRadius

    expect(radius).toMatch(/50%|9999px/)
  })

  it("viser prikken bare på den valgte", () => {
    const valgt = getComputedStyle(document.getElementById("post") as Element)
    const ikkeValgt = getComputedStyle(
      document.getElementById("hentes") as Element,
    )

    expect(valgt.backgroundImage).toContain("radial-gradient")
    expect(ikkeValgt.backgroundImage).toBe("none")
  })

  it("holder bare én valgt om gangen innenfor samme name", () => {
    const hentes = document.getElementById("hentes") as HTMLInputElement
    hentes.click()

    expect((document.getElementById("post") as HTMLInputElement).checked).toBe(
      false,
    )
    expect(hentes.checked).toBe(true)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(radio()).toEqual({ class: "fs-radio", type: "radio" })
    expect(radio.row).toBe("fs-radio-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
