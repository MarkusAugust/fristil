/// <reference path="./types/css.d.ts" />
/// Uten denne er Vitests `CDPSession` et tomt grensesnitt. Det er leverandøren
/// som fyller det, og her er det Playwright som gir oss `send`.
/// <reference types="@vitest/browser-playwright" />

import { afterEach, describe, expect, it } from "vitest"
import { cdp, server, userEvent } from "vitest/browser"

import { monter, ventPaTegning } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/checkbox/checkbox.css"
import "./components/css/divider/divider.css"
import "./components/css/skeleton/skeleton.css"
import "./components/css/radio/radio.css"
import "./components/css/switch/switch.css"
import "./components/css/select/select.css"
import "./components/css/tag/tag.css"
import "./components/css/toggle-group/toggle-group.css"
import "./components/css/pagination/pagination.css"
import "./components/css/progress/progress.css"
import "./components/css/tooltip/tooltip.css"
import "./components/css/table/table.css"
import "./components/ramme/suggestion/suggestion.css"

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

  it("holder skillelinja og skjelettet synlige", async () => {
    // Begge var bare bakgrunn, og bakgrunner tvinges til sideflatens farge.
    monter(`
      <hr class="fs-divider" id="linje" />
      <hr class="fs-divider" data-variant="subtle" id="svak" />
      <div class="fs-skeleton" id="skjelett"></div>
    `)
    await settHoeykontrast(true)
    const flate = getComputedStyle(document.body).backgroundColor

    expect(stil("linje").backgroundColor).not.toBe(flate)
    expect(stil("svak").backgroundColor).not.toBe(flate)
    expect(stil("skjelett").borderTopStyle).toBe("solid")
    expect(stil("skjelett").borderTopWidth).toBe("1px")
  })

  it("lar nettleseren tegne avkryssingsboksen, radioknappen og bryteren", async () => {
    monter(`
      <input class="fs-checkbox" type="checkbox" id="boks" checked />
      <input class="fs-radio" type="radio" id="radio" checked />
      <input class="fs-switch" type="checkbox" role="switch" id="bryter" checked />
      <select class="fs-select" id="liste"><option>Valg</option></select>
      <select class="fs-select" data-picker="styled" id="liste-stylet"><option>Valg</option></select>
    `)

    await settHoeykontrast(true)

    for (const id of ["boks", "radio", "bryter", "liste", "liste-stylet"]) {
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

      <ul class="fs-suggestion__list" role="listbox">
        <li class="fs-suggestion__option" role="option" aria-selected="true" id="forslag-på">Bergen</li>
        <li class="fs-suggestion__option" role="option" aria-selected="false" id="forslag-av">Bodø</li>
      </ul>
    `)

    await settHoeykontrast(true)

    for (const [på, av] of [
      ["valgt", "uvalgt"],
      ["lapp-på", "lapp-av"],
      ["side-na", "side-annen"],
      ["forslag-på", "forslag-av"],
    ]) {
      expect(stil(på).backgroundColor, på).not.toBe(stil(av).backgroundColor)
      expect(stil(på).color, på).not.toBe(stil(av).color)
    }
  })

  it("holder gjeldende side lesbar under musa", async () => {
    // Hover-regelen slo høykontrastregelen på spesifisitet, og bakgrunnen
    // ble tvunget til `Canvas` under `HighlightText`: samme farge på begge.
    monter(`
      <ul class="fs-pagination">
        <li><a href="#" aria-current="page" id="side-na">2</a></li>
      </ul>
    `)
    await settHoeykontrast(true)

    await userEvent.hover(document.getElementById("side-na") as HTMLElement)
    await ventPaTegning()

    expect(stil("side-na").backgroundColor).not.toBe(stil("side-na").color)
    await userEvent.unhover(document.getElementById("side-na") as HTMLElement)
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

  it("tegner pila i en sorterbar kolonne i systemets tekstfarge", async () => {
    // Pila er en maske med bakgrunnsfarge, og bakgrunner tvinges til
    // sideflatens farge. Uten regelen ble den usynlig.
    monter(`
      <table class="fs-table">
        <thead><tr>
          <th scope="col" aria-sort="ascending"><button type="button" class="fs-table__sort" id="sortert">Dato</button></th>
          <th scope="col"><button type="button" class="fs-table__sort" id="usortert">Beløp</button></th>
        </tr></thead>
      </table>
    `)
    await settHoeykontrast(true)
    const flate = getComputedStyle(document.body).backgroundColor

    for (const id of ["sortert", "usortert"]) {
      const pil = getComputedStyle(
        document.getElementById(id) as HTMLElement,
        "::after",
      )
      expect(pil.backgroundColor, id).not.toBe(flate)
      expect(pil.maskImage, id).toContain("svg")
    }
  })

  it("viser at noe pågår i en ubestemt fremdriftsindikator", async () => {
    // Stripen som sveiper over, er en gradient, og gradienter fjernes i
    // modusen. Uten unntaket sto en tom ramme igjen.
    monter(`
      <progress class="fs-progress" id="ubestemt" aria-label="Laster opp"></progress>
      <span id="markering" style="color: Highlight">x</span>
      <span id="tekst" style="color: CanvasText">x</span>
    `)
    await settHoeykontrast(true)

    const ubestemt = stil("ubestemt")
    expect(ubestemt.backgroundImage).toContain("gradient")
    // Stripen er i systemets markeringsfarge, så den skiller seg fra flaten.
    expect(ubestemt.backgroundImage).toContain(stil("markering").color)
    expect(ubestemt.outlineStyle).toBe("solid")
    expect(ubestemt.outlineColor).toBe(stil("tekst").color)
  })

  it("lar tilstanden være uendret utenfor modusen", async () => {
    monter(`<input class="fs-checkbox" type="checkbox" id="boks" checked />`)
    await ventPaTegning()

    expect(stil("boks").appearance).toBe("none")
    expect(stil("boks").backgroundImage).toContain("svg")
  })
})
