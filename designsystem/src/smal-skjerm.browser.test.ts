/// <reference path="./types/css.d.ts" />

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { page } from "vitest/browser"

import { defineFs } from "./register"
import { monter, ventPaTegning } from "./testing/a11y"

import "./tokens/tokens.css"

// Hvert stilark i hver komponentmappe, så ingen komponent kan bli glemt her.
import.meta.glob("./components/*/*/*.css", { eager: true })

/**
 * At komponentene holder seg innenfor skjermen på en telefon.
 *
 * En komponent som blir bredere enn skjermen, gjør at hele siden kan dras
 * sidelengs. Det er en av de vanligste feilene i et designsystem, og den ses
 * ikke i et utviklingsvindu på 1400 piksler.
 *
 * Vinduet selv settes til 320 piksler, ikke bare en boks i et bredt vindu.
 * En dialog, et sprettoppvindu og en melding regner bredden sin ut fra
 * vinduet, og står i topplaget eller med `position: fixed`, der de ikke
 * gjør siden bredere, men kan stikke utenfor skjermen likevel. Testen sjekker
 * derfor begge: at siden ikke kan rulles sidelengs, og at alt som står fast
 * eller i topplaget, står innenfor.
 *
 * Teksten er med vilje lang og norsk: det er «Send søknaden om bostøtte for
 * hele kalenderåret 2026» som sprenger en knapp, ikke «Send».
 */

/** Bredden på en liten telefon. */
const SMAL = 320

const LANG = "Send søknaden om bostøtte for hele kalenderåret 2026"

type Tilfelle = {
  markup: string
  /** Det som åpner komponenten eller viser tilstanden som skal sjekkes. */
  aapne?: () => void | Promise<void>
}

function element<T extends Element>(selektor: string): T {
  const funnet = document.querySelector<T>(selektor)
  if (!funnet) throw new Error(`Mangler ${selektor}`)
  return funnet
}

