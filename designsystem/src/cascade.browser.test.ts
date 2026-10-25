/// <reference path="./types/css.d.ts" />

/*
 * Tilstander som tapte i kaskaden.
 *
 * Alle feilene her hadde samme form: to regler med lik spesifisitet, eller en
 * hover som var løftet over tilstanden, og utfallet avgjort av rekkefølgen i
 * fila eller av rekkefølgen stilarkene ble lastet i. Hviletilstanden var
 * riktig i hver av dem, så testene som bare leser den, så ingenting.
 *
 * Tilfellene som trenger musa står i `hover.browser.test.ts`. Nettlesersiden
 * har én mus, og to filer som hoverer samtidig flytter den for hverandre.
 */

import { beforeEach, describe, expect, it } from "vitest"
import inputKilde from "./components/css/input/input.css?inline"
import sokKilde from "./components/css/search/search.css?inline"
import { monter, ventPaTegning } from "./testing/a11y"
import { contrastRatio } from "./tokens/color.js"
import tokenKilde from "./tokens/tokens.css?inline"

import "./tokens/tokens.css"
import "./components/css/button/button.css"
import "./components/css/label/label.css"
import "./components/css/fieldset/fieldset.css"

function stil(id: string, pseudo?: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Mangler #${id}`)
  return getComputedStyle(element, pseudo)
}

/** `rgb(r, g, b)` fra nettleseren til tallene kontrastregningen tar. */
function tilRgb(verdi: string) {
  const [r, g, b] = (verdi.match(/[\d.]+/g) ?? []).map(Number)
  return { r, g, b }
}

function utseende(id: string) {
  const s = stil(id)
  return [s.backgroundColor, s.color, s.borderTopColor].join(" / ")
}

describe("deaktivert knapp", () => {
  const VARIANTER = ["secondary", "ghost", "danger"] as const

  beforeEach(() => {
    monter(`
      <button class="fs-button" id="primary" disabled>Send</button>
      ${VARIANTER.map(
        (v) => `
        <button class="fs-button" data-variant="${v}" id="${v}-pa">Aktiv</button>
        <button class="fs-button" data-variant="${v}" id="${v}-av" disabled>Av</button>
        <button class="fs-button" data-variant="${v}" id="${v}-aria" aria-disabled="true">Av</button>`,
      ).join("")}
    `)
  })

  for (const variant of VARIANTER) {
    it(`ser deaktivert ut også som ${variant}`, () => {
      expect(utseende(`${variant}-av`)).toBe(utseende("primary"))
      expect(utseende(`${variant}-aria`)).toBe(utseende("primary"))
      expect(utseende(`${variant}-av`)).not.toBe(utseende(`${variant}-pa`))
    })
  }
})

describe("søkefeltet når input.css lastes sist", () => {
  it("beholder ikonet i hver tilstand", async () => {
    /*
     * Et eget dokument, siden rekkefølgen er selve saken: konsumenten lenker
     * `search.css` og så `input.css`. `?inline` av `search.css` har alt
     * `input.css` i seg først, og så legges den på en gang til etterpå.
     */
    const ramme = document.createElement("iframe")
    document.body.append(ramme)
    const dokument = ramme.contentDocument as Document
    dokument.open()
    dokument.write(`<!doctype html>
      <style>${tokenKilde}</style>
      <style>${sokKilde}</style>
      <style>${inputKilde}</style>
      <input class="fs-input fs-search" id="vanlig" />
      <input class="fs-input fs-search" id="ugyldig" data-state="invalid" />
      <input class="fs-input fs-search" id="gyldig" data-state="success" />
      <input class="fs-input fs-search" id="av" disabled />`)
    dokument.close()
    await ventPaTegning()

    for (const id of ["vanlig", "ugyldig", "gyldig", "av"]) {
      const felt = dokument.getElementById(id) as HTMLElement
      expect(getComputedStyle(felt).backgroundImage, id).not.toBe("none")
    }
    // Tilstanden skal fortsatt farge flaten.
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

describe("markeringene på ledetekst og legend", () => {
  beforeEach(() => {
    monter(`
      <label class="fs-label" id="l-tekst" data-required="text">Navn</label>
      <label class="fs-label" id="l-valgfri" data-optional>Navn</label>
      <label class="fs-label" id="l-begge" data-required="symbol" data-optional>Navn</label>
      <fieldset class="fs-fieldset">
        <legend class="fs-legend" id="g-tekst" data-required="text">Kontakt</legend>
      </fieldset>
      <fieldset class="fs-fieldset">
        <legend class="fs-legend" id="g-valgfri" data-optional>Kontakt</legend>
      </fieldset>
      <fieldset class="fs-fieldset">
        <legend class="fs-legend" id="g-begge" data-required="text" data-optional>Kontakt</legend>
      </fieldset>
    `)
  })

  it("skriver «påkrevd» riktig med escapen i stilarket", () => {
    // At tegnet står som en escape, og ikke rått, vokter `pakke-css`.
    expect(stil("l-tekst", "::after").content).toBe('" (påkrevd)"')
    expect(stil("g-tekst", "::after").content).toBe('" (påkrevd)"')
  })

  it("viser påkrevd når markupen har begge markeringene", () => {
    // Byggefunksjonen velger påkrevd. CSS-en valgte «(valgfri)», siden den
    // regelen sto sist.
    expect(stil("l-begge", "::after").content).toBe('" *"')
    expect(stil("g-begge", "::after").content).toBe('" (påkrevd)"')
  })

  it("gir «(valgfri)» kontrast nok til å leses", () => {
    for (const id of ["l-valgfri", "g-valgfri"]) {
      const merke = stil(id, "::after")
      expect(merke.content).toBe('" (valgfri)"')

      const tekst = tilRgb(merke.color)
      const flate = tilRgb(getComputedStyle(document.body).backgroundColor)
      expect(contrastRatio(tekst, flate), id).toBeGreaterThanOrEqual(4.5)
    }
  })
})
