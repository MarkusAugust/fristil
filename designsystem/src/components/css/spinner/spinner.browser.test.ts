/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { spinner } from "./spinner"

import "../../../tokens/tokens.css"
import "./spinner.css"

describe("fs-spinner", () => {
  beforeEach(() => {
    monter(`
      <span class="fs-spinner" id="vanlig" role="status" aria-label="Laster søknader"></span>
      <span class="fs-spinner" data-size="small" id="liten" aria-hidden="true"></span>
      <span class="fs-spinner" data-size="large" id="stor" aria-hidden="true"></span>
    `)
  })

  it("skiller størrelsene", () => {
    const bredder = ["liten", "vanlig", "stor"].map(
      (id) =>
        (document.getElementById(id) as HTMLElement).getBoundingClientRect()
          .width,
    )

    expect(bredder[0]).toBeLessThan(bredder[1])
    expect(bredder[1]).toBeLessThan(bredder[2])
  })

  it("markerer én kant i den interaktive fargen", () => {
    const stil = getComputedStyle(document.getElementById("vanlig") as Element)

    expect(stil.borderTopColor).not.toBe(stil.borderBottomColor)
  })

  it("setter rolle bare når den har noe å melde", () => {
    expect(spinner()).toEqual({ class: "fs-spinner" })
    expect(spinner({ size: "large", label: "Laster søknader" })).toEqual({
      class: "fs-spinner",
      "data-size": "large",
      role: "status",
      "aria-label": "Laster søknader",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