/** Ett tilfelle per komponentmappe, med navnet på mappa som nøkkel. */
const KOMPONENTER: Record<string, Tilfelle[]> = {
  accordion: [
    {
      markup: `<details class="fs-accordion" open>
        <summary>Hvem kan søke om bostøtte for hele kalenderåret 2026?</summary>
        <p>Alle over 18 år som bor i en godkjent bolig.</p>
      </details>`,
    },
  ],
  alert: [
    {
      markup: `<div class="fs-alert" data-color="danger">
        <p class="fs-alert__title">Søknaden ble ikke sendt</p>
        <p>Nettverket svarte ikke. Prøv igjen om litt.</p>
      </div>`,
    },
  ],
  avatar: [
    {
      markup: `<span class="fs-avatar" data-size="lg" role="img" aria-label="Kari Nordmann">KN</span>`,
    },
  ],
  badge: [
    {
      markup: `<span class="fs-badge" data-color="warning">Venter på dokumentasjon fra arbeidsgiver</span>`,
    },
  ],
  breadcrumbs: [
    {
      markup: `<ol class="fs-breadcrumbs">
        <li><a href="#">Forsiden</a></li>
        <li><a href="#">Mine saker og søknader</a></li>
        <li><a href="#" aria-current="page">Søknad 2026-0481</a></li>
      </ol>`,
    },
  ],
  button: [
    { markup: `<button class="fs-button">${LANG}</button>` },
    {
      markup: `<div style="white-space: nowrap">
        <button class="fs-button">${LANG}</button>
      </div>`,
    },
    {
      markup: `<button class="fs-button">Send søknaden nå</button>
        <button class="fs-button" data-variant="secondary">Lagre som utkast</button>`,
    },
  ],
  card: [
    {
      markup: `<div class="fs-card">
        <h3 class="fs-card__title">Søknad om bostøtte for 2026</h3>
        <p>Sendt 4. mars. Saksnummer 2026-0481.</p>
      </div>`,
    },
  ],
  checkbox: [
    {
      markup: `<label><input class="fs-checkbox" type="checkbox" /> Jeg bekrefter at opplysningene i søknaden er riktige og fullstendige</label>`,
    },
  ],
  divider: [{ markup: `<hr class="fs-divider" />` }],
  "error-text": [
    {
      markup: `<p class="fs-error-text">Skriv fødselsnummeret med elleve siffer, uten mellomrom eller bindestrek</p>`,
    },
  ],
  fieldset: [
    {
      markup: `<fieldset class="fs-fieldset">
        <legend class="fs-legend">Hvem bor i husstanden sammen med deg i 2026?</legend>
        <label><input class="fs-radio" type="radio" name="h" /> Bare meg</label>
      </fieldset>`,
    },
  ],
  "file-upload": [
    { markup: `<input class="fs-file-upload" type="file" multiple />` },
    {
      markup: `<ul class="fs-file-upload-list">
        <li>
          soknad-om-bostotte-2026-vedlegg-1.pdf
          <button class="fs-button" data-variant="ghost" type="button">Fjern soknad-om-bostotte-2026-vedlegg-1.pdf</button>
        </li>
      </ul>`,
    },
  ],
  heading: [
    {
      markup: `<h1 class="fs-heading" data-size="xl">Søknad om bostøtte for hele kalenderåret 2026</h1>`,
    },
  ],
  "help-text": [
    {
      markup: `<p class="fs-help-text">Elleve siffer. Du finner det på bankkortet eller i skattemeldingen.</p>`,
    },
  ],
  input: [
    { markup: `<input class="fs-input" value="${LANG}" />` },
    { markup: `<input class="fs-input" type="date" data-variant="date" />` },
  ],
  label: [
    {
      markup: `<label class="fs-label" data-required>Fødselsnummer til den som søker om bostøtte</label>`,
    },
  ],
  link: [
    {
      markup: `<a class="fs-link" href="#">Les mer om hvem som kan søke om bostøtte for hele kalenderåret 2026</a>`,
    },
  ],
  list: [
    {
      markup: `<ul class="fs-list">
        <li>Lønnsslipp for de tre siste månedene før søknaden ble sendt</li>
        <li>Husleiekontrakt</li>
      </ul>`,
    },
  ],
  pagination: [
    {
      markup: `<ul class="fs-pagination">
        <li><a href="#">Forrige</a></li><li><a href="#">1</a></li><li><a href="#">2</a></li>
        <li><a href="#">3</a></li><li><a href="#">4</a></li><li><a href="#">Neste</a></li>
      </ul>`,
    },
  ],
  paragraph: [
    {
      markup: `<p class="fs-paragraph">Søknadsfristen er 1. mars. Vi behandler søknaden innen fire uker, og sender svaret til innboksen din.</p>`,
    },
  ],
  progress: [
    {
      markup: `<progress class="fs-progress" value="40" max="100" aria-label="Lastet opp"></progress>
        <progress class="fs-progress" aria-label="Laster opp"></progress>`,
    },
  ],
  radio: [
    {
      markup: `<label><input class="fs-radio" type="radio" name="r" /> Jeg leier en kommunal bolig gjennom hele kalenderåret 2026</label>`,
    },
  ],
  search: [
    {
      markup: `<input class="fs-input fs-search" type="search" aria-label="Søk" value="${LANG}" />`,
    },
  ],
  select: [
    {
      markup: `<select class="fs-select" aria-label="Kommune">
        <option>Bergen</option>
        <option>Nordre Follo og omegn interkommunale bostøttekontor</option>
      </select>`,
    },
  ],
  skeleton: [{ markup: `<div class="fs-skeleton"></div>` }],
  "skip-link": [
    {
      markup: `<a class="fs-skip-link" href="#hoved">Hopp til hovedinnholdet på siden om bostøtte</a>`,
      // Lenken står utenfor synet til den får fokus.
      aapne: () => element<HTMLAnchorElement>(".fs-skip-link").focus(),
    },
  ],
  spinner: [
    {
      markup: `<span class="fs-spinner" role="status" aria-label="Laster saken"></span>`,
    },
  ],
  "sr-only": [
    {
      markup: `<span class="fs-sr-only">${LANG}, og en lang forklaring bare skjermlesere hører</span>`,
    },
  ],
  switch: [
    {
      markup: `<label><input class="fs-switch" type="checkbox" role="switch" /> Send meg varsel på SMS når saken er ferdig behandlet</label>`,
    },
  ],
  table: [
    {
      markup: `<div class="fs-table-scroll" tabindex="0">
        <table class="fs-table">
          <thead><tr><th>Fakturanummer</th><th>Forfallsdato</th><th>Beløp</th></tr></thead>
          <tbody><tr><td>2026-0481</td><td>4. mars 2026</td><td>1 240 kr</td></tr></tbody>
        </table>
      </div>`,
    },
  ],
  tag: [
    {
      markup: `<button class="fs-tag" data-selectable aria-pressed="true">Under behandling</button>
        <button class="fs-tag" data-selectable aria-pressed="false">Ferdig behandlet</button>`,
    },
  ],
  textarea: [
    {
      markup: `<textarea class="fs-textarea" aria-label="Begrunnelse">${LANG}</textarea>`,
    },
  ],
  "toggle-group": [
    {
      markup: `<fieldset class="fs-toggle-group">
        <legend>Visning</legend>
        <label class="fs-toggle-group__option"><input type="radio" name="v" checked /> Liste over saker</label>
        <label class="fs-toggle-group__option"><input type="radio" name="v" /> Kalendervisning</label>
      </fieldset>`,
    },
  ],
  tooltip: [
    {
      markup: `<span class="fs-tooltip">
        <button class="fs-button" type="button" aria-describedby="hint">Arkiver</button>
        <span class="fs-tooltip__bubble" role="tooltip" id="hint" style="display: block">Saken flyttes til arkivet, og kan hentes fram igjen senere</span>
      </span>`,
    },
  ],

  "connection-status": [
    {
      markup: `<fs-connection-status></fs-connection-status>`,
      aapne: async () => {
        const status = element<HTMLElement & { reportFailure(): void }>(
          "fs-connection-status",
        )
        status.reportFailure()
      },
    },
  ],
  toast: [
    {
      markup: `<fs-toast></fs-toast>`,
      aapne: () =>
        element<HTMLElement & { show(text: string): void }>("fs-toast").show(
          `${LANG} er mottatt, og du får svar innen fire uker`,
        ),
    },
  ],

  dialog: [
    {
      markup: `<fs-dialog open>
        <dialog class="fs-dialog" aria-labelledby="boks-tittel" open>
          <h2 class="fs-dialog__title" id="boks-tittel">Vil du trekke søknaden om bostøtte for hele kalenderåret 2026?</h2>
          <div class="fs-dialog__body"><p>Saken blir avsluttet, og du må søke på nytt.</p></div>
          <form method="dialog" class="fs-dialog__footer">
            <button class="fs-button" value="trekk">Trekk søknaden</button>
            <button class="fs-button" data-variant="secondary" value="avbryt">Avbryt</button>
          </form>
        </dialog>
      </fs-dialog>`,
    },
  ],
  "error-summary": [
    {
      markup: `<fs-error-summary class="fs-error-summary" role="alert" tabindex="-1" data-autofocus="false">
        <h2 class="fs-error-summary__title">Skjemaet har to feil som må rettes før du kan sende</h2>
        <ul class="fs-list">
          <li><a href="#fnr">Skriv fødselsnummeret med elleve siffer, uten mellomrom</a></li>
          <li><a href="#kommune">Velg kommunen du bodde i 1. januar 2026</a></li>
        </ul>
      </fs-error-summary>`,
    },
  ],
  field: [
    {
      markup: `<fs-field invalid>
        <label class="fs-label">E-postadressen vi skal sende vedtaket til</label>
        <input class="fs-input" value="kari.nordmann.med.et.langt.navn@eksempel.no" />
        <p class="fs-help-text">Vi sender aldri reklame eller nyhetsbrev.</p>
        <p class="fs-error-text">Skriv en e-postadresse med @ og et domene</p>
      </fs-field>`,
    },
  ],
  popover: [
    {
      markup: `<fs-popover open>
        <button class="fs-button" aria-expanded="false" aria-controls="handlinger">Handlinger</button>
        <div popover id="handlinger" class="fs-popover__panel">
          <p>Flytt saken til en annen saksbehandler i det samme kontoret</p>
        </div>
      </fs-popover>`,
    },
  ],
  "session-timeout": [
    {
      markup: `<fs-session-timeout warn-at="600" expires-at="900">
        <dialog class="fs-session-timeout__dialog" role="alertdialog" aria-labelledby="okt-tittel">
          <h2 class="fs-session-timeout__title" id="okt-tittel">Du blir snart logget ut av søknaden om bostøtte</h2>
          <p class="fs-session-timeout__text">Vi logger deg ut om
            <span class="fs-session-timeout__count" aria-hidden="true"></span>.</p>
          <span class="fs-sr-only" role="status"></span>
          <form method="dialog" class="fs-session-timeout__actions">
            <button class="fs-button" value="extend">Fortsett å være innlogget</button>
            <button class="fs-button" data-variant="secondary" value="logout">Logg ut nå</button>
          </form>
        </dialog>
      </fs-session-timeout>`,
      // Varselet som om tiden var nesten ute.
      aapne: () =>
        element<HTMLDialogElement>(".fs-session-timeout__dialog").showModal(),
    },
  ],
  suggestion: [
    {
      markup: `<fs-suggestion>
        <label class="fs-label" for="kommune">Kommune</label>
        <input class="fs-input" id="kommune" role="combobox" aria-expanded="false"
               aria-controls="kommuner" aria-autocomplete="list" />
        <ul class="fs-suggestion__list" id="kommuner" role="listbox" hidden>
          <li class="fs-suggestion__option" role="option" aria-selected="false">Bergen</li>
          <li class="fs-suggestion__option" role="option" aria-selected="false">Bjørnafjorden og omegn interkommunale bostøttekontor</li>
        </ul>
        <span class="fs-sr-only" role="status" aria-live="polite"></span>
      </fs-suggestion>`,
      aapne: () => {
        const felt = element<HTMLInputElement>("#kommune")
        felt.focus()
        felt.value = "B"
        felt.dispatchEvent(new InputEvent("input", { bubbles: true }))
      },
    },
  ],
  tabs: [
    {
      markup: `<fs-tabs>
        <div class="fs-tabs__list">
          <button>Søknaden</button><button>Vedlegg og dokumentasjon</button>
          <button>Vedtak</button><button>Klage på vedtaket</button>
        </div>
        <div class="fs-tabs__panel">Søknaden kom 3. mars.</div>
        <div class="fs-tabs__panel" hidden>To vedlegg.</div>
        <div class="fs-tabs__panel" hidden>Ikke behandlet ennå.</div>
        <div class="fs-tabs__panel" hidden>Ingen klage.</div>
      </fs-tabs>`,
    },
  ],
}

