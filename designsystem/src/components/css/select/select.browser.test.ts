/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { finnOverflyt, monterIsolert } from "../../../testing/isolert"
import { kontrast } from "../../../testing/kontrast"
import selectCss from "./select.css?inline"

import "../../../tokens/tokens.css"
import "./select.css"
import "../label/label.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-select", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="default" class="fs-select"><option>Velg</option></select>
      <select id="invalid" class="fs-select" data-state="invalid"><option>Velg</option></select>
      <select id="success" class="fs-select" data-state="success"><option>Velg</option></select>
      <select id="disabled" class="fs-select" disabled><option>Velg</option></select>
    `
  })

  it("applies default styles", () => {
    const select = css("default")

    expect(select.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(select.borderTopColor).toBe("rgb(117, 117, 117)")
    expect(select.color).toBe("rgb(26, 26, 26)")
  })

  it("applies invalid styles", () => {
    const select = css("invalid")

    expect(select.backgroundColor).toBe("rgb(247, 226, 232)")
    expect(select.borderTopColor).toBe("rgb(168, 46, 57)")
  })

  it("applies success styles", () => {
    const select = css("success")

    expect(select.backgroundColor).toBe("rgb(227, 245, 234)")
    expect(select.borderTopColor).toBe("rgb(49, 111, 42)")
  })

  it("applies disabled styles", () => {
    const select = css("disabled")

    expect(select.backgroundColor).toBe("rgb(229, 229, 229)")
    expect(select.borderTopColor).toBe("rgb(229, 229, 229)")
    expect(select.color).toBe("rgb(117, 117, 117)")
    // Markøren vises bare hvis elementet treffes av pekeren
    expect(select.pointerEvents).toBe("auto")
  })
})

describe("fs-select tilgjengelighet", () => {
  it("har nok kontrast og ledetekst i alle tilstander", async () => {
    monter(`
      <label class="fs-label" for="a11y-fylke">Fylke</label>
      <select class="fs-select" id="a11y-fylke">
        <option value="">Velg fylke</option>
        <option value="vestland">Vestland</option>
      </select>

      <label class="fs-label" for="a11y-kommune">Kommune</label>
      <select class="fs-select" id="a11y-kommune" data-state="invalid" aria-invalid="true">
        <option value="">Velg kommune</option>
      </select>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-select uten CSS-reset", () => {
  it("holder seg innenfor boksen sin", () => {
    const { boks } = monterIsolert(
      selectCss,
      `<select class="fs-select"><option>Vestland</option></select>`,
    )

    expect(finnOverflyt(boks)).toEqual([])
  })
})

describe("fs-select deaktivert", () => {
  it("viser not-allowed-markøren, og blir faktisk truffet av musa", () => {
    monter(`<select class="fs-select" disabled><option>Av</option></select>`)

    const element = document.querySelector("select") as HTMLElement
    const ramme = element.getBoundingClientRect()

    expect(getComputedStyle(element).cursor).toBe("not-allowed")

    // cursor har ingen virkning hvis elementet ikke treffes av pekeren.
    // Alle disse hadde pointer-events: none, så markøren ble aldri vist.
    expect(
      document.elementFromPoint(
        ramme.x + ramme.width / 2,
        ramme.y + ramme.height / 2,
      ),
    ).toBe(element)
  })
})

/*
 * Nedtrekkslista som tegnes i siden.
 *
 * `appearance: base-select` finnes i Chromium og WebKit, men ikke i Firefox
 * 150. Testen kjører i alle tre, og sier hva som skal skje i hver: der det
 * finnes, tegnes lista i siden; der det ikke finnes, står feltet igjen
 * nøyaktig som et vanlig felt. Begge deler er riktig oppførsel, og det er
 * grunnen til at dette er noe man slår på og ikke standarden.
 */
const harBaseSelect = CSS.supports("appearance", "base-select")

/** Leser en utregnet fargeverdi som tre tall. */
function rgb(verdi: string): [number, number, number] {
  const tall = verdi.match(/\d+/g)
  if (!tall || tall.length < 3) throw new Error(`Uleselig farge «${verdi}»`)
  return [Number(tall[0]), Number(tall[1]), Number(tall[2])]
}

