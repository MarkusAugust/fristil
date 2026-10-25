/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { radio } from "./radio"

import "../../../tokens/tokens.css"
import "./radio.css"
import "../label/label.css"
import "../fieldset/fieldset.css"

describe("lt-radio", () => {
  beforeEach(() => {
    mount(`
      <fieldset class="lt-fieldset">
        <legend class="lt-legend">Leveringsmåte</legend>
        <div class="lt-radio-row">
          <input class="lt-radio" type="radio" id="post" name="levering" checked />
          <label class="lt-label" for="post">Vanlig post</label>
        </div>
        <div class="lt-radio-row">
          <input class="lt-radio" type="radio" id="hentes" name="levering" />
          <label class="lt-label" for="hentes">Hentes på kontoret</label>
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
    expect(radio()).toEqual({ class: "lt-radio", type: "radio" })
    expect(radio.row).toBe("lt-radio-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
