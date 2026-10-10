/// <reference path="../../../types/css.d.ts" />
/// <reference types="@vitest/browser-playwright" />

import { beforeEach, describe, expect, it } from "vitest"
import { cdp, server, userEvent } from "vitest/browser"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { tooltip } from "./tooltip"

import "../../../tokens/tokens.css"
import "./tooltip.css"
import "../button/button.css"

describe("fs-tooltip", () => {
  beforeEach(() => {
    monter(`
      <span class="fs-tooltip">
        <button class="fs-button" data-variant="ghost" type="button"
          aria-describedby="hint" id="utloser">Arkiver</button>
        <span class="fs-tooltip__bubble" role="tooltip" id="hint">
          Saken flyttes til arkivet
        </span>
      </span>
    `)
  })

  it("viser boblen når utløseren får fokus, ikke bare på hover", () => {
    const boble = document.getElementById("hint") as HTMLElement
    expect(getComputedStyle(boble).display).toBe("none")

    ;(document.getElementById("utloser") as HTMLElement).focus()

    // En boble som bare kommer med musa finnes ikke for den som bruker
    // tastatur. Derfor :focus-within i tillegg til :hover.
    expect(getComputedStyle(boble).display).toBe("block")
  })

  it("holder teksten i tilgjengelighetstreet mens den er skjult", () => {
    const boble = document.getElementById("hint") as HTMLElement

    // Boblen er `display: none` til den vises, og teksten er likevel
    // knappens beskrivelse: `aria-describedby` tar med innholdet i et skjult
    // element det peker på (accname, steg 2A). Før var den `visibility:
    // hidden` av denne grunnen, og tok da plass og ga sidelengs rulling.
    expect(boble.textContent?.trim()).not.toBe("")
    expect(
      (document.getElementById("utloser") as HTMLElement).getAttribute(
        "aria-describedby",
      ),
    ).toBe("hint")
  })

  it("holder boblen oppe når musa flyttes fra knappen til boblen", async () => {
    // Det var et gap mellom knappen og boblen, og `:hover` slapp på vei opp.
    // Gapet skal være dekket i hele knappens bredde, ikke bare midt på.
    const utloser = document.getElementById("utloser") as HTMLElement
    const omslag = utloser.closest(".fs-tooltip") as HTMLElement
    const boble = document.getElementById("hint") as HTMLElement
    await userEvent.hover(utloser)
    try {
      await ventPaTegning()
      const knapp = utloser.getBoundingClientRect()
      const hoyde = (boble.getBoundingClientRect().bottom + knapp.top) / 2

      for (const x of [
        knapp.left + 2,
        knapp.left + knapp.width / 2,
        knapp.right - 2,
      ]) {
        expect(
          omslag.contains(document.elementFromPoint(x, hoyde)),
          `x=${x}`,
        ).toBe(true)
      }
      // Ikke bredere enn knappen: ved siden av står det som var der.
      expect(
        omslag.contains(document.elementFromPoint(knapp.right + 4, hoyde)),
      ).toBe(false)
    } finally {
      await userEvent.unhover(utloser)
    }
  })

  it.skipIf(server.browser !== "chromium")(
    "er knappens beskrivelse også mens den er skjult",
    async () => {
      // Boblen er `display: none`, og teksten skal likevel være knappens
      // beskrivelse gjennom `aria-describedby`. Tilgjengelighetstreet kan
      // bare leses over CDP, som bare Chromium har herfra.
      expect(
        getComputedStyle(document.getElementById("hint") as Element).display,
      ).toBe("none")
      const { frameTree } = (await cdp().send("Page.getFrameTree")) as {
        frameTree: {
          frame: { id: string; url: string }
          childFrames?: unknown[]
        }
      }
      type Ramme = { frame: { id: string; url: string }; childFrames?: Ramme[] }
      const finn = (ramme: Ramme): string | undefined =>
        ramme.frame.url === location.href
          ? ramme.frame.id
          : (ramme.childFrames ?? []).map(finn).find(Boolean)
      const frameId = finn(frameTree as Ramme)
      const { nodes } = (await cdp().send("Accessibility.getFullAXTree", {
        frameId,
      })) as {
        nodes: Array<{
          name?: { value?: string }
          description?: { value?: string }
          role?: { value?: string }
        }>
      }
      const knapp = nodes.find(
        (node) =>
          node.role?.value === "button" && node.name?.value === "Arkiver",
      )

      expect(knapp?.description?.value?.trim()).toBe(
        "Saken flyttes til arkivet",
      )
    },
  )

  it("tar ikke plass når den er skjult, så den ikke gir sidelengs rulling", () => {
    monter(`
      <div style="inline-size: 320px; overflow: auto" id="smal">
        <div style="display: flex; justify-content: flex-end">
          <span class="fs-tooltip">
            <button type="button" aria-describedby="kant">i</button>
            <span class="fs-tooltip__bubble" role="tooltip" id="kant">En lang forklaring som er bredere enn knappen</span>
          </span>
        </div>
      </div>`)
    const smal = document.getElementById("smal") as HTMLElement

    expect(smal.scrollWidth).toBe(smal.clientWidth)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(tooltip()).toEqual({ class: "fs-tooltip" })
    expect(tooltip.bubble).toBe("fs-tooltip__bubble")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
