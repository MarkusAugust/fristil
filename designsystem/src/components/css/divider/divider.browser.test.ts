/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { divider } from "./divider"

import "../../../tokens/tokens.css"
import "./divider.css"

describe("fs-divider", () => {
  beforeEach(() => {
    monter(`
      <p>Saken er registrert.</p>
      <hr class="fs-divider" id="vanlig" />
      <p>Du får svar innen tre uker.</p>
      <hr class="fs-divider" data-variant="strong" id="sterk" />
      <hr class="fs-divider" data-variant="subtle" id="svak" aria-hidden="true" />
    `)
  })

  it("fjerner nettleserens egen ramme", () => {
    const stil = getComputedStyle(document.getElementById("vanlig") as Element)

    expect(stil.borderTopWidth).toBe("0px")
    expect(stil.height).toBe("1px")
  })

  it("gir hver variant sin egen styrke", () => {
    const farger = ["vanlig", "sterk", "svak"].map(
      (id) =>
        getComputedStyle(document.getElementById(id) as Element)
          .backgroundColor,
    )

    expect(new Set(farger).size).toBe(3)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(divider()).toEqual({ class: "fs-divider" })
    expect(divider({ variant: "strong" })).toEqual({
      class: "fs-divider",
      "data-variant": "strong",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
