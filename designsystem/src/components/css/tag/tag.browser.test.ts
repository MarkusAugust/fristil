/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { tag } from "./tag"

import "../../../tokens/tokens.css"
import "./tag.css"

describe("fs-tag", () => {
  beforeEach(() => {
    monter(`
      <span class="fs-tag" id="vanlig">Bostøtte</span>
      <span class="fs-tag" data-variant="filled" id="fylt">Barnehage</span>
      <button class="fs-tag" data-selectable aria-pressed="true" id="valgt" type="button">
        Innvilget
      </button>
      <button class="fs-tag" data-selectable aria-pressed="false" id="ikkevalgt" type="button">
        Avslått
      </button>
    `)
  })

  it("skiller den valgte fra den uvalgte", () => {
    const valgt = getComputedStyle(document.getElementById("valgt") as Element)
    const ikkevalgt = getComputedStyle(
      document.getElementById("ikkevalgt") as Element,
    )

    expect(valgt.backgroundColor).not.toBe(ikkevalgt.backgroundColor)
    expect(valgt.color).not.toBe(ikkevalgt.color)
  })

  it("lar den valgbare merkelappen være en ekte knapp", () => {
    const valgbar = document.getElementById("valgt") as HTMLElement

    expect(valgbar.tagName).toBe("BUTTON")
    expect(valgbar.getAttribute("aria-pressed")).toBe("true")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(tag()).toEqual({ class: "fs-tag" })
    expect(tag({ variant: "filled", selectable: true })).toEqual({
      class: "fs-tag",
      "data-variant": "filled",
      "data-selectable": "",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
