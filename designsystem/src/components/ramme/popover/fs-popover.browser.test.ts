/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsPopover, type FsPopover } from "./fs-popover"
import { popover, popoverPlacements } from "./popover"

import "../../../tokens/tokens.css"
import "./popover.css"
import "../../css/button/button.css"
import "../../css/list/list.css"

/** Markupen serveren sender, bygget med byggefunksjonen og ikke for hånd. */
const BOKS = popover({ id: "panel" })

async function tegn() {
  await customElements.whenDefined("fs-popover")
  await ventPaTegning()
}

describe("fs-popover", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  beforeEach(async () => {
    monter(`
      <fs-popover placement="bottom-end" ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} class="fs-button" id="utloser">Handlinger</button>
        <ul ${attr(BOKS.panel)} data-variant="plain">
          <li><button class="fs-button" data-variant="ghost" type="button">Arkiver</button></li>
          <li><button class="fs-button" data-variant="ghost" type="button">Slett</button></li>
        </ul>
      </fs-popover>
    `)
    await tegn()
  })

  it("får koblingen fra serveren, ikke fra komponenten", () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(utloser.getAttribute("aria-expanded")).toBe("false")
    expect(utloser.getAttribute("aria-controls")).toBe("panel")
    expect(panel.getAttribute("popover")).toBe("manual")
    expect(panel.classList.contains("fs-popover")).toBe(true)
  })

  it("ber ikke malen frede noe", () => {
    // Tilstanden er brukerens, og komponenten setter den tilbake selv etter
    // en patch. Kommer `data-preserve-attr` tilbake her, har noen gjenopptatt
    // kontrakten malen måtte skrive av fra dokumentasjonen.
    const vert = document.querySelector("fs-popover") as HTMLElement
    const knapp = document.querySelector("button") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(vert.hasAttribute("data-preserve-attr")).toBe(false)
    expect(knapp.hasAttribute("data-preserve-attr")).toBe(false)
    expect(panel.hasAttribute("data-preserve-attr")).toBe(false)
  })

  it("åpner og lukker på klikk", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    utloser.click()
    await tegn()
    expect(panel.matches(":popover-open")).toBe(true)
    expect(utloser.getAttribute("aria-expanded")).toBe("true")

    utloser.click()
    await tegn()
    expect(panel.matches(":popover-open")).toBe(false)
    expect(utloser.getAttribute("aria-expanded")).toBe("false")
  })

  it("lukker på Escape og gir fokus tilbake til knappen", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement

    utloser.click()
    await tegn()

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await tegn()

    const panel = document.getElementById("panel") as HTMLElement
    expect(panel.matches(":popover-open")).toBe(false)
    expect(document.activeElement).toBe(utloser)
  })

  it("lukker ved klikk utenfor", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await tegn()

    const panel = document.getElementById("panel") as HTMLElement
    expect(panel.matches(":popover-open")).toBe(false)
  })

  it("melder fra når panelet åpnes og lukkes", async () => {
    const boks = document.querySelector("fs-popover") as HTMLElement
    const meldinger: boolean[] = []
    boks.addEventListener("popover-toggle", (event) => {
      meldinger.push((event as CustomEvent<{ open: boolean }>).detail.open)
    })

    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()
    utloser.click()
    await tegn()

    expect(meldinger).toEqual([true, false])
  })

  it("har ingen tilgjengelighetsbrudd når panelet er åpent", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()

    await forventIngenTilgjengelighetsbrudd()
  })
})

/**
 * Hvordan komponenten kjenner igjen delene sine.
 *
 * Knappen var tidligere merket med `slot="trigger"`, et levn fra den gangen
 * komponenten hadde shadow DOM. Uten en skyggerot gjør `slot` ingenting i
 * HTML, så attributtet så ut som noe annet enn det var. Nå leses koblingen
 * som uansett må være der: panelet har `popover`, og knappen peker på det
 * med `aria-controls`.
 */
describe("fs-popover finner delene sine", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  it("sender ikke ut slot i det hele tatt", () => {
    expect(Object.keys(popover({ id: "x" }).trigger)).not.toContain("slot")
  })

  it("virker på markup helt uten slot", async () => {
    monter(`
      <fs-popover ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} class="fs-button" id="bare-aria">Handlinger</button>
        <ul ${attr(BOKS.panel)}><li>Arkiver</li></ul>
      </fs-popover>
    `)
    await tegn()

    const knapp = document.getElementById("bare-aria") as HTMLButtonElement
    const panel = document.querySelector("[popover]") as HTMLElement

    expect(document.querySelectorAll("[slot]")).toHaveLength(0)

    knapp.click()
    await ventPaTegning()

    expect(panel.matches(":popover-open")).toBe(true)
    expect(knapp.getAttribute("aria-expanded")).toBe("true")
  })

  it("lar et gammelt slot-attributt stå uten å ta skade", async () => {
    // En server som ennå ikke er oppdatert sender fortsatt `slot="trigger"`.
    // Det skal ikke hindre noe: attributtet er inert uten en skyggerot.
    monter(`
      <fs-popover ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} slot="trigger" class="fs-button" id="med-slot">Handlinger</button>
        <ul ${attr(BOKS.panel)}><li>Arkiver</li></ul>
      </fs-popover>
    `)
    await tegn()

    const knapp = document.getElementById("med-slot") as HTMLButtonElement
    const panel = document.querySelector("[popover]") as HTMLElement

    knapp.click()
    await ventPaTegning()

    expect(panel.matches(":popover-open")).toBe(true)
  })
})

