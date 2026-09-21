/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsTabs } from "./fs-tabs"
import { tabs } from "./tabs"

import "../../../tokens/tokens.css"
import "./tabs.css"

/** Markupen serveren sender. Rollene og `hidden` kommer herfra, ikke fra komponenten. */
const FANER = tabs({
  id: "sak",
  count: 3,
  selected: 0,
  label: "Deler av saken",
})

const TEKST = ["Søknaden", "Vedlegg", "Meldinger"]
const INNHOLD = [
  "Søknaden ble sendt 4. mars.",
  "Tre vedlegg.",
  "Ingen meldinger.",
]

async function tegn() {
  await customElements.whenDefined("fs-tabs")
  await ventPaTegning()
}

describe("fs-tabs", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  beforeEach(async () => {
    monter(`
      <fs-tabs>
        <div ${attr(FANER.list)}>
          ${FANER.tabs.map((fane, i) => `<button ${attr(fane)}>${TEKST[i]}</button>`).join("\n          ")}
        </div>
        ${FANER.panels.map((panel, i) => `<div ${attr(panel)}><p>${INNHOLD[i]}</p></div>`).join("\n        ")}
      </fs-tabs>
    `)
    await tegn()
  })

  it("får rollene fra serveren, ikke fra komponenten", () => {
    const liste = document.querySelector(".fs-tabs__list") as HTMLElement
    const fane = document.getElementById("sak-tab-0") as HTMLElement
    const panel = document.getElementById("sak-panel-0") as HTMLElement

    expect(liste.getAttribute("role")).toBe("tablist")
    expect(liste.getAttribute("aria-label")).toBe("Deler av saken")
    expect(fane.getAttribute("role")).toBe("tab")
    expect(panel.getAttribute("role")).toBe("tabpanel")
    expect(panel.getAttribute("aria-labelledby")).toBe("sak-tab-0")
    expect(fane.getAttribute("aria-controls")).toBe("sak-panel-0")
  })

  it("skjuler panelene serveren ikke har valgt, før skriptet har kjørt", () => {
    // Gjorde komponenten dette, ville alle panelene vises til den rakk å
    // kjøre, og innholdet hoppe når de skjulte seg selv.
    const paneler = [
      ...document.querySelectorAll<HTMLElement>(".fs-tabs__panel"),
    ]

    expect(paneler.map((p) => p.hidden)).toEqual([false, true, true])
  })

  it("gir bare den valgte fanen en tabbestopp", () => {
    const faner = [...document.querySelectorAll<HTMLElement>("[role='tab']")]

    // Ellers er det én tabbestopp per fane, og Tab kommer aldri inn i
    // panelet uten å gå gjennom hele raden.
    expect(faner.map((f) => f.tabIndex)).toEqual([0, -1, -1])
  })

  it("ber serveren bevare det komponenten endrer", () => {
    const fane = document.getElementById("sak-tab-0") as HTMLElement
    const panel = document.getElementById("sak-panel-0") as HTMLElement

    expect(fane.getAttribute("data-preserve-attr")).toBe(
      "aria-selected tabindex",
    )
    expect(panel.getAttribute("data-preserve-attr")).toBe("hidden")
  })

  it("flytter mellom fanene med piltastene", async () => {
    const forste = document.getElementById("sak-tab-0") as HTMLElement
    forste.focus()
    forste.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    await tegn()

    expect(document.activeElement?.id).toBe("sak-tab-1")
    expect(
      (document.getElementById("sak-tab-1") as HTMLElement).getAttribute(
        "aria-selected",
      ),
    ).toBe("true")
  })

  it("går rundt fra siste til første", async () => {
    const siste = document.getElementById("sak-tab-2") as HTMLElement
    siste.click()
    await tegn()
    siste.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    await tegn()

    expect(document.activeElement?.id).toBe("sak-tab-0")
  })

  it("melder fra når en fane velges", async () => {
    const meldinger: number[] = []
    document
      .querySelector("fs-tabs")
      ?.addEventListener("tab-select", (hendelse) => {
        meldinger.push(
          (hendelse as CustomEvent<{ index: number }>).detail.index,
        )
      })
    ;(document.getElementById("sak-tab-1") as HTMLElement).click()
    await tegn()

    expect(meldinger).toEqual([1])
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
