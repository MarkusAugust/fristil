/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { pagination } from "./pagination"

import "../../../tokens/tokens.css"
import "./pagination.css"

describe("fs-pagination", () => {
  beforeEach(() => {
    monter(`
      <nav aria-label="Sidenavigering">
        <ul class="fs-pagination">
          <li><a href="#">Forrige</a></li>
          <li><a href="#" id="en">1</a></li>
          <li><a href="#" aria-current="page" id="to">2</a></li>
          <li><span class="fs-pagination__gap">…</span></li>
          <li><a href="#">9</a></li>
          <li><a href="#">Neste</a></li>
        </ul>
      </nav>
    `)
  })

  it("gir hvert nummer en stor nok treffflate", () => {
    const rute = (
      document.getElementById("en") as HTMLElement
    ).getBoundingClientRect()

    // WCAG 2.2 krever 24 piksler. Et nummer i en lang rekke er lett å bomme
    // på, så her er flaten større enn minstekravet.
    expect(rute.width).toBeGreaterThanOrEqual(24)
    expect(rute.height).toBeGreaterThanOrEqual(24)
  })

  it("markerer gjeldende side med aria-current, ikke bare farge", () => {
    const naa = document.getElementById("to") as HTMLElement
    const annen = document.getElementById("en") as HTMLElement

    expect(naa.getAttribute("aria-current")).toBe("page")
    expect(getComputedStyle(naa).backgroundColor).not.toBe(
      getComputedStyle(annen).backgroundColor,
    )
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(pagination()).toEqual({ class: "fs-pagination" })
    expect(pagination.gap).toBe("fs-pagination__gap")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-pagination med en deaktivert «Neste»", () => {
  it("gir span-en samme boks som lenkene, og deaktivert farge", () => {
    monter(`
      <nav class="fs-pagination" aria-label="Sider">
        <ul>
          <li><a href="#" id="lenke">2</a></li>
          <li><span aria-disabled="true" id="neste">3</span></li>
        </ul>
      </nav>
    `)
    const boks = (id: string) =>
      (document.getElementById(id) as HTMLElement).getBoundingClientRect()
    const farge = (id: string) =>
      getComputedStyle(document.getElementById(id) as HTMLElement).color

    expect(boks("neste").height).toBe(boks("lenke").height)
    expect(boks("neste").width).toBeGreaterThanOrEqual(boks("lenke").width)
    expect(farge("neste")).not.toBe(farge("lenke"))
  })
})
