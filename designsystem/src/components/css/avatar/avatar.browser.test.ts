/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { avatar } from "./avatar"

import "../../../tokens/tokens.css"
import "./avatar.css"

describe("fs-avatar", () => {
  beforeEach(() => {
    monter(`
      <span class="fs-avatar" data-size="small" id="liten" aria-hidden="true">ON</span>
      <span class="fs-avatar" id="vanlig" aria-hidden="true">ON</span>
      <span class="fs-avatar" data-size="large" id="stor" aria-hidden="true">ON</span>
      <span class="fs-avatar" data-variant="square" id="firkant" aria-hidden="true">KB</span>
      <p>Ola Nordmann</p>
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

  it("er rund som standard og avrundet som firkant", () => {
    const rund = getComputedStyle(document.getElementById("vanlig") as Element)
    const firkant = getComputedStyle(
      document.getElementById("firkant") as Element,
    )

    expect(rund.borderRadius).toMatch(/50%|9999px/)
    expect(firkant.borderRadius).not.toMatch(/50%/)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(avatar()).toEqual({ class: "fs-avatar" })
    expect(avatar({ size: "large", variant: "square" })).toEqual({
      class: "fs-avatar",
      "data-size": "large",
      "data-variant": "square",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
