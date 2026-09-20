/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsTabs } from "./fs-tabs"

import "../../../tokens/tokens.css"
import "./tabs.css"

async function tegn() {
  const tabs = document.querySelector("fs-tabs") as HTMLElement & {
    updateComplete?: Promise<unknown>
  }
  await customElements.whenDefined("fs-tabs")
  await tabs.updateComplete
}

describe("fs-tabs", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  beforeEach(async () => {
    monter(`
      <fs-tabs label="Deler av saken">
        <div class="fs-tabs__list">
          <button id="fane-1">Søknaden</button>
          <button id="fane-2">Vedlegg</button>
          <button id="fane-3">Meldinger</button>
        </div>
        <div class="fs-tabs__panel"><p>Søknaden ble sendt 4. mars.</p></div>
        <div class="fs-tabs__panel"><p>Tre vedlegg.</p></div>
        <div class="fs-tabs__panel"><p>Ingen meldinger.</p></div>
      </fs-tabs>
    `)
    await tegn()
  })

  it("setter rollene på raden, fanene og panelene", () => {
    const liste = document.querySelector(".fs-tabs__list") as HTMLElement
    const fane = document.getElementById("fane-1") as HTMLElement
    const panel = document.querySelector(".fs-tabs__panel") as HTMLElement

    expect(liste.getAttribute("role")).toBe("tablist")
    expect(liste.getAttribute("aria-label")).toBe("Deler av saken")
    expect(fane.getAttribute("role")).toBe("tab")
    expect(panel.getAttribute("role")).toBe("tabpanel")
    expect(panel.getAttribute("aria-labelledby")).toBe("fane-1")
    expect(fane.getAttribute("aria-controls")).toBe(panel.id)
  })

  it("viser bare panelet som hører til den valgte fanen", () => {
    const paneler = [
      ...document.querySelectorAll<HTMLElement>(".fs-tabs__panel"),
    ]

    expect(paneler.map((p) => p.hidden)).toEqual([false, true, true])
  })

  it("gir bare den valgte fanen en tabbestopp", () => {
    const faner = [
      ...document.querySelectorAll<HTMLElement>(".fs-tabs__list button"),
    ]

    // Ellers er det én tabbestopp per fane, og Tab kommer aldri inn i
    // panelet uten å gå gjennom hele raden.
    expect(faner.map((f) => f.tabIndex)).toEqual([0, -1, -1])
  })

  it("flytter mellom fanene med piltastene", async () => {
    const forste = document.getElementById("fane-1") as HTMLElement
    forste.focus()
    forste.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    await tegn()

    expect(document.activeElement?.id).toBe("fane-2")
    expect(
      (document.getElementById("fane-2") as HTMLElement).getAttribute(
        "aria-selected",
      ),
    ).toBe("true")
  })

  it("går rundt fra siste til første", async () => {
    const siste = document.getElementById("fane-3") as HTMLElement
    siste.click()
    await tegn()
    siste.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    await tegn()

    expect(document.activeElement?.id).toBe("fane-1")
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
    ;(document.getElementById("fane-2") as HTMLElement).click()
    await tegn()

    expect(meldinger).toEqual([1])
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
