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

  it("ber serveren bevare det komponenten endrer", () => {
    // Uten dette river Datastars morfing tilstanden bort ved neste patch.
    const utloser = document.getElementById("utloser") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(utloser.getAttribute("data-preserve-attr")).toBe("aria-expanded")
    expect(panel.getAttribute("data-preserve-attr")).toBe("style")

    // Om panelet er åpent er brukerens tilstand, ikke serverens.
    const vert = document.querySelector("fs-popover") as HTMLElement
    expect(vert.getAttribute("data-preserve-attr")).toBe("open")
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
