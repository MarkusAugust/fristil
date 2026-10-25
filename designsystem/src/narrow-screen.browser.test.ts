/// <reference path="./types/css.d.ts" />

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"

import { defineLt } from "./register"
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
 * derfor begge: at siden ikke kan rulles sidelengs, og at alt som synes,
 * står innenfor vinduet i bredden, med unntak av det som med vilje er
 * klippet. Over og under sjekkes ikke: en side ruller på høyden.
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
  /** Det som skal stå synlig etter `aapne`, så et tilfelle ikke måler en lukket komponent. */
  apen?: string
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
      markup: `<details class="lt-accordion" open>
        <summary>Hvem kan søke om bostøtte for hele kalenderåret 2026?</summary>
        <p>Alle over 18 år som bor i en godkjent bolig.</p>
      </details>`,
    },
  ],
  alert: [
    {
      markup: `<div class="lt-alert" data-color="danger">
        <p class="lt-alert__title">Søknaden ble ikke sendt</p>
        <p>Nettverket svarte ikke. Prøv igjen om litt.</p>
      </div>`,
    },
  ],
  avatar: [
    {
      markup: `<span class="lt-avatar" data-size="lg" role="img" aria-label="Kari Nordmann">KN</span>`,
    },
  ],
  badge: [
    {
      markup: `<span class="lt-badge" data-color="warning">Venter på dokumentasjon fra arbeidsgiver</span>`,
    },
  ],
  breadcrumbs: [
    {
      markup: `<ol class="lt-breadcrumbs">
        <li><a href="#">Forsiden</a></li>
        <li><a href="#">Mine saker og søknader</a></li>
        <li><a href="#" aria-current="page">Søknad 2026-0481</a></li>
      </ol>`,
    },
  ],
  button: [
    { markup: `<button class="lt-button">${LANG}</button>` },
    {
      markup: `<div style="white-space: nowrap">
        <button class="lt-button">${LANG}</button>
      </div>`,
    },
    {
      markup: `<button class="lt-button">Send søknaden nå</button>
        <button class="lt-button" data-variant="secondary">Lagre som utkast</button>`,
    },
  ],
  card: [
    {
      markup: `<div class="lt-card">
        <h3 class="lt-card__title">Søknad om bostøtte for 2026</h3>
        <p>Sendt 4. mars. Saksnummer 2026-0481.</p>
      </div>`,
    },
  ],
  checkbox: [
    {
      markup: `<label><input class="lt-checkbox" type="checkbox" /> Jeg bekrefter at opplysningene i søknaden er riktige og fullstendige</label>`,
    },
  ],
  divider: [{ markup: `<hr class="lt-divider" />` }],
  "error-text": [
    {
      markup: `<p class="lt-error-text">Skriv fødselsnummeret med elleve siffer, uten mellomrom eller bindestrek</p>`,
    },
  ],
  fieldset: [
    {
      markup: `<fieldset class="lt-fieldset">
        <legend class="lt-legend">Hvem bor i husstanden sammen med deg i 2026?</legend>
        <label><input class="lt-radio" type="radio" name="h" /> Bare meg</label>
      </fieldset>`,
    },
  ],
  "file-upload": [
    { markup: `<input class="lt-file-upload" type="file" multiple />` },
    {
      markup: `<ul class="lt-file-upload-list">
        <li>
          soknad-om-bostotte-2026-vedlegg-1.pdf
          <button class="lt-button" data-variant="ghost" type="button">Fjern soknad-om-bostotte-2026-vedlegg-1.pdf</button>
        </li>
      </ul>`,
    },
  ],
  heading: [
    {
      markup: `<h1 class="lt-heading" data-size="xl">Søknad om bostøtte for hele kalenderåret 2026</h1>`,
    },
  ],
  "help-text": [
    {
      markup: `<p class="lt-help-text">Elleve siffer. Du finner det på bankkortet eller i skattemeldingen.</p>`,
    },
  ],
  icon: [
    {
      markup: `<button class="lt-button" type="button"><svg class="lt-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" /></svg>${LANG}</button>`,
    },
  ],
  input: [
    { markup: `<input class="lt-input" value="${LANG}" />` },
    { markup: `<input class="lt-input" type="date" data-variant="date" />` },
  ],
  label: [
    {
      markup: `<label class="lt-label" data-required>Fødselsnummer til den som søker om bostøtte</label>`,
    },
  ],
  link: [
    {
      markup: `<a class="lt-link" href="#">Les mer om hvem som kan søke om bostøtte for hele kalenderåret 2026</a>`,
    },
  ],
  list: [
    {
      markup: `<ul class="lt-list">
        <li>Lønnsslipp for de tre siste månedene før søknaden ble sendt</li>
        <li>Husleiekontrakt</li>
      </ul>`,
    },
  ],
  pagination: [
    {
      markup: `<ul class="lt-pagination">
        <li><a href="#">Forrige</a></li><li><a href="#">1</a></li><li><a href="#">2</a></li>
        <li><a href="#">3</a></li><li><a href="#">4</a></li><li><a href="#">Neste</a></li>
      </ul>`,
    },
  ],
  paragraph: [
    {
      markup: `<p class="lt-paragraph">Søknadsfristen er 1. mars. Vi behandler søknaden innen fire uker, og sender svaret til innboksen din.</p>`,
    },
  ],
  progress: [
    {
      markup: `<progress class="lt-progress" value="40" max="100" aria-label="Lastet opp"></progress>
        <progress class="lt-progress" aria-label="Laster opp"></progress>`,
    },
  ],
  radio: [
    {
      markup: `<label><input class="lt-radio" type="radio" name="r" /> Jeg leier en kommunal bolig gjennom hele kalenderåret 2026</label>`,
    },
  ],
  search: [
    {
      markup: `<input class="lt-input lt-search" type="search" aria-label="Søk" value="${LANG}" />`,
    },
  ],
  select: [
    {
      markup: `<select class="lt-select" aria-label="Kommune">
        <option>Bergen</option>
        <option>Nordre Follo og omegn interkommunale bostøttekontor</option>
      </select>`,
    },
  ],
  skeleton: [{ markup: `<div class="lt-skeleton"></div>` }],
  "skip-link": [
    {
      markup: `<a class="lt-skip-link" href="#hoved">Hopp til hovedinnholdet på siden om bostøtte</a>`,
      // Lenken står utenfor synet til den får fokus. Ett ekte tastetrykk
      // først: et programmert `focus()` alene ga av og til ingen `:focus` i
      // Firefox i CI.
      aapne: async () => {
        await userEvent.tab()
        element<HTMLAnchorElement>(".lt-skip-link").focus()
      },
      apen: ".lt-skip-link:focus",
    },
  ],
  spinner: [
    {
      markup: `<span class="lt-spinner" role="status" aria-label="Laster saken"></span>`,
    },
  ],
  "sr-only": [
    {
      markup: `<span class="lt-sr-only">${LANG}, og en lang forklaring bare skjermlesere hører</span>`,
    },
  ],
  switch: [
    {
      markup: `<label><input class="lt-switch" type="checkbox" role="switch" /> Send meg varsel på SMS når saken er ferdig behandlet</label>`,
    },
  ],
  table: [
    {
      markup: `<div class="lt-table-scroll" tabindex="0">
        <table class="lt-table">
          <thead><tr><th>Fakturanummer</th><th>Forfallsdato</th><th>Beløp</th></tr></thead>
          <tbody><tr><td>2026-0481</td><td>4. mars 2026</td><td>1 240 kr</td></tr></tbody>
        </table>
      </div>`,
    },
  ],
  tag: [
    {
      markup: `<button class="lt-tag" data-selectable aria-pressed="true">Under behandling</button>
        <button class="lt-tag" data-selectable aria-pressed="false">Ferdig behandlet</button>`,
    },
  ],
  textarea: [
    {
      markup: `<textarea class="lt-textarea" aria-label="Begrunnelse">${LANG}</textarea>`,
    },
  ],
  "toggle-group": [
    {
      markup: `<fieldset class="lt-toggle-group">
        <legend>Visning</legend>
        <label class="lt-toggle-group__option"><input type="radio" name="v" checked /> Liste over saker</label>
        <label class="lt-toggle-group__option"><input type="radio" name="v" /> Kalendervisning</label>
      </fieldset>`,
    },
  ],
  tooltip: [
    {
      /*
       * Knappen står midt i raden. Boblen sentreres over knappen og flyttes
       * ikke inn fra kanten, så ved venstre kant av en telefon står den
       * delvis utenfor. Det er en kjent begrensning, beskrevet på
       * komponentsiden, og den trenger ankerplassering eller JavaScript.
       */
      markup: `<div style="text-align: center">
        <span class="lt-tooltip">
          <button class="lt-button" type="button" aria-describedby="hint">Arkiver</button>
          <span class="lt-tooltip__bubble" role="tooltip" id="hint" style="display: block">Saken flyttes til arkivet, og kan hentes fram igjen senere</span>
        </span>
      </div>`,
    },
  ],

  "connection-status": [
    {
      markup: `<lt-connection-status></lt-connection-status>`,
      aapne: async () => {
        const status = element<HTMLElement & { reportFailure(): void }>(
          "lt-connection-status",
        )
        status.reportFailure()
      },
    },
  ],
  toast: [
    {
      markup: `<lt-toast></lt-toast>`,
      aapne: () =>
        element<HTMLElement & { show(text: string): void }>("lt-toast").show(
          `${LANG} er mottatt, og du får svar innen fire uker`,
        ),
      apen: "lt-toast > *",
    },
  ],

  dialog: [
    {
      markup: `<lt-dialog open>
        <dialog class="lt-dialog" aria-labelledby="boks-tittel" open>
          <h2 class="lt-dialog__title" id="boks-tittel">Vil du trekke søknaden om bostøtte for hele kalenderåret 2026?</h2>
          <div class="lt-dialog__body"><p>Saken blir avsluttet, og du må søke på nytt.</p></div>
          <form method="dialog" class="lt-dialog__footer">
            <button class="lt-button" value="trekk">Trekk søknaden</button>
            <button class="lt-button" data-variant="secondary" value="avbryt">Avbryt</button>
          </form>
        </dialog>
      </lt-dialog>`,
    },
  ],
  "error-summary": [
    {
      markup: `<lt-error-summary class="lt-error-summary" role="alert" tabindex="-1" data-autofocus="false">
        <h2 class="lt-error-summary__title">Skjemaet har to feil som må rettes før du kan sende</h2>
        <ul class="lt-list">
          <li><a href="#fnr">Skriv fødselsnummeret med elleve siffer, uten mellomrom</a></li>
          <li><a href="#kommune">Velg kommunen du bodde i 1. januar 2026</a></li>
        </ul>
      </lt-error-summary>`,
    },
  ],
  field: [
    {
      markup: `<lt-field>
        <label class="lt-label" for="smal-epost">E-postadressen vi skal sende vedtaket til</label>
        <input class="lt-input" id="smal-epost" value="kari.nordmann.med.et.langt.navn@eksempel.no" />
        <p class="lt-help-text">Vi sender aldri reklame eller nyhetsbrev.</p>
        <p class="lt-error-text">Skriv en e-postadresse med @ og et domene</p>
      </lt-field>`,
    },
  ],
  popover: [
    {
      markup: `<lt-popover open>
        <button class="lt-button" aria-expanded="false" aria-controls="handlinger">Handlinger</button>
        <div popover id="handlinger" class="lt-popover">
          <p>Flytt saken til en annen saksbehandler i det samme kontoret</p>
        </div>
      </lt-popover>`,
    },
  ],
  "session-timeout": [
    {
      markup: `<lt-session-timeout warn-at="600" expires-at="900">
        <dialog class="lt-session-timeout__dialog" role="alertdialog" aria-labelledby="okt-tittel">
          <h2 class="lt-session-timeout__title" id="okt-tittel">Du blir snart logget ut av søknaden om bostøtte</h2>
          <p class="lt-session-timeout__text">Vi logger deg ut om
            <span class="lt-session-timeout__count" aria-hidden="true"></span>.</p>
          <span class="lt-sr-only" role="status"></span>
          <form method="dialog" class="lt-session-timeout__actions">
            <button class="lt-button" value="extend">Fortsett å være innlogget</button>
            <button class="lt-button" data-variant="secondary" value="logout">Logg ut nå</button>
          </form>
        </dialog>
      </lt-session-timeout>`,
      // Varselet som om tiden var nesten ute.
      aapne: () =>
        element<HTMLDialogElement>(".lt-session-timeout__dialog").showModal(),
    },
  ],
  suggestion: [
    {
      markup: `<lt-suggestion>
        <label class="lt-label">Kommune</label>
        <div>
          <input class="lt-input" name="kommune" type="text" />
          <ul class="lt-suggestion__list">
            <li>Bergen</li>
            <li>Bjørnafjorden og omegn interkommunale bostøttekontor</li>
          </ul>
          <span class="lt-sr-only" role="status"></span>
        </div>
      </lt-suggestion>`,
      aapne: () => {
        const felt = element<HTMLInputElement>("lt-suggestion input")
        felt.focus()
        felt.value = "B"
        felt.dispatchEvent(new InputEvent("input", { bubbles: true }))
      },
      // Komponenten må ha åpnet lista. En liste den aldri kjente igjen,
      // står også uten `hidden`, så det er feltet som spørres.
      apen: 'lt-suggestion input[aria-expanded="true"]',
    },
  ],
  tabs: [
    {
      markup: `<lt-tabs>
        <ul class="lt-tabs__list" aria-label="Deler av saken">
          <li><a href="#smal-soknaden">Søknaden</a></li>
          <li><a href="#smal-vedlegg">Vedlegg og dokumentasjon</a></li>
          <li><a href="#smal-vedtak">Vedtak</a></li>
          <li><a href="#smal-klage">Klage på vedtaket</a></li>
        </ul>
        <section class="lt-tabs__panel" id="smal-soknaden"><h2>Søknaden</h2>Søknaden kom 3. mars.</section>
        <section class="lt-tabs__panel" id="smal-vedlegg"><h2>Vedlegg og dokumentasjon</h2>To vedlegg.</section>
        <section class="lt-tabs__panel" id="smal-vedtak"><h2>Vedtak</h2>Ikke behandlet ennå.</section>
        <section class="lt-tabs__panel" id="smal-klage"><h2>Klage på vedtaket</h2>Ingen klage.</section>
      </lt-tabs>`,
    },
  ],
}

