/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { paragraph } from "./paragraph"

import "../../../tokens/tokens.css"
import "./paragraph.css"

describe("fs-paragraph", () => {
  beforeEach(() => {
    monter(`
      <p class="fs-paragraph" data-variant="lead" id="ingress">
        Bostøtte er en støtteordning for deg som har lave inntekter og høye boutgifter.
      </p>
      <p class="fs-paragraph" id="brod">
        Du kan søke hver måned. Fristen er den 25., og svaret kommer rundt den 20. måneden etter.
      </p>
      <p class="fs-paragraph" id="andre">Neste avsnitt.</p>
    `)
  })

  it("holder linjelengden nede", () => {
    const stil = getComputedStyle(document.getElementById("brod") as Element)

    // 70ch. Lengre linjer gjør det vanskelig å finne starten på neste linje.
    expect(stil.maxInlineSize).not.toBe("none")
  })

  it("skiller ingressen fra brødteksten", () => {
    const ingress = getComputedStyle(
      document.getElementById("ingress") as Element,
    )
    const brod = getComputedStyle(document.getElementById("brod") as Element)

    expect(ingress.fontSize).not.toBe(brod.fontSize)
    expect(ingress.color).not.toBe(brod.color)
  })

  it("setter luft mellom avsnitt som følger hverandre", () => {
    const andre = getComputedStyle(document.getElementById("andre") as Element)

    expect(andre.marginBlockStart).not.toBe("0px")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(paragraph()).toEqual({ class: "fs-paragraph" })
    expect(paragraph({ size: "large", variant: "lead" })).toEqual({
      class: "fs-paragraph",
      "data-size": "large",
      "data-variant": "lead",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
