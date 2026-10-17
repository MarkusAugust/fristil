/// <reference path="../../../types/css.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { server } from "vitest/browser"
import side from "../../../../../documentation/src/content/docs/components/accordion.mdx?raw"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { accordion } from "./accordion"

import "../../../tokens/tokens.css"
import "./accordion.css"

describe("fs-accordion", () => {
  afterEach(() => {
    document.getElementById("oppskrift")?.remove()
  })

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

  it("lar oppskriften på siden bytte pila uten at den står snudd", () => {
    // Siden viser hvordan pila byttes. Rotasjonen ligger i `transform` og
    // byttes når panelet er åpent, så en snutt som bare overstyrte `content`
    // og `border` ga et «+» på skrå, og et «×» når panelet var åpent. Tegnet
    // må også ha tom alternativ tekst, ellers blir det en del av navnet på
    // knappen: skjermleseren sier «Hvem kan søke? +» når `<summary>` får
    // fokus. Snutten leses fra siden, så den kan ikke drive fra koden.
    const snutt = /```css\n([\s\S]*?)```/.exec(side)?.[1]
    if (snutt === undefined) throw new Error("Fant ingen CSS-snutt på siden")
    const stil = document.createElement("style")
    stil.id = "oppskrift"
    stil.textContent = snutt
    document.head.append(stil)

    const lukket = getComputedStyle(
      document.querySelector("#forste summary") as Element,
      "::after",
    )
    const apent = getComputedStyle(
      document.querySelector("#andre summary") as Element,
      "::after",
    )

    expect(lukket.transform).toBe("none")
    expect(apent.transform).toBe("none")
    expect(lukket.content).not.toBe('""')
    if (CSS.supports("content", '"/" / ""')) {
      expect(lukket.content).toMatch(/\/\s*""$/)
    }
  })

  /*
   * <details> holder innholdet søkbart. Bygger du det samme av knapper og
   * aria-expanded, skjules teksten med `hidden`, og nettleserens søk finner
   * den ikke. Før sjekket testen bare `textContent`, og den er satt i begge
   * tilfellene, så testen kunne ikke skille dem. `window.find` er søket i
   * siden fra skript. Det er ikke standard, og om det finner tekst i et
   * lukket <details> spriker mellom motorene, så testen kjøres der det er
   * målt.
   */
  it.skipIf(server.browser !== "chromium")(
    "lar teksten i et lukket panel bli funnet av søk i siden",
    () => {
      monter(`
        <details class="fs-accordion" id="lukket">
          <summary>Hvem kan søke om bostøtte?</summary>
          <div class="fs-accordion__content"><p>Hybelkaninhabitat</p></div>
        </details>
        <button type="button" aria-expanded="false">Hvem kan søke?</button>
        <div hidden><p>Kvistloftmotiv</p></div>
      `)
      const finn = (tekst: string) => {
        getSelection()?.removeAllRanges()
        return (window as unknown as { find(tekst: string): boolean }).find(
          tekst,
        )
      }

      expect(finn("Hybelkaninhabitat")).toBe(true)
      expect(finn("Kvistloftmotiv")).toBe(false)
    },
  )

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
