import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineFsDialog } from "./components/ramme/dialog/fs-dialog"
import { defineFsErrorSummary } from "./components/ramme/error-summary/fs-error-summary"
import { defineFsField } from "./components/ramme/field/fs-field"
import { defineFsPopover } from "./components/ramme/popover/fs-popover"
import { defineFsSuggestion } from "./components/ramme/suggestion/fs-suggestion"
import { defineFsTabs } from "./components/ramme/tabs/fs-tabs"
import { monter, ventPaTegning } from "./testing/a11y"

/**
 * At en komponent sier fra når markupen den fikk ikke henger sammen, og bare
 * da.
 *
 * Komponentene fester oppførsel på markup noen andre har skrevet, og den
 * markupen kan komme fra en Go-mal, en PHP-fil eller en publiseringsløsning
 * der ingen TypeScript-kompilator ser etter. Fant ikke komponenten delene
 * sine, gjorde den ingenting, uten et ord. Feilen viste seg først når noen
 * leste siden med skjermleser.
 *
 * Testen som betyr mest er den siste: at riktig markup ikke gir et eneste
 * ord. En advarsel som også kommer når alt er i orden blir slått av, og da
 * er den verdiløs.
 */

/**
 * Advarselen kommer først når siden har falt til ro, altså etter to
 * tegninger. Her venter vi i to runder, slik at sjekken er ferdig uansett
 * hvilken av dem som ble planlagt først.
 */
async function ventTilRo(): Promise<void> {
  await ventPaTegning()
  await ventPaTegning()
}

function meldinger(advarsel: { mock: { calls: unknown[][] } }): string[] {
  return advarsel.mock.calls.map((kall) => String(kall[0]))
}

