/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

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

  it("lar rollene og id-ene serveren skrev stå", () => {
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

  it("sier fra om en aria-controls som peker på ingenting, uten å fryse", async () => {
    /*
     * Rekkefølgen er reserve bare når `aria-controls` mangler. Falt
     * komponenten tilbake på den også ved en skrivefeil, kunne to faner få
     * det samme panelet og skrive motsatt `hidden` på det i hver runde, og
     * siden frøs.
     */
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const { knapper, faner } = rad()
      const [forste, ...resten] = faner.panels
      const paneler = [...resten, forste]
        .map((panel) => `<div ${attr(panel)}>${panel.id}</div>`)
        .join("")
      monter(`
        <fs-tabs>
          <div class="fs-tabs__list" role="tablist">${knapper.replace(
            'aria-controls="sak-panel-1"',
            'aria-controls="sak-panel-1x"',
          )}</div>
          ${paneler}
        </fs-tabs>
      `)
      await tegn()
      ;(document.getElementById("sak-tab-2") as HTMLElement).click()
      await tegn()
      ;(document.getElementById("sak-tab-0") as HTMLElement).click()
      await tegn()
      await tegn()

      const hidden = (id: string) =>
        (document.getElementById(id) as HTMLElement).hidden
      expect(hidden("sak-panel-0")).toBe(false)
      expect(hidden("sak-panel-2")).toBe(true)
      expect(
        advarsel.mock.calls.some((k) => String(k[0]).includes("aria-controls")),
      ).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it("viser et panel to faner deler når en av dem er valgt", async () => {
    // En feil i markupen, men et galt svar i stillhet er verre enn å vise
    // panelet: skrev bare den første fanen, sto panelet skjult mens den
    // andre var valgt.
    const { knapper, paneler } = rad()
    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">${knapper.replace(
          'aria-controls="sak-panel-2"',
          'aria-controls="sak-panel-0"',
        )}</div>
        ${paneler}
      </fs-tabs>
    `)
    await tegn()
    ;(document.getElementById("sak-tab-2") as HTMLElement).click()
    await tegn()

    const hidden = (id: string) =>
      (document.getElementById(id) as HTMLElement).hidden
    expect(valgt()).toEqual([false, false, true])
    expect(hidden("sak-panel-0")).toBe(false)
    expect(hidden("sak-panel-1")).toBe(true)
  })

  it("flytter tabbestoppet når den valgte fanen deaktiveres av en patch", async () => {
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
    ;(document.getElementById("sak-tab-1") as HTMLButtonElement).disabled = true
    await tegn()

    const tabindex = [
      ...document.querySelectorAll<HTMLElement>("[role='tab']"),
    ].map((f) => f.tabIndex)
    // Valget står, men tabbestoppet er en fane som kan få fokus.
    expect(valgt()).toEqual([false, true, false])
    expect(tabindex).toEqual([-1, -1, 0])
  })

  it("gir en tom rad for et negativt antall", () => {
    const faner = tabs({ id: "tom", count: -1 })
    expect(faner.tabs).toEqual([])
    expect(faner.panels).toEqual([])
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

/*
 * Markup skrevet uten JavaScript: en rad med knapper og ett panel per knapp,
 * uten roller, id-er eller kobling. Komponenten fyller inn resten.
 */
const BAR = `
  <fs-tabs>
    <div class="fs-tabs__list" aria-label="Deler av saken">
      <button>Søknaden</button>
      <button>Vedlegg</button>
      <button>Meldinger</button>
    </div>
    <div class="fs-tabs__panel"><p>Søknaden ble sendt 4. mars.</p></div>
    <div class="fs-tabs__panel"><p>Tre vedlegg.</p></div>
    <div class="fs-tabs__panel"><p>Ingen meldinger.</p></div>
  </fs-tabs>`

describe("fs-tabs kobler fra bar struktur", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  function deler() {
    return {
      liste: document.querySelector(".fs-tabs__list") as HTMLElement,
      faner: [
        ...document.querySelectorAll<HTMLButtonElement>(
          ".fs-tabs__list button",
        ),
      ],
      paneler: [...document.querySelectorAll<HTMLElement>(".fs-tabs__panel")],
    }
  }

  it("setter roller, id-er, kobling, type og tabbestopp", async () => {
    monter(BAR)
    await tegn()
    const { liste, faner, paneler } = deler()

    expect(liste.getAttribute("role")).toBe("tablist")
    expect(faner.map((f) => f.getAttribute("role"))).toEqual([
      "tab",
      "tab",
      "tab",
    ])
    expect(faner.map((f) => f.type)).toEqual(["button", "button", "button"])
    expect(paneler.map((p) => p.getAttribute("role"))).toEqual([
      "tabpanel",
      "tabpanel",
      "tabpanel",
    ])
    faner.forEach((fane, i) => {
      expect(fane.id).not.toBe("")
      expect(paneler[i].id).not.toBe("")
      expect(fane.getAttribute("aria-controls")).toBe(paneler[i].id)
      expect(paneler[i].getAttribute("aria-labelledby")).toBe(fane.id)
    })
    expect(paneler.map((p) => p.tabIndex)).toEqual([0, 0, 0])

    expect(faner.map((f) => f.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ])
    expect(faner.map((f) => f.tabIndex)).toEqual([0, -1, -1])
    expect(paneler.map((p) => p.hidden)).toEqual([false, true, true])

    await forventIngenTilgjengelighetsbrudd()
  })

  it("leser valget fra hidden når ingen fane er markert", async () => {
    monter(
      BAR.replace(
        '<div class="fs-tabs__panel"><p>Søknaden',
        '<div class="fs-tabs__panel" hidden><p>Søknaden',
      ).replace(
        '<div class="fs-tabs__panel"><p>Ingen',
        '<div class="fs-tabs__panel" hidden><p>Ingen',
      ),
    )
    await tegn()
    const { faner, paneler } = deler()

    expect(faner.map((f) => f.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ])
    expect(faner.map((f) => f.tabIndex)).toEqual([-1, 0, -1])
    expect(paneler.map((p) => p.hidden)).toEqual([true, false, true])
  })

  it("lar det serveren skrev stå", async () => {
    // Verdier komponenten aldri ville skrevet selv, så testen skiller «lot
    // stå» fra «skrev det samme».
    monter(
      BAR.replace("<button>Vedlegg", '<button id="egen-fane">Vedlegg').replace(
        '<div class="fs-tabs__panel"><p>Tre',
        '<div class="fs-tabs__panel" id="eget-panel" tabindex="-1"><p>Tre',
      ),
    )
    await tegn()
    const { faner, paneler } = deler()

    expect(faner[1].id).toBe("egen-fane")
    expect(faner[1].getAttribute("aria-controls")).toBe("eget-panel")
    expect(paneler[1].getAttribute("aria-labelledby")).toBe("egen-fane")
    expect(paneler[1].tabIndex).toBe(-1)
  })

  it("setter koblingen tilbake med de samme id-ene etter en patch", async () => {
    monter(BAR)
    await tegn()
    const { faner, paneler } = deler()
    const faneId = faner[1].id
    const panelId = paneler[1].id

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    for (const navn of [
      "id",
      "role",
      "type",
      "aria-controls",
      "aria-selected",
      "tabindex",
    ]) {
      faner[1].removeAttribute(navn)
    }
    for (const navn of [
      "id",
      "role",
      "aria-labelledby",
      "tabindex",
      "hidden",
    ]) {
      paneler[1].removeAttribute(navn)
    }
    await ventPaTegning()

    expect(faner[1].id).toBe(faneId)
    expect(paneler[1].id).toBe(panelId)
    expect(faner[1].getAttribute("aria-controls")).toBe(panelId)
    expect(paneler[1].getAttribute("aria-labelledby")).toBe(faneId)
    expect(faner[1].getAttribute("role")).toBe("tab")
    expect(faner[1].getAttribute("aria-selected")).toBe("false")
    expect(paneler[1].hidden).toBe(true)
  })

  it("lar serveren bytte fane med bare hidden under server-controlled", async () => {
    /*
     * Den idiomatiske Datastar-måten: `data-attr:hidden` på hvert panel, og
     * ingenting på fanene. Komponenten hadde selv skrevet
     * `aria-selected="true"` på den første, og leste den tilbake som
     * serverens ord, så panelet serveren nettopp viste ble skjult igjen.
     */
    monter(BAR.replace("<fs-tabs>", "<fs-tabs server-controlled>"))
    await tegn()
    const { faner, paneler } = deler()
    expect(faner[0].getAttribute("aria-selected")).toBe("true")

    paneler[0].setAttribute("hidden", "")
    paneler[1].removeAttribute("hidden")
    await ventPaTegning()

    expect(paneler.map((p) => p.hidden)).toEqual([true, false, true])
    expect(faner.map((f) => f.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ])
    expect(faner.map((f) => f.tabIndex)).toEqual([-1, 0, -1])
  })

  it("lar en knapp uten rolle være i fred når serveren skrev rollene", async () => {
    monter(`
      <fs-tabs>
        <div ${attr(FANER.list)}>
          ${FANER.tabs.map((fane, i) => `<button ${attr(fane)}>${TEKST[i]}</button>`).join("")}
          <button type="button" id="lukk">Lukk</button>
        </div>
        ${FANER.panels.map((panel, i) => `<div ${attr(panel)}>${INNHOLD[i]}</div>`).join("")}
      </fs-tabs>
    `)
    await tegn()
    const lukk = document.getElementById("lukk") as HTMLButtonElement

    expect(lukk.hasAttribute("role")).toBe(false)
    expect(lukk.hasAttribute("aria-selected")).toBe(false)
    expect(lukk.tabIndex).toBe(0)
  })

  it("tar imot en ny knapp i en bar rad som en fane", async () => {
    monter(BAR)
    await tegn()
    const { liste, paneler } = deler()

    const ny = document.createElement("button")
    ny.textContent = "Historikk"
    liste.append(ny)
    const panel = document.createElement("div")
    panel.className = "fs-tabs__panel"
    paneler[2].after(panel)
    await ventPaTegning()

    expect(ny.getAttribute("role")).toBe("tab")
    expect(ny.getAttribute("aria-controls")).toBe(panel.id)
    expect(panel.hidden).toBe(true)
  })

  it("skriver ingenting på markup fra fs.tabs()", async () => {
    // Den direkte påstanden bak «det serveren skrev står»: null
    // mutasjonsposter fra komponentens første runde.
    const omslag = document.createElement("div")
    omslag.innerHTML = `
      <fs-tabs>
        <div ${attr(FANER.list)}>
          ${FANER.tabs.map((fane, i) => `<button ${attr(fane)}>${TEKST[i]}</button>`).join("")}
        </div>
        ${FANER.panels.map((panel, i) => `<div ${attr(panel)}>${INNHOLD[i]}</div>`).join("")}
      </fs-tabs>`
    const vert = omslag.querySelector("fs-tabs") as HTMLElement
    const poster: MutationRecord[] = []
    const observatør = new MutationObserver((r) => poster.push(...r))
    observatør.observe(vert, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    document.body.append(omslag)
    await tegn()

    expect(poster.map((p) => `${p.type} ${p.attributeName}`)).toEqual([])
    observatør.disconnect()
    omslag.remove()
  })

  it("holder brukerens valg gjennom en patch som tar alt komponenten skrev", async () => {
    monter(BAR)
    await tegn()
    const { faner, paneler } = deler()

    faner[2].click()
    await ventPaTegning()
    expect(paneler[2].hidden).toBe(false)

    for (const fane of faner) {
      for (const navn of ["aria-selected", "tabindex", "aria-controls"]) {
        fane.removeAttribute(navn)
      }
    }
    for (const panel of paneler) panel.removeAttribute("hidden")
    await ventPaTegning()

    expect(faner.map((f) => f.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
    ])
    expect(paneler.map((p) => p.hidden)).toEqual([true, true, false])
  })
})
