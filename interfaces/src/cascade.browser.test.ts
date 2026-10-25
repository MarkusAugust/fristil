/// <reference path="./types/css.d.ts" />

/*
 * States that lost in the cascade.
 *
 * Every bug here had the same shape: two rules with equal specificity, or a
 * hover raised above the state, and the outcome decided by the order in the
 * file or by the order the stylesheets were loaded in. The resting state
 * was correct in each of them, so the tests that only read it saw nothing.
 *
 * The cases that need the mouse are in `hover.browser.test.ts`. The browser
 * page has one mouse, and two files hovering at the same time move it for
 * each other.
 */

import { beforeEach, describe, expect, it } from "vitest"
import inputKilde from "./components/css/input/input.css?inline"
import sokKilde from "./components/css/search/search.css?inline"
import { mount, waitForPaint } from "./testing/a11y"
import { contrastRatio } from "./tokens/color.js"
import tokenKilde from "./tokens/tokens.css?inline"

import "./tokens/tokens.css"
import "./components/css/button/button.css"
import "./components/css/label/label.css"
import "./components/css/fieldset/fieldset.css"

function stil(id: string, pseudo?: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}`)
  return getComputedStyle(element, pseudo)
}

/** `rgb(r, g, b)` from the browser to the numbers the contrast calculation takes. */
function tilRgb(verdi: string) {
  const [r, g, b] = (verdi.match(/[\d.]+/g) ?? []).map(Number)
  return { r, g, b }
}

function utseende(id: string) {
  const s = stil(id)
  return [s.backgroundColor, s.color, s.borderTopColor].join(" / ")
}

describe("disabled button", () => {
  const VARIANTER = ["secondary", "ghost", "danger"] as const

  beforeEach(() => {
    mount(`
      <button class="lt-button" id="primary" disabled>Send</button>
      ${VARIANTER.map(
        (v) => `
        <button class="lt-button" data-variant="${v}" id="${v}-pa">Aktiv</button>
        <button class="lt-button" data-variant="${v}" id="${v}-av" disabled>Av</button>
        <button class="lt-button" data-variant="${v}" id="${v}-aria" aria-disabled="true">Av</button>`,
      ).join("")}
    `)
  })

  for (const variant of VARIANTER) {
    it(`looks disabled also as ${variant}`, () => {
      expect(utseende(`${variant}-av`)).toBe(utseende("primary"))
      expect(utseende(`${variant}-aria`)).toBe(utseende("primary"))
      expect(utseende(`${variant}-av`)).not.toBe(utseende(`${variant}-pa`))
    })
  }
})

describe("the search field when input.css loads last", () => {
  it("keeps the icon in every state", async () => {
    /*
     * A separate document, since the order is the whole point: the consumer
     * links `search.css` and then `input.css`. `?inline` of `search.css`
     * already has `input.css` in it first, and then it is added once more
     * afterwards.
     */
    const ramme = document.createElement("iframe")
    document.body.append(ramme)
    const dokument = ramme.contentDocument as Document
    dokument.open()
    dokument.write(`<!doctype html>
      <style>${tokenKilde}</style>
      <style>${sokKilde}</style>
      <style>${inputKilde}</style>
      <input class="lt-input lt-search" id="vanlig" />
      <input class="lt-input lt-search" id="ugyldig" data-state="invalid" />
      <input class="lt-input lt-search" id="gyldig" data-state="success" />
      <input class="lt-input lt-search" id="av" disabled />`)
    dokument.close()
    await waitForPaint()

    for (const id of ["vanlig", "ugyldig", "gyldig", "av"]) {
      const felt = dokument.getElementById(id) as HTMLElement
      expect(getComputedStyle(felt).backgroundImage, id).not.toBe("none")
    }
    // The state must still colour the surface.
    expect(
      getComputedStyle(dokument.getElementById("ugyldig") as HTMLElement)
        .backgroundColor,
    ).not.toBe(
      getComputedStyle(dokument.getElementById("vanlig") as HTMLElement)
        .backgroundColor,
    )
    ramme.remove()
  })
})

describe("the markers on label and legend", () => {
  beforeEach(() => {
    mount(`
      <label class="lt-label" id="l-tekst" data-required="text">Navn</label>
      <label class="lt-label" id="l-valgfri" data-optional>Navn</label>
      <label class="lt-label" id="l-begge" data-required="symbol" data-optional>Navn</label>
      <fieldset class="lt-fieldset">
        <legend class="lt-legend" id="g-tekst" data-required="text">Kontakt</legend>
      </fieldset>
      <fieldset class="lt-fieldset">
        <legend class="lt-legend" id="g-valgfri" data-optional>Kontakt</legend>
      </fieldset>
      <fieldset class="lt-fieldset">
        <legend class="lt-legend" id="g-begge" data-required="text" data-optional>Kontakt</legend>
      </fieldset>
    `)
  })

  it("shows the required text on both label and legend", () => {
    // That the stylesheet stays ASCII outside comments is guarded by
    // `package-css`.
    expect(stil("l-tekst", "::after").content).toBe('" (required)"')
    expect(stil("g-tekst", "::after").content).toBe('" (required)"')
  })

  it("shows required when the markup has both markers", () => {
    // The builder function picks required. The CSS picked "(optional)",
    // because that rule came last.
    expect(stil("l-begge", "::after").content).toBe('" *"')
    expect(stil("g-begge", "::after").content).toBe('" (required)"')
  })

  it('gives "(optional)" enough contrast to be read', () => {
    for (const id of ["l-valgfri", "g-valgfri"]) {
      const merke = stil(id, "::after")
      expect(merke.content).toBe('" (optional)"')

      const tekst = tilRgb(merke.color)
      const flate = tilRgb(getComputedStyle(document.body).backgroundColor)
      expect(contrastRatio(tekst, flate), id).toBeGreaterThanOrEqual(4.5)
    }
  })
})
