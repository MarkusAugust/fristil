/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { table } from "./table"

import "../../../tokens/tokens.css"
import "./table.css"

describe("fs-table", () => {
  beforeEach(() => {
    monter(`
      <div class="fs-table-scroll" tabindex="0" role="region" aria-label="Fakturaer">
        <table class="fs-table" data-variant="striped" id="tabell">
          <caption>Fakturaer i 2026</caption>
          <thead>
            <tr>
              <th scope="col">Fakturanummer</th>
              <th scope="col">Forfall</th>
              <th scope="col" data-align="end">Beløp</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">2026-0481</th><td>4. mars</td><td data-align="end">1 240 kr</td></tr>
            <tr id="andre"><th scope="row">2026-0482</th><td>4. april</td><td data-align="end">980 kr</td></tr>
          </tbody>
        </table>
      </div>
    `)
  })

  it("markerer annenhver rad når den er stripet", () => {
    const andre = getComputedStyle(document.getElementById("andre") as Element)

    expect(andre.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("bruker samme sifferbredde, så kolonner med tall kan leses nedover", () => {
    const stil = getComputedStyle(document.getElementById("tabell") as Element)

    expect(stil.fontVariantNumeric).toContain("tabular-nums")
  })

  it("høyrestiller cellene som er merket for det", () => {
    const celle = document.querySelector("td[data-align='end']") as HTMLElement

    expect(getComputedStyle(celle).textAlign).toBe("end")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(table()).toEqual({ class: "fs-table" })
    expect(table({ variant: "striped", hoverable: true })).toEqual({
      class: "fs-table",
      "data-variant": "striped",
      "data-hoverable": "",
    })
    expect(table.scroll).toBe("fs-table-scroll")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
