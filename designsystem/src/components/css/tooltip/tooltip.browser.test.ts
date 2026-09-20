/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

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
    expect(getComputedStyle(boble).visibility).toBe("hidden")

    ;(document.getElementById("utloser") as HTMLElement).focus()

    // En boble som bare kommer med musa finnes ikke for den som bruker
    // tastatur. Derfor :focus-within i tillegg til :hover.
    expect(getComputedStyle(boble).visibility).toBe("visible")
  })

  it("holder teksten i tilgjengelighetstreet mens den er skjult", () => {
    const boble = document.getElementById("hint") as HTMLElement

    // visibility og ikke display: teksten må kunne pekes på med
    // aria-describedby også før boblen vises.
    expect(getComputedStyle(boble).display).not.toBe("none")
    expect(
      (document.getElementById("utloser") as HTMLElement).getAttribute(
        "aria-describedby",
      ),
    ).toBe("hint")
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
