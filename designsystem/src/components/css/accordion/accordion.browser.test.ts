/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { accordion } from "./accordion"

import "../../../tokens/tokens.css"
import "./accordion.css"

describe("fs-accordion", () => {
  beforeEach(() => {
    monter(`
      <details class="fs-accordion" id="forste">
        <summary>Hvem kan søke om bostøtte?</summary>
        <div class="fs-accordion__content">
          <p>Alle som bor og er folkeregistrert i boligen.</p>
        </div>
      </details>
      <details class="fs-accordion" id="andre" open>
        <summary>Hvor lang er behandlingstiden?</summary>
        <div class="fs-accordion__content">
          <p>Vi behandler søknaden innen tre uker.</p>
        </div>
      </details>
    `)
  })

  it("lar nettleseren styre åpning og lukking", () => {
    const panel = document.getElementById("forste") as HTMLDetailsElement
    const knapp = panel.querySelector("summary") as HTMLElement

    expect(panel.open).toBe(false)
    knapp.click()
    expect(panel.open).toBe(true)
  })

  it("bytter ut nettleserens egen trekant med en lik i alle nettlesere", () => {
    const knapp = document.querySelector("summary") as HTMLElement

    expect(getComputedStyle(knapp).listStyleType).toBe("none")
    expect(getComputedStyle(knapp, "::after").content).not.toBe("normal")
  })

  it("snur pilen når panelet er åpent", () => {
    const lukket = getComputedStyle(
      document.querySelector("#forste summary") as Element,
      "::after",
    ).transform
    const apent = getComputedStyle(
      document.querySelector("#andre summary") as Element,
      "::after",
    ).transform

    expect(lukket).not.toBe(apent)
  })

  it("lar teksten i et lukket panel bli funnet av søk i siden", () => {
    // <details> holder innholdet i DOM-en. Bygger du det samme av knapper og
    // aria-expanded, forsvinner teksten, og nettleserens søk finner den ikke.
    const skjult = document.querySelector("#forste p") as HTMLElement

    expect(skjult.textContent).toContain("folkeregistrert")
  })

  it("gir en overskrift i summary samme størrelse som uten", () => {
    // Dokumentasjonen viser `<summary><h3>`. Før fikk overskriften
    // nettleserens marg og størrelse.
    monter(`
      <details class="fs-accordion"><summary id="uten">Spørsmål</summary></details>
      <details class="fs-accordion"><summary><h3 id="med">Spørsmål</h3></summary></details>
    `)
    const overskrift = getComputedStyle(
      document.getElementById("med") as Element,
    )
    const uten = getComputedStyle(document.getElementById("uten") as Element)

    expect(overskrift.marginBlockStart).toBe("0px")
    expect(overskrift.fontSize).toBe(uten.fontSize)
  })

  it("gir overskriften og innholdet samme luft til sidene", () => {
    monter(`
      <details class="fs-accordion" open style="--fs-accordion-padding-inline: 40px">
        <summary id="topp">Spørsmål</summary>
        <div class="fs-accordion__content" id="innhold"><p>Svar</p></div>
      </details>
    `)

    expect(
      getComputedStyle(document.getElementById("innhold") as Element)
        .paddingInlineStart,
    ).toBe("40px")
    expect(
      getComputedStyle(document.getElementById("topp") as Element)
        .paddingInlineStart,
    ).toBe("40px")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(accordion()).toEqual({ class: "fs-accordion" })
    expect(accordion({ variant: "plain" })).toEqual({
      class: "fs-accordion",
      "data-variant": "plain",
    })
    expect(accordion.content).toBe("fs-accordion__content")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