/**
 * Venter til lista er ferdig tonet inn, ikke på klokka. Overgangen varer 120
 * millisekunder, og en fast venting ville feilet tilfeldig på en treg kjøring.
 */
async function ventPaListen(element: HTMLElement): Promise<void> {
  for (let i = 0; i < 90; i++) {
    if (getComputedStyle(element, "::picker(select)").opacity === "1") return
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  throw new Error("Lista åpnet seg ikke")
}

/** Lukker lista igjen, slik at den ikke står åpen inn i neste test. */
async function lukk(element: HTMLElement): Promise<void> {
  await userEvent.keyboard("{Escape}")
  await ventPaTegning(element)
}

describe('fs-select med data-picker="styled"', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="vanlig" class="fs-select">
        <option value="vestland">Vestland</option>
        <option value="rogaland">Rogaland</option>
      </select>
      <select id="stylet" class="fs-select" data-picker="styled">
        <option value="vestland">Vestland</option>
        <option value="rogaland" selected>Rogaland</option>
      </select>
    `
  })

  it("lar nettleseren tegne lista når den kan", () => {
    const stylet = css("stylet")

    if (harBaseSelect) {
      expect(stylet.appearance).toBe("base-select")
      // Pila kommer fra ::picker-icon nå, så de to gradientene skal bort.
      expect(stylet.backgroundImage).toBe("none")
    } else {
      // Firefox: attributtet gjør ingenting, og feltet ser ut som ellers.
      expect(stylet.appearance).toBe("none")
      expect(stylet.backgroundImage).toContain("gradient")
    }
  })

  it("rører ikke et felt uten attributtet", () => {
    const vanlig = css("vanlig")

    expect(vanlig.appearance).toBe("none")
    expect(vanlig.backgroundImage).toContain("gradient")
  })

  it("beholder farger og tilstand fra resten av komponenten", () => {
    const stylet = css("stylet")

    expect(stylet.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(stylet.borderTopColor).toBe("rgb(117, 117, 117)")
    expect(stylet.color).toBe("rgb(26, 26, 26)")
  })

  it("åpner lista inne i siden, med vår egen flate", async () => {
    if (!harBaseSelect) return

    const element = document.getElementById("stylet")
    if (!(element instanceof HTMLElement)) throw new Error("Fant ikke feltet")

    await userEvent.click(element)
    await ventPaListen(element)

    const liste = getComputedStyle(element, "::picker(select)")

    expect(element.matches(":open")).toBe(true)
    expect(liste.backgroundColor).toBe("rgb(255, 255, 255)")
    expect(liste.borderTopColor).toBe("rgb(117, 117, 117)")
    expect(liste.overflowY).toBe("auto")

    // Høyden animeres fra null i Chromium. Går noe galt med overgangen, står
    // lista åpen uten å være synlig, og det er en feil ingen ser i CSS-en.
    expect(Number.parseFloat(liste.blockSize)).toBeGreaterThan(40)

    await lukk(element)
  })

  it("gir det valgte alternativet vår egen markering", async () => {
    if (!harBaseSelect) return

    const element = document.getElementById("stylet")
    if (!(element instanceof HTMLElement)) throw new Error("Fant ikke feltet")

    await userEvent.click(element)
    await ventPaListen(element)

    const valgt = element.querySelector("option[value='rogaland']")
    const annet = element.querySelector("option[value='vestland']")
    if (!(valgt instanceof HTMLElement) || !(annet instanceof HTMLElement)) {
      throw new Error("Fant ikke alternativene")
    }

    expect(getComputedStyle(valgt).backgroundColor).toBe("rgb(19, 98, 174)")
    expect(getComputedStyle(valgt).color).toBe("rgb(255, 255, 255)")
    expect(getComputedStyle(annet).backgroundColor).toBe("rgb(255, 255, 255)")
    expect(getComputedStyle(annet).padding).toBe("8px 12px")

    await lukk(element)
  })
  it("skiller gruppeoverskriften fra valgene", async () => {
    if (!harBaseSelect) return

    document.body.innerHTML = `
      <select id="gruppert" class="fs-select" data-picker="styled">
        <optgroup label="Vestlandet">
          <option value="bergen">Bergen</option>
        </optgroup>
        <option value="oslo" selected>Oslo</option>
      </select>
    `

    const element = document.getElementById("gruppert")
    if (!(element instanceof HTMLElement)) throw new Error("Fant ikke feltet")

    await userEvent.click(element)
    await ventPaListen(element)

    const gruppe = element.querySelector("optgroup")
    const iGruppe = element.querySelector("option[value='bergen']")
    const utenfor = element.querySelector("option[value='oslo']")
    if (
      !(gruppe instanceof HTMLElement) ||
      !(iGruppe instanceof HTMLElement) ||
      !(utenfor instanceof HTMLElement)
    ) {
      throw new Error("Fant ikke gruppa")
    }

    // Overskriften kommer fra `label=`, og er ikke et element vi kan treffe.
    // Den arver fra gruppa, så det er gruppa som må ha verdiene.
    expect(getComputedStyle(gruppe).fontSize).toBe("14px")
    expect(getComputedStyle(gruppe).color).toBe("rgb(117, 117, 117)")
    expect(getComputedStyle(gruppe).textIndent).toBe("12px")

    // Og valgene inni må stå igjen som valgene utenfor. `oslo` er det valgte,
    // så `bergen` viser den vanlige teksten.
    expect(getComputedStyle(iGruppe).fontSize).toBe("16px")
    expect(getComputedStyle(iGruppe).color).toBe("rgb(26, 26, 26)")
    expect(getComputedStyle(iGruppe).textIndent).toBe("0px")
    expect(iGruppe.getBoundingClientRect().width).toBe(
      utenfor.getBoundingClientRect().width,
    )

    await lukk(element)
  })
})

describe("fs-select med lista i siden, tilgjengelighet", () => {
  it("har nok kontrast og ledetekst", async () => {
    monter(`
      <label class="fs-label" for="a11y-stylet">Fylke</label>
      <select class="fs-select" id="a11y-stylet" data-picker="styled">
        <optgroup label="Vestlandet">
          <option value="">Velg fylke</option>
          <option value="vestland">Vestland</option>
        </optgroup>
      </select>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })

  /*
   * axe ser ikke inn i den åpne lista. Testet: settes fargen på et valg til
   * lysegrå, melder axe fortsatt grønt, både med lista åpen og lukket. Da må
   * kontrasten regnes ut her, ellers står det en påstand i testen som ikke
   * kan feile.
   */
  it("holder kontrastkravet på valgene i den åpne lista", async () => {
    if (!harBaseSelect) return

    monter(`
      <label class="fs-label" for="kontrast-stylet">Fylke</label>
      <select class="fs-select" id="kontrast-stylet" data-picker="styled">
        <optgroup label="Vestlandet">
          <option value="bergen">Bergen</option>
          <option value="stavanger" selected>Stavanger</option>
        </optgroup>
      </select>
    `)

    const element = document.getElementById("kontrast-stylet")
    if (!(element instanceof HTMLElement)) throw new Error("Fant ikke feltet")

    await userEvent.click(element)
    await ventPaListen(element)

    const flate = rgb(
      getComputedStyle(element, "::picker(select)").backgroundColor,
    )

    for (const [navn, velger] of [
      ["et valg", "option[value='bergen']"],
      ["det valgte", "option[value='stavanger']"],
      ["gruppeoverskriften", "optgroup"],
    ] as const) {
      const del = element.querySelector(velger)
      if (!(del instanceof HTMLElement)) throw new Error(`Fant ikke ${navn}`)

      const bak = getComputedStyle(del).backgroundColor
      const bakgrunn = bak.includes("rgba(0, 0, 0, 0)") ? flate : rgb(bak)

      expect(
        kontrast(rgb(getComputedStyle(del).color), bakgrunn),
        navn,
      ).toBeGreaterThanOrEqual(4.5)
    }

    await lukk(element)
  })
})
