/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { monter, ventPaTegning } from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./tabs.css"

/*
 * Ingen `defineFsTabs()` her, med vilje. Fila kjører i sin egen ramme, så
 * `fs-tabs` er uregistrert gjennom hele testen, og det er den tilstanden
 * regelen i `tabs.css` gjelder for: markup skrevet uten JavaScript, før
 * komponenten har rukket å skjule panelene selv.
 */
const BAR = `
  <fs-tabs>
    <div class="fs-tabs__list">
      <button>Søknaden</button>
      <button>Vedlegg</button>
      <button>Meldinger</button>
    </div>
    <div class="fs-tabs__panel">Søknaden</div>
    <div class="fs-tabs__panel">Vedlegg</div>
    <div class="fs-tabs__panel">Meldinger</div>
  </fs-tabs>`

function visning(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".fs-tabs__panel")].map(
    (panel) => getComputedStyle(panel).display,
  )
}

describe("tabs.css før komponenten er registrert", () => {
  it("viser bare det første panelet når serveren ikke sa noe", async () => {
    expect(customElements.get("fs-tabs")).toBeUndefined()
    monter(BAR)
    await ventPaTegning()

    expect(visning()).toEqual(["block", "none", "none"])
  })

  it("lar serverens hidden bestemme hvilket panel som er det første synlige", async () => {
    monter(
      BAR.replace(
        '<div class="fs-tabs__panel">Søknaden',
        '<div class="fs-tabs__panel" hidden>Søknaden',
      ),
    )
    await ventPaTegning()

    expect(visning()).toEqual(["none", "block", "none"])
  })
})
