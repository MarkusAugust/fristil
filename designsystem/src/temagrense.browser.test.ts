/// <reference path="./types/css.d.ts" />

import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { farge, rgb } from "./testing/farge"
import { contrastRatio } from "./tokens/color"

import "./tokens/tokens.css"
import "./components/css/button/button.css"
import "./components/css/card/card.css"
import "./components/css/paragraph/paragraph.css"
import "./components/frittstaende/toast/toast.css"

/**
 * At en temagrense gir alt under seg temaet, ikke bare fargetokenene.
 *
 * `monter()` setter sidens flate på `body`, og skjulte dermed at en
 * `<div data-theme="dark">` sto gjennomsiktig. Testene her bygger siden selv,
 * slik «Kom i gang» sier en konsument skal gjøre det.
 */

function kontrast(a: string, b: string): number {
  return contrastRatio(rgb(a), rgb(b))
}

/** Den første bakgrunnen som ikke er gjennomsiktig, oppover fra elementet. */
function flaten(element: Element | null): string {
  let node = element
  while (node) {
    const bakgrunn = getComputedStyle(node).backgroundColor
    if (rgb(bakgrunn).a > 0) return bakgrunn
    node = node.parentElement
  }
  return "rgb(255, 255, 255)"
}

function side(html: string) {
  document.body.style.background = "var(--fs-color-neutral-canvas)"
  document.body.style.color = "var(--fs-color-neutral-text)"
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ""
  document.body.removeAttribute("style")
  document.documentElement.removeAttribute("data-theme")
})

describe("en temagrense", () => {
  it("gir en mørk seksjon på en lys side mørk flate og lesbar tekst", () => {
    side(`
      <div data-theme="dark" id="seksjon">
        <p class="fs-paragraph" id="avsnitt">Tekst</p>
        Tekst uten klasse
      </div>`)
    const seksjon = document.getElementById("seksjon") as HTMLElement
    const avsnitt = document.getElementById("avsnitt") as HTMLElement

    // Før var seksjonen gjennomsiktig, og avsnittet 1,23:1 mot sidens hvite.
    expect(getComputedStyle(seksjon).backgroundColor).toBe(
      farge("--fs-color-neutral-canvas", "dark"),
    )
    expect(
      kontrast(getComputedStyle(avsnitt).color, flaten(avsnitt)),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      kontrast(getComputedStyle(seksjon).color, flaten(seksjon)),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("lar en komponent med data-theme beholde sin egen flate", () => {
    side(
      `<div data-theme="dark" class="fs-card" data-variant="filled" id="kort">Kort</div>`,
    )
    const kort = document.getElementById("kort") as HTMLElement

    expect(getComputedStyle(kort).backgroundColor).toBe(
      farge("--fs-color-neutral-surface", "dark"),
    )
  })

  it("maler ikke roten", () => {
    // En bakgrunn på `<html>` stopper sidens egen `body`-bakgrunn fra å fylle
    // vinduet. Pakken kan være gjest på en side den ikke eier.
    document.documentElement.setAttribute("data-theme", "dark")
    side("<p>Tekst</p>")

    expect(getComputedStyle(document.documentElement).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    )
  })

  it("gir ikke meldingskolonnen en flate", () => {
    side(`<fs-toast data-theme="dark" id="meldinger"></fs-toast>`)

    expect(
      getComputedStyle(document.getElementById("meldinger") as Element)
        .backgroundColor,
    ).toBe("rgba(0, 0, 0, 0)")
  })

  it("rører ikke et data-theme uten temablokk", () => {
    side(`<div data-theme="auto" id="auto">Tekst</div>`)
    const auto = document.getElementById("auto") as HTMLElement

    expect(getComputedStyle(auto).backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("gir fokusringen og avslått tilstand temaet til seksjonen", async () => {
    side(`
      <div data-theme="dark">
        <button class="fs-button" id="knapp" type="button">Knapp</button>
        <button class="fs-button" id="av" type="button" disabled>Av</button>
      </div>`)
    const knapp = document.getElementById("knapp") as HTMLElement
    await userEvent.tab()
    expect(document.activeElement).toBe(knapp)

    // Før arvet seksjonen ringen og den avslåtte flaten ferdig utregnet fra
    // `:root`, altså lyst tema: 2,4:1 mot den mørke flaten.
    expect(getComputedStyle(knapp).outlineColor).toBe(
      farge("--fs-color-accent-border-strong", "dark"),
    )
    expect(
      getComputedStyle(document.getElementById("av") as HTMLElement)
        .backgroundColor,
    ).toBe(farge("--fs-color-neutral-raised", "dark"))
  })

  it("gir en lys seksjon på en mørk side den lyse fokusringen", async () => {
    document.documentElement.setAttribute("data-theme", "dark")
    side(`
      <div data-theme="light">
        <button class="fs-button" id="knapp" type="button">Knapp</button>
      </div>`)
    await userEvent.tab()

    expect(
      getComputedStyle(document.getElementById("knapp") as HTMLElement)
        .outlineColor,
    ).toBe(farge("--fs-color-accent-border-strong", "light"))
  })

  it("lar fokusringen følge et generert tema i en seksjon", async () => {
    const stil = document.createElement("style")
    stil.textContent = `
      @layer fristil, fristil-tema;
      @layer fristil-tema {
        [data-theme="dark"] { --fs-color-accent-border-strong: #ff0000; }
      }`
    document.head.append(stil)
    try {
      side(`
        <div data-theme="dark">
          <button class="fs-button" id="knapp" type="button">Knapp</button>
        </div>`)
      await userEvent.tab()

      expect(
        getComputedStyle(document.getElementById("knapp") as HTMLElement)
          .outlineColor,
      ).toBe("rgb(255, 0, 0)")
    } finally {
      stil.remove()
    }
  })
})
