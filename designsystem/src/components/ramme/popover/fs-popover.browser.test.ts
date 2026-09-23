/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsPopover } from "./fs-popover"
import { popover } from "./popover"

import "../../../tokens/tokens.css"
import "./popover.css"
import "../../css/button/button.css"
import "../../css/list/list.css"

/** Markupen serveren sender, bygget med byggeren og ikke for hånd. */
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