describe("komponenten sier fra om markup som ikke henger sammen", () => {
  beforeAll(() => {
    defineFsField()
    defineFsSuggestion()
    defineFsPopover()
    defineFsTabs()
    defineFsErrorSummary()
    defineFsDialog()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function lytt() {
    return vi.spyOn(console, "warn").mockImplementation(() => {})
  }

  it("feltet uten en kontroll", async () => {
    const advarsel = lytt()

    monter(`
      <fs-field>
        <label class="fs-label">E-post</label>
        <p class="fs-help-text">Vi sender aldri spam.</p>
      </fs-field>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen kontroll")),
    ).toBe(true)
  })

  it("feltet uten en ledetekst", async () => {
    const advarsel = lytt()

    monter(`
      <fs-field>
        <input class="fs-input" />
      </fs-field>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("<label>"))).toBe(true)
  })

  it("men ikke når feltet har navnet sitt fra aria-label", async () => {
    // Et søkefelt med bare et ikon har ingen synlig ledetekst, og det er en
    // lovlig løsning. En advarsel der ville vært feil.
    const advarsel = lytt()

    monter(`
      <fs-field>
        <input class="fs-input fs-search" type="search" aria-label="Søk i saker" />
      </fs-field>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("men ikke når ledeteksten står utenfor elementet", async () => {
    // En `<label for>` utenfor `<fs-field>` navngir feltet like godt, og
    // komponenten kobler den på samme måte som en inni.
    const advarsel = lytt()

    const flate = monter(`
      <div>
        <label class="fs-label" for="epost">E-post</label>
        <fs-field required-marker="symbol">
          <input class="fs-input" id="epost" type="email" />
        </fs-field>
      </div>
    `)
    await ventTilRo()

    const label = flate.querySelector("label") as HTMLLabelElement
    expect(advarsel).not.toHaveBeenCalled()
    expect(label.getAttribute("data-required")).toBe("symbol")
  })

  it("fanene uten roller", async () => {
    const advarsel = lytt()

    monter(`
      <fs-tabs>
        <div class="fs-tabs__list">
          <button>Søknaden</button>
          <button>Vedlegg</button>
        </div>
      </fs-tabs>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen faner")),
    ).toBe(true)
  })

  it("flere faner enn paneler", async () => {
    const advarsel = lytt()

    monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">
          <button role="tab" aria-selected="true" tabindex="0">Søknaden</button>
          <button role="tab" aria-selected="false" tabindex="-1">Vedlegg</button>
        </div>
        <div role="tabpanel" tabindex="0">Søknaden kom 3. mars.</div>
      </fs-tabs>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("flere faner enn paneler")),
    ).toBe(true)
  })

  it("dialogen uten en <dialog>", async () => {
    const advarsel = lytt()

    monter(`
      <fs-dialog>
        <div class="fs-dialog">
          <h2 class="fs-dialog__title">Slette søknaden?</h2>
        </div>
      </fs-dialog>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("<dialog>"))).toBe(true)
  })

  it("forslagsfeltet uten en combobox", async () => {
    const advarsel = lytt()

    monter(`
      <fs-suggestion>
        <label class="fs-label">Kommune</label>
        <input class="fs-input" />
      </fs-suggestion>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("combobox"))).toBe(true)
  })

  it("forslagsfeltet uten en listboks", async () => {
    const advarsel = lytt()

    monter(`
      <fs-suggestion>
        <label class="fs-label" for="kommune">Kommune</label>
        <input class="fs-input" id="kommune" role="combobox"
               aria-expanded="false" aria-autocomplete="list" />
      </fs-suggestion>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("listbox"))).toBe(true)
  })

  it("sprettoppvinduet uten et panel", async () => {
    const advarsel = lytt()

    monter(`
      <fs-popover>
        <button class="fs-button">Handlinger</button>
      </fs-popover>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("[popover]"))).toBe(true)
  })

  it("sprettoppvinduet der panelet mangler id", async () => {
    // Oppslaget etter knappen går gjennom panelets id, så den faller bort av
    // seg selv når id-en mangler. Beskjeden må peke på panelet og ikke på
    // knappen, ellers leter utvikleren på feil sted.
    const advarsel = lytt()

    monter(`
      <fs-popover>
        <button class="fs-button" aria-expanded="false">Handlinger</button>
        <div popover class="fs-popover__panel">Flytt saken</div>
      </fs-popover>
    `)
    await ventTilRo()

    const sagt = meldinger(advarsel)
    expect(sagt.some((m) => m.includes("panelet har ingen id"))).toBe(true)
    expect(sagt.some((m) => m.includes("fant ingen knapp"))).toBe(false)
  })

  it("sprettoppvinduet uten en knapp som peker på panelet", async () => {
    const advarsel = lytt()

    monter(`
      <fs-popover>
        <button class="fs-button">Handlinger</button>
        <div popover id="handlinger" class="fs-popover__panel">Flytt saken</div>
      </fs-popover>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen knapp")),
    ).toBe(true)
  })

  it("feiloppsummeringen med punkter som ikke lenker noe sted", async () => {
    const advarsel = lytt()

    monter(`
      <fs-error-summary class="fs-error-summary" role="alert" tabindex="-1">
        <h2 class="fs-error-summary__title">Skjemaet har én feil</h2>
        <ul class="fs-list"><li>Skriv en gyldig e-postadresse</li></ul>
      </fs-error-summary>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen lenker")),
    ).toBe(true)
  })

  it("feiloppsummeringen med en lenke som peker på ingenting", async () => {
    const advarsel = lytt()

    const flate = monter(`
      <fs-error-summary class="fs-error-summary" role="alert" tabindex="-1">
        <h2 class="fs-error-summary__title">Skjemaet har én feil</h2>
        <ul class="fs-list"><li><a href="#finnes-ikke">Skriv en gyldig adresse</a></li></ul>
      </fs-error-summary>
    `)
    await ventTilRo()

    flate.querySelector("a")?.click()
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("#finnes-ikke"))).toBe(
      true,
    )
  })

  it("sier det én gang, ikke én gang per synkronisering", async () => {
    const advarsel = lytt()

    const flate = monter(`
      <fs-field>
        <label class="fs-label">E-post</label>
      </fs-field>
    `)
    const felt = flate.querySelector("fs-field") as HTMLElement
    await ventTilRo()

    // Hver endring i barna utløser en ny synkronisering, slik en patch gjør.
    for (let n = 0; n < 5; n += 1) {
      felt.append(document.createElement("span"))
      await ventTilRo()
    }

    expect(
      meldinger(advarsel).filter((m) => m.includes("fant ingen kontroll")),
    ).toHaveLength(1)
  })

  it("sier det også bare én gang når panelene kommer ett om gangen", async () => {
    /*
     * Meldingen må være den samme hver runde.
     *
     * Sto tallene i teksten, som «har 3 faner, men 1 paneler», ville hver
     * runde vært en ny melding, og dedupliseringen var borte: tre paneler som
     * kom ett om gangen ga tre advarsler.
     */
    const advarsel = lytt()

    const flate = monter(`
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">
          <button role="tab" aria-selected="true" tabindex="0">En</button>
          <button role="tab" aria-selected="false" tabindex="-1">To</button>
          <button role="tab" aria-selected="false" tabindex="-1">Tre</button>
        </div>
      </fs-tabs>
    `)
    const faner = flate.querySelector("fs-tabs") as HTMLElement
    await ventTilRo()

    for (let n = 0; n < 2; n += 1) {
      const panel = document.createElement("div")
      panel.setAttribute("role", "tabpanel")
      faner.append(panel)
      await ventTilRo()
    }

    expect(
      meldinger(advarsel).filter((m) => m.includes("flere faner enn paneler")),
    ).toHaveLength(1)
  })

  it("sier ingenting om markup som blir ferdig i neste omgang", async () => {
    /*
     * HTML som strømmer fra en server leveres i pakker, og et brudd mellom
     * ledeteksten og feltet er helt vanlig. Komponenten ser markupen sin i
     * det den kobles til, og der er den halvferdig. Advarselen venter til
     * siden har falt til ro, og sjekker på nytt.
     */
    const advarsel = lytt()

    const flate = monter(`
      <fs-field>
        <label class="fs-label">E-post</label>
      </fs-field>
    `)
    const kontroll = document.createElement("input")
    kontroll.className = "fs-input"
    flate.querySelector("fs-field")?.append(kontroll)

    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("sier ingenting om et tomt område serveren ikke har fylt", async () => {
    const advarsel = lytt()

    monter(`
      <div>
        <fs-field></fs-field>
        <fs-tabs></fs-tabs>
        <fs-dialog></fs-dialog>
        <fs-popover></fs-popover>
        <fs-suggestion></fs-suggestion>
        <fs-error-summary hidden></fs-error-summary>
      </div>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("sier ingenting om markup som henger sammen", async () => {
    const advarsel = lytt()

    monter(`
      <div>
        <fs-field>
          <label class="fs-label">E-post</label>
          <input class="fs-input" />
          <p class="fs-help-text">Vi sender aldri spam.</p>
        </fs-field>

        <fs-tabs>
          <div class="fs-tabs__list" role="tablist">
            <button id="sak-tab-0" role="tab" aria-selected="true"
                    aria-controls="sak-panel-0" tabindex="0">Søknaden</button>
            <button id="sak-tab-1" role="tab" aria-selected="false"
                    aria-controls="sak-panel-1" tabindex="-1">Vedlegg</button>
          </div>
          <div id="sak-panel-0" role="tabpanel" aria-labelledby="sak-tab-0"
               tabindex="0">Søknaden kom 3. mars.</div>
          <div id="sak-panel-1" role="tabpanel" aria-labelledby="sak-tab-1"
               tabindex="0" hidden>To vedlegg.</div>
        </fs-tabs>

        <fs-dialog>
          <dialog class="fs-dialog" aria-labelledby="boks-tittel">
            <h2 class="fs-dialog__title" id="boks-tittel">Vedtaket er registrert</h2>
            <div class="fs-dialog__body"><p>Saken er ferdigbehandlet.</p></div>
            <form method="dialog" class="fs-dialog__footer">
              <button class="fs-button" value="lukk">Lukk</button>
            </form>
          </dialog>
        </fs-dialog>

        <fs-popover>
          <button class="fs-button" aria-expanded="false"
                  aria-controls="handlinger">Handlinger</button>
          <div popover id="handlinger" class="fs-popover__panel">Flytt saken</div>
        </fs-popover>

        <fs-suggestion>
          <label class="fs-label" for="kommune">Kommune</label>
          <input class="fs-input" id="kommune" role="combobox"
                 aria-expanded="false" aria-controls="kommuner"
                 aria-autocomplete="list" />
          <ul class="fs-suggestion__list" id="kommuner" role="listbox" hidden>
            <li class="fs-suggestion__option" id="kommune-0" role="option"
                aria-selected="false">Bergen</li>
          </ul>
        </fs-suggestion>

        <fs-error-summary class="fs-error-summary" role="alert" tabindex="-1"
                          data-autofocus="false">
          <h2 class="fs-error-summary__title">Skjemaet har én feil</h2>
          <ul class="fs-list"><li><a href="#kommune">Velg en kommune</a></li></ul>
        </fs-error-summary>
      </div>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })
})
