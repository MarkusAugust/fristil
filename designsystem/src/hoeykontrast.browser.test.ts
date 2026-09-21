/// <reference path="./types/css.d.ts" />
/// Uten denne er Vitests `CDPSession` et tomt grensesnitt. Det er leverandøren
/// som fyller det, og her er det Playwright som gir oss `send`.
/// <reference types="@vitest/browser-playwright" />

import { afterEach, describe, expect, it } from "vitest"
import { cdp, server } from "vitest/browser"

import { monter, ventPaTegning } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/checkbox/checkbox.css"
import "./components/css/radio/radio.css"
import "./components/css/switch/switch.css"
import "./components/css/select/select.css"
import "./components/css/tag/tag.css"
import "./components/css/toggle-group/toggle-group.css"
import "./components/css/pagination/pagination.css"
import "./components/css/tooltip/tooltip.css"

/**
 * At komponentene fortsatt viser tilstanden sin i høykontrastmodus.
 *
 * Windows' høykontrast bytter ut fargene på siden med brukerens eget sett.
 * Testet i modusen: egne farger overstyres, gradienter og `box-shadow` fjernes,
 * mens systemfargene, rammer, masker og data-URL-bilder overlever.
 *
 * Det rammer nettopp de kontrollene som viser tilstanden sin med farge eller
 * en gradient: haken i avkryssingsboksen, prikken i radioknappen, knappen i
 * bryteren og den valgte fanen i en gruppe. Uten reglene som testes her ser
 * på og av helt like ut.
 *
 * Modusen kan bare slås på i Chromium herfra, så testene hopper over de to
 * andre. Reglene er ren CSS og oppfører seg likt.
 */

async function settHoeykontrast(på: boolean) {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: på ? [{ name: "forced-colors", value: "active" }] : [],
  })
  await ventPaTegning()
}

function stil(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Mangler #${id}`)
  return getComputedStyle(element)
}

describe.skipIf(server.browser !== "chromium")("i høykontrastmodus", () => {
  afterEach(async () => {
    // Modusen gjelder hele siden, og ville ellers blitt stående og påvirket
    // testene som kjører etterpå.
    await settHoeykontrast(false)
  })

  it("lar nettleseren tegne avkryssingsboksen, radioknappen og bryteren", async () => {
    monter(`
      <input class="fs-checkbox" type="checkbox" id="boks" checked />
      <input class="fs-radio" type="radio" id="radio" checked />
      <input class="fs-switch" type="checkbox" role="switch" id="bryter" checked />
      <select class="fs-select" id="liste"><option>Valg</option></select>
    `)

    await settHoeykontrast(true)

    for (const id of ["boks", "radio", "bryter", "liste"]) {
      // `appearance: auto` gir tilbake nettleserens egen tegning, som er
      // riktig i alle temaene brukeren kan velge.
      expect(stil(id).appearance, id).toBe("auto")
      expect(stil(id).backgroundImage, id).toBe("none")
    }
  })

  it("beholder rollen på bryteren selv om formen forsvinner", async () => {
    monter(
      `<input class="fs-switch" type="checkbox" role="switch" id="bryter" checked />`,
    )

    await settHoeykontrast(true)

    const bryter = document.getElementById("bryter") as HTMLInputElement
    expect(bryter.getAttribute("role")).toBe("switch")
    expect(bryter.checked).toBe(true)
  })

  it("skiller det valgte alternativet med systemfargene", async () => {
    monter(`
      <fieldset class="fs-toggle-group">
        <legend>Visning</legend>
        <label class="fs-toggle-group__option" id="valgt">
          <input type="radio" name="visning" checked /> Liste
        </label>
        <label class="fs-toggle-group__option" id="uvalgt">
          <input type="radio" name="visning" /> Kart
        </label>
      </fieldset>

      <button class="fs-tag" data-selectable aria-pressed="true" id="lapp-på" type="button">Innvilget</button>
      <button class="fs-tag" data-selectable aria-pressed="false" id="lapp-av" type="button">Avslått</button>

      <ul class="fs-pagination">
        <li><a href="#" aria-current="page" id="side-na">2</a></li>
        <li><a href="#" id="side-annen">3</a></li>
      </ul>
    `)

    await settHoeykontrast(true)

    for (const [på, av] of [
      ["valgt", "uvalgt"],
      ["lapp-på", "lapp-av"],
      ["side-na", "side-annen"],
    ]) {
      expect(stil(på).backgroundColor, på).not.toBe(stil(av).backgroundColor)
      expect(stil(på).color, på).not.toBe(stil(av).color)
    }
  })

  it("gir hjelpeboblen en kant, så den ikke flyter oppå innholdet", async () => {
    monter(`
      <span class="fs-tooltip">
        <button type="button" aria-describedby="hint">Arkiver</button>
        <span class="fs-tooltip__bubble" role="tooltip" id="hint">Flyttes til arkivet</span>
      </span>
    `)

    await settHoeykontrast(true)

    // Uten modusen har boblen mørk flate og lys tekst, og trenger ingen kant.
    expect(stil("hint").borderTopWidth).toBe("1px")
  })

  it("lar tilstanden være uendret utenfor modusen", async () => {
    monter(`<input class="fs-checkbox" type="checkbox" id="boks" checked />`)
    await ventPaTegning()

    expect(stil("boks").appearance).toBe("none")
    expect(stil("boks").backgroundImage).toContain("svg")
  })
})
