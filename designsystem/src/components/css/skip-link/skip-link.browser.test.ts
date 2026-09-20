/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { skipLink } from "./skip-link"

import "../../../tokens/tokens.css"
import "./skip-link.css"

describe("fs-skip-link", () => {
  beforeEach(() => {
    monter(`
      <a class="fs-skip-link" href="#hovedinnhold" id="hopp">Hopp til hovedinnhold</a>
      <main id="hovedinnhold" tabindex="-1">
        <p>Innholdet på siden.</p>
      </main>
    `)
  })

  it("blir værende i tastaturrekkefølgen mens den er skjult", () => {
    const lenke = document.getElementById("hopp") as HTMLElement
    const stil = getComputedStyle(lenke)

    // display: none eller visibility: hidden ville tatt lenken ut av
    // tastaturrekkefølgen, og da finnes den ikke for den som trenger den.
    expect(stil.display).not.toBe("none")
    expect(stil.visibility).not.toBe("hidden")
  })

  it("kommer til syne når den får fokus", async () => {
    const lenke = document.getElementById("hopp") as HTMLElement
    const skjult = getComputedStyle(lenke).transform

    lenke.focus()
    // Lenken glir på plass, så verdien måles etter at overgangen er ferdig.
    await new Promise((resolve) => setTimeout(resolve, 250))
    const synlig = getComputedStyle(lenke).transform

    expect(skjult).not.toBe(synlig)
    expect(synlig).toMatch(/matrix\(1, 0, 0, 1, 0, 0\)|none/)
    expect(document.activeElement).toBe(lenke)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(skipLink()).toEqual({ class: "fs-skip-link" })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
