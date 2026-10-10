/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { tooltip } from "./tooltip"

import "../../../tokens/tokens.css"
import "./tooltip.css"
import "../button/button.css"

describe("fs-tooltip", () => {
  beforeEach(() => {
    monter(`
      <span class="fs-tooltip">
        <button class="fs-button" data-variant="ghost" type="button"
          aria-describedby="hint" id="utloser">Arkiver</button>
        <span class="fs-tooltip__bubble" role="tooltip" id="hint">
          Saken flyttes til arkivet
        </span>
      </span>
    `)
  })

  it("viser boblen når utløseren får fokus, ikke bare på hover", () => {
    const boble = document.getElementById("hint") as HTMLElement
    expect(getComputedStyle(boble).display).toBe("none")

    ;(document.getElementById("utloser") as HTMLElement).focus()

    // En boble som bare kommer med musa finnes ikke for den som bruker
    // tastatur. Derfor :focus-within i tillegg til :hover.
    expect(getComputedStyle(boble).display).toBe("block")
  })

  it("holder teksten i tilgjengelighetstreet mens den er skjult", () => {
    const boble = document.getElementById("hint") as HTMLElement

    // Boblen er `display: none` til den vises, og teksten er likevel
    // knappens beskrivelse: `aria-describedby` tar med innholdet i et skjult
    // element det peker på (accname, steg 2A). Før var den `visibility:
    // hidden` av denne grunnen, og tok da plass og ga sidelengs rulling.
    expect(boble.textContent?.trim()).not.toBe("")
    expect(
      (document.getElementById("utloser") as HTMLElement).getAttribute(
        "aria-describedby",
      ),
    ).toBe("hint")
  })

  it("holder boblen oppe når musa flyttes fra knappen til boblen", async () => {
    // Det var et gap mellom knappen og boblen, og `:hover` slapp på vei opp.
    const utloser = document.getElementById("utloser") as HTMLElement
    const boble = document.getElementById("hint") as HTMLElement
    await userEvent.hover(utloser)
    await ventPaTegning()

    const knapp = utloser.getBoundingClientRect()
    const gap = boble.getBoundingClientRect().bottom
    const midt = knapp.left + knapp.width / 2
    const mellom = document.elementFromPoint(midt, (gap + knapp.top) / 2)

    expect(boble.contains(mellom)).toBe(true)
    await userEvent.unhover(utloser)
  })

  it("tar ikke plass når den er skjult, så den ikke gir sidelengs rulling", () => {
    monter(`
      <div style="inline-size: 320px; overflow: auto" id="smal">
        <div style="display: flex; justify-content: flex-end">
          <span class="fs-tooltip">
            <button type="button" aria-describedby="kant">i</button>
            <span class="fs-tooltip__bubble" role="tooltip" id="kant">En lang forklaring som er bredere enn knappen</span>
          </span>
        </div>
      </div>`)
    const smal = document.getElementById("smal") as HTMLElement

    expect(smal.scrollWidth).toBe(smal.clientWidth)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(tooltip()).toEqual({ class: "fs-tooltip" })
    expect(tooltip.bubble).toBe("fs-tooltip__bubble")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