/** Komponentmappene, lest fra testfilene. Hver mappe har en, se `sjekk-testfiler.ts`. */
const MAPPER = Object.keys(
  import.meta.glob("./components/*/*/*.browser.test.ts"),
).map((sti) => sti.split("/")[3])

const TILFELLER = Object.entries(KOMPONENTER).flatMap(([mappe, liste]) =>
  liste.map((tilfelle, i) => [`${mappe} #${i + 1}`, tilfelle] as const),
)

describe(`komponentene i et vindu på ${SMAL} piksler`, () => {
  beforeAll(async () => {
    defineFs()
    await page.viewport(SMAL, 640)
  })

  afterAll(async () => {
    document.body.innerHTML = ""
    // Vitests standardvindu, så testene som kjører etter i den samme
    // nettleseren, ikke arver telefonbredden.
    await page.viewport(414, 896)
  })

  it("har et tilfelle for hver komponentmappe", () => {
    expect(MAPPER.length).toBeGreaterThan(40)
    expect(Object.keys(KOMPONENTER).sort()).toEqual([...new Set(MAPPER)].sort())
  })

  it.each(TILFELLER)("%s holder seg innenfor", async (_navn, tilfelle) => {
    monter(tilfelle.markup)
    await ventPaTegning()
    await tilfelle.aapne?.()
    await ventPaTegning()
    await ventPaTegning()

    expect(window.innerWidth).toBe(SMAL)

    // Siden kan ikke rulles sidelengs.
    const rot = document.documentElement
    expect(rot.scrollWidth, "siden er bredere enn vinduet").toBeLessThanOrEqual(
      rot.clientWidth,
    )

    // Og det som står fast eller i topplaget, står innenfor vinduet. Det
    // gjør ikke siden bredere, så linja over ser det ikke.
    let sjekket = 0
    for (const node of document.querySelectorAll("body *")) {
      const stil = getComputedStyle(node)
      const fast = stil.position === "fixed"
      const toppen = node.matches(":modal, :popover-open")
      if (!fast && !toppen) continue
      if (stil.display === "none" || stil.visibility === "hidden") continue
      const boks = node.getBoundingClientRect()
      if (boks.width === 0 && boks.height === 0) continue
      expect(
        boks.left,
        `${node.tagName}.${node.className} til venstre`,
      ).toBeGreaterThanOrEqual(-0.5)
      expect(
        boks.right,
        `${node.tagName}.${node.className} til høyre`,
      ).toBeLessThanOrEqual(SMAL + 0.5)
      sjekket += 1
    }
    if (
      [
        "dialog",
        "popover",
        "toast",
        "session-timeout",
        "connection-status",
      ].some((m) => _navn.startsWith(`${m} `))
    )
      expect(sjekket, "fant ikke det åpne elementet").toBeGreaterThan(0)

    for (const dialog of document.querySelectorAll("dialog")) dialog.close()
  })
})
