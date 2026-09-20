/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsPopover, type FsPopover } from "./fs-popover"

import "../../../tokens/tokens.css"
import "./popover.css"
import "../../css/button/button.css"
import "../../css/list/list.css"

async function tegn() {
  const popover = document.querySelector("fs-popover") as FsPopover
  await customElements.whenDefined("fs-popover")
  await popover.updateComplete
  return popover
}

describe("fs-popover", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  beforeEach(async () => {
    monter(`
      <fs-popover placement="bottom-end">
        <button slot="trigger" class="fs-button" id="utloser">Handlinger</button>
        <ul class="fs-list" data-variant="plain" id="panel">
          <li><button class="fs-button" data-variant="ghost" type="button">Arkiver</button></li>
          <li><button class="fs-button" data-variant="ghost" type="button">Slett</button></li>
        </ul>
      </fs-popover>
    `)
    await tegn()
  })

  it("kobler knappen til panelet", () => {
    const utloser = document.getElementById("utloser") as HTMLElement

    expect(utloser.getAttribute("aria-expanded")).toBe("false")
    expect(utloser.getAttribute("aria-controls")).toBe("panel")
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
  })

  it("plasserer panelet mot knappen", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()

    const panel = document.getElementById("panel") as HTMLElement
    const topp = Number.parseFloat(
      panel.style.getPropertyValue("--fs-popover-top"),
    )

    // Panelet ligger i topplaget, så posisjonen regnes ut i stedet for å
    // arves fra en forelder. `position-anchor` finnes ennå ikke overalt.
    expect(topp).toBeGreaterThan(utloser.getBoundingClientRect().top)
  })

  it("lukker på Escape og gir fokus tilbake til knappen", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await tegn()

    expect(
      (document.getElementById("panel") as HTMLElement).matches(
        ":popover-open",
      ),
    ).toBe(false)
    expect(document.activeElement).toBe(utloser)
  })

  it("melder fra når panelet åpnes og lukkes", async () => {
    const popover = await tegn()
    const meldinger: boolean[] = []
    popover.addEventListener("popover-toggle", (hendelse) => {
      meldinger.push((hendelse as CustomEvent<{ open: boolean }>).detail.open)
    })

    popover.show()
    await tegn()
    popover.hide()
    await tegn()

    expect(meldinger).toEqual([true, false])
  })

  it("har ingen tilgjengelighetsbrudd når panelet er åpent", async () => {
    const popover = await tegn()
    popover.show()
    await tegn()
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