/** Komponentmappene, lest fra testfilene. Hver mappe har en, se `check-test-files.ts`. */
const MAPPER = Object.keys(
  import.meta.glob("./components/*/*/*.browser.test.ts"),
).map((sti) => sti.split("/")[3])

const TILFELLER = Object.entries(KOMPONENTER).flatMap(([mappe, liste]) =>
  liste.map((tilfelle, i) => [`${mappe} #${i + 1}`, tilfelle] as const),
)

describe(`komponentene i et vindu på ${SMAL} piksler`, () => {
  beforeAll(async () => {
    defineLt()
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

    // Det som skulle åpnes, står åpent.
    if (tilfelle.apen) {
      const apen = document.querySelector(tilfelle.apen)
      expect(apen, `${tilfelle.apen} kom ikke til syne`).not.toBeNull()
      expect(apen?.getBoundingClientRect().width).toBeGreaterThan(0)
    }

    // Og alt som synes, står innenfor vinduet. Det som står fast eller i
    // topplaget, og alt inni det, gjør ikke siden bredere, så linja over ser
    // det ikke. Unntaket er det som med vilje er klippet: tabellen i
    // rullefeltet sitt, og tekst bare skjermlesere hører.
    let iToppen = 0
    for (const node of document.querySelectorAll("body *")) {
      if (node.closest(".lt-table-scroll, .lt-sr-only")) continue
      const stil = getComputedStyle(node)
      if (stil.visibility === "hidden") continue
      const boks = node.getBoundingClientRect()
      if (boks.width === 0 || boks.height === 0) continue
      const hvem = `${node.tagName.toLowerCase()}.${node.className}`
      expect(boks.left, `${hvem} til venstre`).toBeGreaterThanOrEqual(-0.5)
      expect(boks.right, `${hvem} til høyre`).toBeLessThanOrEqual(SMAL + 0.5)
      if (
        node.closest(":modal, :popover-open") ||
        getComputedStyle(node).position === "fixed"
      )
        iToppen += 1
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
      expect(iToppen, "fant ikke det åpne elementet").toBeGreaterThan(0)

    for (const dialog of document.querySelectorAll("dialog")) dialog.close()
  })
})
