/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { monter, ventPaTegning } from "../../../testing/a11y"
import { gåTil } from "../../../testing/address"
import { defineLtTabs } from "./lt-tabs"

import "../../../tokens/tokens.css"
import "./tabs.css"

/*
 * Fila kjører i sin egen ramme, så `lt-tabs` er uregistrert til testen
 * registrerer den selv. Det er overgangen testen gjelder: det `tabs.css` viser
 * før registrering, skal være det komponenten viser etterpå (krav A4).
 */
const SIDEN = `
  <lt-tabs>
    <ul class="lt-tabs__list" aria-label="Ytre"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
    <section class="lt-tabs__panel" id="ya"><h2>YA</h2>Ytre a</section>
    <section class="lt-tabs__panel" id="yb"><h2>YB</h2>
      <lt-tabs>
        <ul class="lt-tabs__list" aria-label="Midtre"><li><a href="#ma">MA</a></li><li><a href="#mb">MB</a></li></ul>
        <section class="lt-tabs__panel" id="ma"><h3>MA</h3>Midtre a</section>
        <section class="lt-tabs__panel" id="mb"><h3>MB</h3>
          <lt-tabs server-controlled>
            <ul class="lt-tabs__list" aria-label="Indre"><li><a href="#ia">IA</a></li><li><a href="#ib">IB</a></li></ul>
            <section class="lt-tabs__panel" id="ia"><h4>IA</h4>Indre a</section>
            <section class="lt-tabs__panel" id="ib"><h4>IB</h4><p id="dypt">Dypt</p></section>
          </lt-tabs>
        </section>
      </lt-tabs>
    </section>
  </lt-tabs>
  <lt-tabs>
    <ul class="lt-tabs__list" aria-label="Ved siden av"><li><a href="#sa">SA</a></li><li><a href="#sb">SB</a></li></ul>
    <section class="lt-tabs__panel" id="sa"><h2>SA</h2>Side a</section>
    <section class="lt-tabs__panel" id="sb"><h2>SB</h2>Side b</section>
  </lt-tabs>`

const IDER = ["ya", "yb", "ma", "mb", "ia", "ib", "sa", "sb"]

/**
 * Panelene der innholdet synes. Overskriften, ikke panelet: et panel med
 * `hidden="until-found"` har boksen sin, men ikke innholdet, og svarer
 * `true` på `checkVisibility()` selv.
 */
function synlige(): string[] {
  return IDER.filter((id) =>
    (
      document.getElementById(id)?.firstElementChild as HTMLElement
    ).checkVisibility(),
  )
}

describe("overgangen fra tabs.css til komponenten", () => {
  it("viser de samme panelene før og etter registrering", async () => {
    expect(customElements.get("lt-tabs")).toBeUndefined()
    monter(SIDEN)
    await gåTil("#dypt")
    await ventPaTegning()
    const foer = synlige()

    defineLtTabs()
    await customElements.whenDefined("lt-tabs")
    await ventPaTegning()
    await ventPaTegning()

    // Treffet står i en rad med server-controlled, der adressen ikke velger.
    // De to ytre radene viser panelet med treffet, raden ved siden av den
    // første.
    expect(foer).toEqual(["yb", "mb", "ia", "sa"])
    expect(synlige()).toEqual(foer)
  })
})
