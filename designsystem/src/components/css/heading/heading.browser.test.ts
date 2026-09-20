/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { heading } from "./heading"

import "../../../tokens/tokens.css"
import "./heading.css"

describe("fs-heading", () => {
  beforeEach(() => {
    monter(`
      <h1 class="fs-heading" data-size="mega" id="mega">Søknad om bostøtte</h1>
      <h2 class="fs-heading" id="standard">Om søkeren</h2>
      <h3 class="fs-heading" data-size="s" id="liten">Vedlegg</h3>
    `)
  })

  it("skiller størrelsene uten å røre nivået", () => {
    const stor = Number.parseFloat(
      getComputedStyle(document.getElementById("mega") as Element).fontSize,
    )
    const vanlig = Number.parseFloat(
      getComputedStyle(document.getElementById("standard") as Element).fontSize,
    )
    const liten = Number.parseFloat(
      getComputedStyle(document.getElementById("liten") as Element).fontSize,
    )

    expect(stor).toBeGreaterThan(vanlig)
    expect(vanlig).toBeGreaterThan(liten)

    // Nivåene er urørt. En <h3> som ser liten ut er fortsatt en h3.
    expect(document.getElementById("liten")?.tagName).toBe("H3")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(heading()).toEqual({ class: "fs-heading" })
    expect(heading({ size: "mega" })).toEqual({
      class: "fs-heading",
      "data-size": "mega",
    })
    expect(heading.isSize("xs")).toBe(true)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
