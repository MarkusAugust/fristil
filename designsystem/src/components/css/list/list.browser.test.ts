/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { list } from "./list"

import "../../../tokens/tokens.css"
import "./list.css"

describe("fs-list", () => {
  beforeEach(() => {
    monter(`
      <ul class="fs-list" id="vanlig">
        <li>Fødselsattest</li>
        <li>Bekreftelse fra arbeidsgiver</li>
      </ul>
      <ul class="fs-list" data-variant="plain" id="ren">
        <li>Sendt 4. mars</li>
        <li>Under behandling</li>
      </ul>
      <ul class="fs-list" data-variant="divided" id="delt">
        <li>Faktura 2026-0481</li>
        <li>Faktura 2026-0482</li>
      </ul>
    `)
  })

  it("fjerner punktene uten å fjerne listen", () => {
    const ren = document.getElementById("ren") as HTMLElement

    expect(getComputedStyle(ren).listStyleType).toBe("none")
    // Elementet er fortsatt en <ul>, så skjermleseren sier hvor mange
    // elementer listen har. Det er nettopp derfor varianten finnes.
    expect(ren.tagName).toBe("UL")
    expect(ren.querySelectorAll("li")).toHaveLength(2)
  })

  it("setter strek mellom radene i den delte varianten", () => {
    const andre = document.querySelectorAll("#delt li")[1] as HTMLElement

    expect(getComputedStyle(andre).borderBlockStartWidth).toBe("1px")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(list()).toEqual({ class: "fs-list" })
    expect(list({ variant: "divided" })).toEqual({
      class: "fs-list",
      "data-variant": "divided",
    })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
