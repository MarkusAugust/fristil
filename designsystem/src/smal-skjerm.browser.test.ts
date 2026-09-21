/// <reference path="./types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { monter, ventPaTegning } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/alert/alert.css"
import "./components/css/breadcrumbs/breadcrumbs.css"
import "./components/css/button/button.css"
import "./components/css/card/card.css"
import "./components/css/file-upload/file-upload.css"
import "./components/css/input/input.css"
import "./components/css/pagination/pagination.css"
import "./components/css/table/table.css"
import "./components/css/tag/tag.css"
import "./components/css/toggle-group/toggle-group.css"
import "./components/css/tooltip/tooltip.css"

/**
 * At komponentene holder seg innenfor plassen de får.
 *
 * En komponent som blir bredere enn boksen sin, gjør at hele siden kan dras
 * sidelengs på en telefon. Det er en av de vanligste feilene i et
 * designsystem, og den ses ikke i et utviklingsvindu på 1400 piksler.
 *
 * Teksten er med vilje lang og norsk: det er «Send søknaden om bostøtte for
 * hele kalenderåret 2026» som sprenger en knapp, ikke «Send».
 */

/** Bredden på en telefon, minus litt luft på hver side. */
const SMAL = 320

const KOMPONENTER: [navn: string, markup: string][] = [
  [
    "knapp med lang ledetekst",
    `<button class="fs-button">Send søknaden om bostøtte for hele kalenderåret 2026</button>`,
  ],
  [
    "to knapper ved siden av hverandre",
    `<button class="fs-button">Send søknaden nå</button>
     <button class="fs-button" data-variant="secondary">Lagre som utkast</button>`,
  ],
  [
    "hjelpeboble med lang tekst",
    `<span class="fs-tooltip">
       <button class="fs-button" type="button" aria-describedby="hint">Arkiver</button>
       <span class="fs-tooltip__bubble" role="tooltip" id="hint">Saken flyttes til arkivet, og kan hentes fram igjen senere</span>
     </span>`,
  ],
  [
    "bred tabell i rullefeltet sitt",
    `<div class="fs-table-scroll" tabindex="0">
       <table class="fs-table">
         <thead><tr><th>Fakturanummer</th><th>Forfallsdato</th><th>Beløp</th></tr></thead>
         <tbody><tr><td>2026-0481</td><td>4. mars 2026</td><td>1 240 kr</td></tr></tbody>
       </table>
     </div>`,
  ],
  [
    "sidenavigering med mange sider",
    `<ul class="fs-pagination">
       <li><a href="#">Forrige</a></li><li><a href="#">1</a></li><li><a href="#">2</a></li>
       <li><a href="#">3</a></li><li><a href="#">4</a></li><li><a href="#">Neste</a></li>
     </ul>`,
  ],
  [
    "valggruppe med lange alternativer",
    `<fieldset class="fs-toggle-group">
       <legend>Visning</legend>
       <label class="fs-toggle-group__option"><input type="radio" name="v" checked /> Liste over saker</label>
       <label class="fs-toggle-group__option"><input type="radio" name="v" /> Kalendervisning</label>
     </fieldset>`,
  ],
  [
    "brødsmuler med lange navn",
    `<ol class="fs-breadcrumbs">
       <li><a href="#">Forsiden</a></li>
       <li><a href="#">Mine saker og søknader</a></li>
       <li><a href="#" aria-current="page">Søknad 2026-0481</a></li>
     </ol>`,
  ],
  [
    "varsel",
    `<div class="fs-alert" data-color="danger">
       <p class="fs-alert__title">Søknaden ble ikke sendt</p>
       <p>Nettverket svarte ikke. Prøv igjen om litt.</p>
     </div>`,
  ],
  [
    "kort",
    `<div class="fs-card">
       <h3 class="fs-card__title">Søknad om bostøtte for 2026</h3>
       <p>Sendt 4. mars. Saksnummer 2026-0481.</p>
     </div>`,
  ],
  [
    "merkelapper som filtre",
    `<button class="fs-tag" data-selectable aria-pressed="true">Under behandling</button>
     <button class="fs-tag" data-selectable aria-pressed="false">Ferdig behandlet</button>`,
  ],
  ["filopplasting", `<input class="fs-file-upload" type="file" multiple />`],
  ["datofelt", `<input class="fs-input" type="date" data-variant="date" />`],
]

describe(`komponentene i en boks på ${SMAL} piksler`, () => {
  it.each(KOMPONENTER)("%s holder seg innenfor", async (_navn, markup) => {
    monter(`<div id="smal" style="width: ${SMAL}px">${markup}</div>`)
    await ventPaTegning()

    const boks = document.getElementById("smal") as HTMLElement

    // scrollWidth større enn clientWidth betyr at noe inni stikker utenfor.
    expect(boks.scrollWidth).toBeLessThanOrEqual(boks.clientWidth)
  })
})