describe("fs-popover plasserer panelet", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  function markup(id: string, vert = "", panel = 'popover="manual"') {
    return `
      <fs-popover ${vert}>
        <button aria-controls="${id}" aria-expanded="false" class="fs-button" id="${id}-knapp">Handlinger</button>
        <ul class="fs-popover" id="${id}" ${panel}><li>Arkiver saken</li><li>Slett saken</li></ul>
      </fs-popover>
    `
  }

  async function apne(id: string) {
    ;(document.getElementById(`${id}-knapp`) as HTMLElement).click()
    await tegn()
    return {
      knapp: (
        document.getElementById(`${id}-knapp`) as HTMLElement
      ).getBoundingClientRect(),
      panel: (
        document.getElementById(id) as HTMLElement
      ).getBoundingClientRect(),
    }
  }

  it("henger under knappen, med samme venstrekant", async () => {
    monter(markup("p1"))
    await tegn()
    const { knapp, panel } = await apne("p1")

    expect(Math.abs(panel.left - knapp.left)).toBeLessThan(1.5)
    expect(Math.abs(panel.top - (knapp.bottom + 4))).toBeLessThan(1.5)
  })

  it("høyrekanter med bottom-end", async () => {
    monter(markup("p2", 'placement="bottom-end"'))
    await tegn()
    const { knapp, panel } = await apne("p2")

    expect(Math.abs(panel.right - knapp.right)).toBeLessThan(1.5)
  })

  it("lar start være høyre kant i høyre-til-venstre", async () => {
    // Posisjonen er fysisk, men `start` og `end` følger leseretningen. Med
    // logisk `inset-inline-start` og en fysisk verdi lå panelet på motsatt
    // side av knappen.
    monter(`<div dir="rtl">${markup("p3")}</div>`)
    await tegn()
    const { knapp, panel } = await apne("p3")

    expect(Math.abs(panel.right - knapp.right)).toBeLessThan(1.5)
    expect(Math.abs(panel.top - (knapp.bottom + 4))).toBeLessThan(1.5)
  })

  it("faller ned under knappen når det ikke er plass over", async () => {
    // `top-start` klemte ikke, og et panel ved toppen av siden lå helt
    // utenfor skjermen, uten å kunne rulles fram.
    monter(markup("p4", 'placement="top-start"'))
    await tegn()
    const { knapp, panel } = await apne("p4")

    expect(panel.top).toBeGreaterThanOrEqual(4)
    expect(Math.abs(panel.top - (knapp.bottom + 4))).toBeLessThan(1.5)
  })

  it("følger med når nettleseren selv lukker et auto-popover", async () => {
    // Håndskrevet markup med bare `popover` er `auto`, og da lukker
    // nettleseren panelet selv. Verten sto igjen med `open`, og neste klikk
    // på knappen gjorde ingenting synlig.
    monter(markup("p5", "", "popover"))
    await tegn()
    const vert = document.querySelector("fs-popover") as HTMLElement
    const knapp = document.getElementById("p5-knapp") as HTMLElement
    const panel = document.getElementById("p5") as HTMLElement
    const meldinger: boolean[] = []
    vert.addEventListener("popover-toggle", (e) =>
      meldinger.push((e as CustomEvent<{ open: boolean }>).detail.open),
    )

    knapp.click()
    await tegn()
    expect(vert.hasAttribute("open")).toBe(true)

    // Slik nettleseren gjør det ved lett avvisning.
    panel.hidePopover()
    await tegn()

    expect(vert.hasAttribute("open")).toBe(false)
    expect(knapp.getAttribute("aria-expanded")).toBe("false")
    expect(meldinger).toEqual([true, false])

    knapp.click()
    await tegn()
    expect(panel.matches(":popover-open")).toBe(true)
  })

  it("setter posisjonen igjen etter en patch som river style bort", async () => {
    monter(markup("p6"))
    await tegn()
    await apne("p6")
    const panel = document.getElementById("p6") as HTMLElement
    // Attributtet leses direkte: WebKit gir tom streng fra
    // `style.getPropertyValue` for en egendefinert egenskap.
    const posisjon = () => panel.getAttribute("style") ?? ""
    expect(posisjon()).toContain("--fs-popover-top")

    panel.removeAttribute("style")
    await tegn()

    expect(posisjon()).toContain("--fs-popover-top")
  })

  it("lar byggefunksjonen sette placement på verten", () => {
    expect(popover({ id: "x" }).host.placement).toBeUndefined()
    expect(popover({ id: "x", placement: "top-end" }).host.placement).toBe(
      "top-end",
    )
    expect(popoverPlacements).toEqual([
      "bottom-start",
      "bottom-end",
      "top-start",
      "top-end",
    ])
    expect(popover.isPlacement("top-end")).toBe(true)
    expect(popover.isPlacement("midt")).toBe(false)
  })
})

