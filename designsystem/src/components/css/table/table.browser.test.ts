/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { table, tableSort, tableSortDirections } from "./table"

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

describe("kolonner som kan sorteres", () => {
  /** Den samme tabellen to ganger: med vanlige overskrifter og med knapper. */
  beforeEach(() => {
    const rad = (knapper: boolean, id: string) => `
      <table class="fs-table">
        <thead>
          <tr id="${id}">
            <th scope="col" ${knapper ? 'aria-sort="ascending"' : ""}>${knapper ? '<button type="button" class="fs-table__sort">Dato</button>' : "Dato"}</th>
            <th scope="col">${knapper ? '<button type="button" class="fs-table__sort">Beløp</button>' : "Beløp"}</th>
            <th scope="col" data-align="end" ${knapper ? 'aria-sort="descending"' : ""}>${knapper ? '<button type="button" class="fs-table__sort">Antall</button>' : "Antall"}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td id="${id}-celle">4. mars</td><td>1 240 kr</td><td data-align="end">3</td></tr>
        </tbody>
      </table>
    `
    monter(rad(false, "uten") + rad(true, "med"))
  })

  /** Hvor teksten i et element faktisk står, ikke hvor boksen står. */
  function tekstboks(element: Element): DOMRect {
    const omraade = document.createRange()
    omraade.selectNodeContents(element)
    return omraade.getBoundingClientRect()
  }

  it("gir overskriftsraden samme høyde som uten knapper", () => {
    const uten = document.getElementById("uten") as HTMLElement
    const med = document.getElementById("med") as HTMLElement

    expect(med.getBoundingClientRect().height).toBe(
      uten.getBoundingClientRect().height,
    )
  })

  it("setter teksten i overskriften der den står uten knapp", () => {
    const knapp = document.querySelector("#med .fs-table__sort") as HTMLElement
    const vanlig = document.querySelector("#uten th") as HTMLElement
    const celle = document.getElementById("med-celle") as HTMLElement
    const fraRaden = (tekst: Element, rad: string) =>
      tekstboks(tekst).top -
      (document.getElementById(rad) as HTMLElement).getBoundingClientRect().top

    expect(fraRaden(knapp, "med")).toBe(fraRaden(vanlig, "uten"))
    expect(tekstboks(knapp).left).toBe(tekstboks(celle).left)
  })

  it("lar teksten i en høyrestilt overskrift slutte der tallene slutter", () => {
    const knapp = document.querySelector(
      "#med th[data-align='end'] .fs-table__sort",
    ) as HTMLElement
    const tall = document.querySelector(
      "#med-celle ~ td[data-align='end']",
    ) as HTMLElement

    expect(tekstboks(knapp).right).toBeCloseTo(tekstboks(tall).right, 1)
  })

  it("lar knappen fylle cellen, så hele cellen kan trykkes", () => {
    const celle = document.querySelector("#med th") as HTMLElement
    const knapp = celle.querySelector(".fs-table__sort") as HTMLElement

    expect(knapp.getBoundingClientRect().width).toBe(
      celle.getBoundingClientRect().width,
    )
  })

  it("tegner en egen pil for hver retning, og en for ingen", () => {
    const pil = (th: Element) =>
      getComputedStyle(
        th.querySelector(".fs-table__sort") as Element,
        "::after",
      ).maskImage
    const celler = [...document.querySelectorAll("#med th")]
    const retning = (th: Element) => th.getAttribute("aria-sort") ?? "ingen"

    expect(celler.map(retning)).toEqual(["ascending", "ingen", "descending"])
    const piler = celler.map(pil)
    for (const p of piler) expect(p).toContain("svg")
    expect(new Set(piler).size).toBe(3)
  })

  it("holder pila utenfor navnet på knappen", () => {
    const knapp = document.querySelector("#med .fs-table__sort") as HTMLElement

    expect(getComputedStyle(knapp, "::after").content).toBe('""')
  })

  it("setter aria-sort på overskriften og klassen på knappen", () => {
    expect(tableSort()).toEqual({
      header: {},
      button: { class: "fs-table__sort", type: "button" },
    })
    for (const direction of tableSortDirections) {
      expect(tableSort({ direction }).header).toEqual({
        "aria-sort": direction,
      })
    }
    expect(tableSort.isDirection("ascending")).toBe(true)
    expect(tableSort.isDirection("none")).toBe(false)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
