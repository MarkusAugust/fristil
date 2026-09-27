/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsTabs, type FsTabs } from "./fs-tabs"
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

  it("ber ikke malen frede noe", () => {
    // Fanevalget er brukerens, og komponenten setter det tilbake selv etter
    // en patch. Kommer `data-preserve-attr` tilbake her, har noen gjenopptatt
    // kontrakten malen måtte skrive av fra dokumentasjonen.
    const fane = document.getElementById("sak-tab-0") as HTMLElement
    const panel = document.getElementById("sak-panel-0") as HTMLElement

    expect(fane.hasAttribute("data-preserve-attr")).toBe(false)
    expect(panel.hasAttribute("data-preserve-attr")).toBe(false)
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

describe("fs-tabs leser koblingen og hopper over det som ikke kan velges", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  function rad(ekstra: { disabled?: number[]; dir?: string } = {}) {
    const faner = tabs({ id: "sak", count: 3, selected: 0 })
    const knapper = faner.tabs
      .map(
        (fane, i) =>
          `<button ${attr(fane)}${ekstra.disabled?.includes(i) ? " disabled" : ""}>${TEKST[i]}</button>`,
      )
      .join("\n")
    const paneler = faner.panels
      .map((panel, i) => `<div ${attr(panel)}><p>${INNHOLD[i]}</p></div>`)
      .join("\n")
    return { knapper, paneler, faner }
  }

  function tast(id: string, key: string) {
    const el = document.getElementById(id) as HTMLElement
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
  }

  const valgt = () =>
    [...document.querySelectorAll<HTMLElement>("[role='tab']")].map(
      (f) => f.getAttribute("aria-selected") === "true",
    )

  it("hopper over en deaktivert fane med piltastene, Home og End", async () => {
    // Uten dette valgte piltasten den deaktiverte fanen, `focus()` på en
    // deaktivert knapp gjør ingenting, og raden sto uten en eneste fane som
    // kunne få fokus. Tastaturbrukeren var låst ute.
    const { knapper, paneler } = rad({ disabled: [1] })
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${knapper}</div>
        ${paneler}
      </fs-tabs>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-0") as HTMLElement).focus()

    tast("sak-tab-0", "ArrowRight")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-2")
    expect(valgt()).toEqual([false, false, true])

    tast("sak-tab-2", "ArrowLeft")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-0")

    const { knapper: k2, paneler: p2 } = rad({ disabled: [2] })
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${k2}</div>
        ${p2}
      </fs-tabs>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-0") as HTMLElement).focus()
    tast("sak-tab-0", "End")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-1")

    const faner = document.querySelector("fs-tabs") as FsTabs
    faner.select(2)
    await tegn()
    expect(valgt()).toEqual([false, true, false])
  })

  it("går til første og siste fane med Home og End", async () => {
    const { knapper, paneler } = rad()
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${knapper}</div>
        ${paneler}
      </fs-tabs>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-1") as HTMLElement).click()
    await tegn()

    tast("sak-tab-1", "End")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-2")
    expect(valgt()).toEqual([false, false, true])

    tast("sak-tab-2", "Home")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-0")
    expect(valgt()).toEqual([true, false, false])
  })

  it("lar faner i faner være hver sin rad", async () => {
    // `querySelectorAll` over hele undertreet gjorde en indre fanerad til en
    // del av den ytre: et klikk på en indre fane skjulte det ytre panelet
    // den sto i.
    const ytre = tabs({ id: "ytre", count: 2 })
    const indre = tabs({ id: "indre", count: 2 })
    monter(`
      <fs-tabs id="ytre-rad">
        <div class="fs-tabs__list" role="tablist">
          ${ytre.tabs.map((f, i) => `<button ${attr(f)}>Ytre ${i}</button>`).join("")}
        </div>
        <div ${attr(ytre.panels[0])}>
          <fs-tabs id="indre-rad">
            <div class="fs-tabs__list" role="tablist">
              ${indre.tabs.map((f, i) => `<button ${attr(f)}>Indre ${i}</button>`).join("")}
            </div>
            <div ${attr(indre.panels[0])}>A</div>
            <div ${attr(indre.panels[1])}>B</div>
          </fs-tabs>
        </div>
        <div ${attr(ytre.panels[1])}>Ytre panel 1</div>
      </fs-tabs>
    `)
    await tegn()
    ;(document.getElementById("indre-tab-1") as HTMLElement).click()
    await tegn()

    const hidden = (id: string) =>
      (document.getElementById(id) as HTMLElement).hidden
    expect(hidden("ytre-panel-0")).toBe(false)
    expect(hidden("ytre-panel-1")).toBe(true)
    expect(hidden("indre-panel-0")).toBe(true)
    expect(hidden("indre-panel-1")).toBe(false)
    expect(
      document.getElementById("ytre-tab-0")?.getAttribute("aria-selected"),
    ).toBe("true")
  })

  it("finner panelet gjennom aria-controls, ikke gjennom rekkefølgen", async () => {
    // Koblingen står i markupen, og skal leses derfra. Med panelene i en
    // annen rekkefølge viste et klikk på fane 1 panelet til en annen fane.
    const { knapper, faner } = rad()
    const [forste, ...resten] = faner.panels
    const paneler = [...resten, forste]
      .map((panel) => `<div ${attr(panel)}>${panel.id}</div>`)
      .join("")
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${knapper}</div>
        ${paneler}
      </fs-tabs>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-1") as HTMLElement).click()
    await tegn()

    const hidden = (id: string) =>
      (document.getElementById(id) as HTMLElement).hidden
    expect(hidden("sak-panel-0")).toBe(true)
    expect(hidden("sak-panel-1")).toBe(false)
    expect(hidden("sak-panel-2")).toBe(true)
  })

  it("finner et panel som står utenfor verten", async () => {
    const { knapper, faner } = rad()
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${knapper}</div>
        <div ${attr(faner.panels[0])}>Inni</div>
      </fs-tabs>
      <div ${attr(faner.panels[1])}>Utenfor 1</div>
      <div ${attr(faner.panels[2])}>Utenfor 2</div>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-1") as HTMLElement).click()
    await tegn()

    const hidden = (id: string) =>
      (document.getElementById(id) as HTMLElement).hidden
    expect(hidden("sak-panel-0")).toBe(true)
    expect(hidden("sak-panel-1")).toBe(false)
  })

  it("lar selected settes som egenskap", async () => {
    // React 19 skriver egenskapen når den finnes, og dokumentasjonen viser
    // `faner.selected` som API. En getter alene kastet ved tilordning.
    const { knapper, paneler } = rad()
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${knapper}</div>
        ${paneler}
      </fs-tabs>
    `)
    await tegn()

    const meldinger: number[] = []
    const faner = document.querySelector("fs-tabs") as FsTabs
    faner.addEventListener("tab-select", (h) => {
      meldinger.push((h as CustomEvent<{ index: number }>).detail.index)
    })
    faner.selected = 2
    await tegn()

    expect(faner.selected).toBe(2)
    expect(valgt()).toEqual([false, false, true])
    expect(meldinger).toEqual([2])
  })

  it("snur venstre og høyre pil i høyre-til-venstre", async () => {
    // I en side som leses fra høyre står neste fane til venstre. Uten dette
    // flyttet høyrepil fokus visuelt bakover.
    const { knapper, paneler } = rad()
    monter(`
      <div dir="rtl">
        <fs-tabs>
          <div class="fs-tabs__list" role="tablist">${knapper}</div>
          ${paneler}
        </fs-tabs>
      </div>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-1") as HTMLElement).click()
    await tegn()

    tast("sak-tab-1", "ArrowRight")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-0")

    tast("sak-tab-0", "ArrowLeft")
    await tegn()
    expect(document.activeElement?.id).toBe("sak-tab-1")
  })
})