/*
 * Markup skrevet uten JavaScript: en knapp og et panel med klassen, uten
 * `popover`, id eller `aria-controls`. Komponenten fyller inn resten.
 */
const BAR = `
  <fs-popover>
    <button class="fs-button" id="bar-knapp">Handlinger</button>
    <ul class="fs-popover" data-variant="plain">
      <li><button class="fs-button" data-variant="ghost" type="button">Arkiver</button></li>
    </ul>
  </fs-popover>`

describe("fs-popover kobler fra bar struktur", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  function deler() {
    return {
      knapp: document.getElementById("bar-knapp") as HTMLButtonElement,
      panel: document.querySelector("ul.fs-popover") as HTMLElement,
    }
  }

  it("setter popover, id og kobling, og åpner på klikk", async () => {
    monter(BAR)
    await tegn()
    const { knapp, panel } = deler()

    expect(panel.getAttribute("popover")).toBe("manual")
    expect(panel.id).not.toBe("")
    expect(knapp.getAttribute("aria-controls")).toBe(panel.id)
    expect(knapp.getAttribute("aria-expanded")).toBe("false")

    knapp.click()
    await ventPaTegning()
    expect(panel.matches(":popover-open")).toBe(true)
    expect(knapp.getAttribute("aria-expanded")).toBe("true")

    await forventIngenTilgjengelighetsbrudd()
    ;(document.querySelector("fs-popover") as FsPopover).hide()
  })

  it("lar det serveren skrev stå", async () => {
    // `popover` uten verdi er `auto`, og det er en annen verdi enn
    // komponentens `manual`. Id-en er også serverens.
    monter(
      BAR.replace(
        '<ul class="fs-popover" data-variant="plain">',
        '<ul class="fs-popover" id="eget-panel" popover data-variant="plain">',
      ),
    )
    await tegn()
    const { knapp, panel } = deler()

    expect(panel.getAttribute("popover")).toBe("")
    expect(panel.id).toBe("eget-panel")
    expect(knapp.getAttribute("aria-controls")).toBe("eget-panel")
  })

  it("velger ikke en knapp som peker på noe annet", async () => {
    monter(
      BAR.replace(
        '<button class="fs-button" id="bar-knapp">',
        '<button class="fs-button" aria-controls="noe-annet" id="feil-knapp">Filter</button>' +
          '<button class="fs-button" id="bar-knapp">',
      ),
    )
    await tegn()
    const { knapp, panel } = deler()
    const feil = document.getElementById("feil-knapp") as HTMLElement

    expect(knapp.getAttribute("aria-controls")).toBe(panel.id)
    expect(feil.getAttribute("aria-controls")).toBe("noe-annet")
    expect(feil.hasAttribute("aria-expanded")).toBe(false)
  })

  it("setter koblingen tilbake med den samme id-en etter en patch", async () => {
    monter(BAR)
    await tegn()
    const { knapp, panel } = deler()
    const id = panel.id

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    for (const navn of ["popover", "id"]) panel.removeAttribute(navn)
    for (const navn of ["aria-controls", "aria-expanded"]) {
      knapp.removeAttribute(navn)
    }
    await ventPaTegning()

    expect(panel.id).toBe(id)
    expect(panel.getAttribute("popover")).toBe("manual")
    expect(knapp.getAttribute("aria-controls")).toBe(id)
    expect(knapp.getAttribute("aria-expanded")).toBe("false")
  })

  it("skriver ingenting på markup fra fs.popover()", async () => {
    // Den direkte påstanden bak «det serveren skrev står»: null
    // mutasjonsposter fra komponentens første runde.
    const omslag = document.createElement("div")
    omslag.innerHTML = `
      <fs-popover ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} class="fs-button">Handlinger</button>
        <ul ${attr(BOKS.panel)}><li>Arkiver</li></ul>
      </fs-popover>`
    const vert = omslag.querySelector("fs-popover") as HTMLElement
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
})
