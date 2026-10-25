import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineLtDialog } from "./components/frame/dialog/lt-dialog"
import { defineLtErrorSummary } from "./components/frame/error-summary/lt-error-summary"
import { defineLtField } from "./components/frame/field/lt-field"
import { defineLtPopover } from "./components/frame/popover/lt-popover"
import { defineLtSessionTimeout } from "./components/frame/session-timeout/lt-session-timeout"
import { defineLtSuggestion } from "./components/frame/suggestion/lt-suggestion"
import { defineLtTabs } from "./components/frame/tabs/lt-tabs"
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
    defineLtField()
    defineLtSuggestion()
    defineLtPopover()
    defineLtTabs()
    defineLtErrorSummary()
    defineLtDialog()
    defineLtSessionTimeout()
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
      <lt-field>
        <label class="lt-label">E-post</label>
        <p class="lt-help-text">Vi sender aldri spam.</p>
      </lt-field>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen kontroll")),
    ).toBe(true)
  })

  it("feltet uten en ledetekst", async () => {
    const advarsel = lytt()

    monter(`
      <lt-field>
        <input class="lt-input" />
      </lt-field>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("<label>"))).toBe(true)
  })

  it("men ikke når feltet har navnet sitt fra aria-label", async () => {
    // Et søkefelt med bare et ikon har ingen synlig ledetekst, og det er en
    // lovlig løsning. En advarsel der ville vært feil.
    const advarsel = lytt()

    monter(`
      <lt-field>
        <input class="lt-input lt-search" type="search" aria-label="Søk i saker" />
      </lt-field>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("men ikke når ledeteksten står utenfor elementet", async () => {
    // En `<label for>` utenfor `<lt-field>` navngir feltet like godt, og
    // komponenten kobler den på samme måte som en inni.
    const advarsel = lytt()

    const flate = monter(`
      <div>
        <label class="lt-label" for="epost" data-required="symbol">E-post</label>
        <lt-field>
          <input class="lt-input" id="epost" type="email" />
        </lt-field>
      </div>
    `)
    await ventTilRo()

    const label = flate.querySelector("label") as HTMLLabelElement
    expect(advarsel).not.toHaveBeenCalled()
    expect(label.getAttribute("data-required")).toBe("symbol")
  })

  it("feltet med mer enn én kontroll", async () => {
    // Bare den første kontrollen får koblingen. Den andre står uten
    // ledetekst, og det skal sies fra om.
    const advarsel = lytt()

    monter(`
      <lt-field>
        <label class="lt-label">Søk</label>
        <input class="lt-input" type="search" />
        <select class="lt-select"><option>Alle</option></select>
      </lt-field>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).filter((m) => m.includes("mer enn én kontroll")),
    ).toHaveLength(1)
  })

  it("ledeteksten som verken har for eller står rundt feltet", async () => {
    /*
     * Uten JavaScript har feltet da ingen ledetekst. Komponenten lager ikke
     * id-en selv: en id serveren ikke sendte, får en oppdatering fra serveren
     * til å bytte ut feltet, med fokus og det brukeren har skrevet.
     */
    const advarsel = lytt()

    const flate = monter(`
      <lt-field>
        <label class="lt-label">E-post</label>
        <input class="lt-input" type="email" />
      </lt-field>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).filter((m) =>
        m.includes("er ikke koblet til feltet"),
      ),
    ).toHaveLength(1)
    expect(flate.querySelector("input")?.hasAttribute("id")).toBe(false)
  })

  it("men ikke når ledeteksten står rundt feltet", async () => {
    const advarsel = lytt()

    monter(`
      <lt-field>
        <label class="lt-label">E-post <input class="lt-input" type="email" /></label>
      </lt-field>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("feltet som ble byttet ut fordi id-en fra serveren endret seg", async () => {
    /*
     * En mal som lager id-en av et tilfeldig tall eller en teller, gir en ny
     * id ved hver rendring, og en oppdatering fra serveren kjenner da ikke
     * feltet igjen. Det brukeren skrev, går tapt.
     */
    const advarsel = lytt()

    const flate = monter(`
      <lt-field>
        <label class="lt-label" for="navn-1">Navn</label>
        <input class="lt-input" id="navn-1" name="navn" />
      </lt-field>
    `)
    await ventTilRo()

    const gammel = flate.querySelector("input") as HTMLInputElement
    gammel.value = "Kari"
    const ny = document.createElement("input")
    ny.className = "lt-input"
    ny.id = "navn-2"
    ny.name = "navn"
    const label = flate.querySelector("label") as HTMLLabelElement
    label.htmlFor = "navn-2"
    gammel.replaceWith(ny)
    await ventTilRo()

    expect(
      meldinger(advarsel).filter((m) =>
        m.includes("Id-en på kontrollen var en annen enn sist"),
      ),
    ).toHaveLength(1)
  })

  it("men ikke når serveren sendte et annet felt med vilje", async () => {
    const advarsel = lytt()

    const flate = monter(`
      <lt-field>
        <label class="lt-label" for="navn">Navn</label>
        <input class="lt-input" id="navn" name="navn" />
      </lt-field>
    `)
    await ventTilRo()

    const gammel = flate.querySelector("input") as HTMLInputElement
    gammel.value = "Kari"
    const ny = document.createElement("input")
    ny.className = "lt-input"
    ny.id = "epost"
    ny.name = "epost"
    const label = flate.querySelector("label") as HTMLLabelElement
    label.htmlFor = "epost"
    gammel.replaceWith(ny)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("men ikke når den andre kontrollen står i et felt inni", async () => {
    // Et felt i et felt er vanlig markup: et søkefelt i et sprettoppvindu
    // inni feltet. Hvert felt har da sin egen kontroll.
    const advarsel = lytt()

    monter(`
      <lt-field>
        <label class="lt-label" for="kommune">Kommune</label>
        <input class="lt-input" id="kommune" type="text" />
        <div popover>
          <lt-field>
            <label class="lt-label">Søk i lista <input class="lt-input" type="search" /></label>
          </lt-field>
        </div>
      </lt-field>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("dialogen uten navn", async () => {
    // Ingen aria-labelledby, ingen aria-label, og den eneste overskriften
    // står i kroppen, der den er innholdets og ikke dialogens.
    const advarsel = lytt()

    monter(`
      <lt-dialog>
        <dialog>
          <div class="lt-dialog__body"><h3>Vedlegg</h3><p>To vedlegg.</p></div>
        </dialog>
      </lt-dialog>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).filter((m) => m.includes("ikke noe navn")),
    ).toHaveLength(1)
  })

  it("men ikke om en tom dialog serveren ikke har fylt ennå", async () => {
    const advarsel = lytt()

    monter(`
      <lt-dialog>
        <dialog></dialog>
      </lt-dialog>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("fanene uten lenker", async () => {
    // Fanene er lenker til panelene. En rad med bare knapper, slik fanene
    // var før, har ingen faner komponenten kan koble.
    const advarsel = lytt()

    monter(`
      <lt-tabs>
        <ul class="lt-tabs__list">
          <li><button>Søknaden</button></li>
          <li><button>Vedlegg</button></li>
        </ul>
      </lt-tabs>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen faner")),
    ).toBe(true)
  })

  it("faner uten et panel", async () => {
    const advarsel = lytt()

    monter(`
      <lt-tabs>
        <ul class="lt-tabs__list">
          <li><a href="#soknad">Søknaden</a></li>
          <li><a href="#vedlegg">Vedlegg</a></li>
        </ul>
        <section class="lt-tabs__panel" id="soknad"><h2>Søknaden</h2>Søknaden kom 3. mars.</section>
      </lt-tabs>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("faner uten et panel")),
    ).toBe(true)
  })

  it("dialogen uten en <dialog>", async () => {
    const advarsel = lytt()

    monter(`
      <lt-dialog>
        <div class="lt-dialog">
          <h2 class="lt-dialog__title">Slette søknaden?</h2>
        </div>
      </lt-dialog>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("<dialog>"))).toBe(true)
  })

  it("varselet om økten uten en <dialog>", async () => {
    const advarsel = lytt()

    monter(`
      <lt-session-timeout>
        <div class="lt-session-timeout__dialog">
          <h2>Du blir snart logget ut</h2>
        </div>
      </lt-session-timeout>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("<dialog>"))).toBe(true)
  })

  it("varselet om økten uten tall, opplesning eller knapper", async () => {
    const advarsel = lytt()

    monter(`
      <lt-session-timeout>
        <dialog>
          <h2>Du blir snart logget ut</h2>
          <p>Vi logger deg ut snart.</p>
        </dialog>
      </lt-session-timeout>
    `)
    await ventTilRo()

    const sagt = meldinger(advarsel)
    expect(sagt.some((m) => m.includes(".lt-session-timeout__count"))).toBe(
      true,
    )
    expect(sagt.some((m) => m.includes("[role=status]"))).toBe(true)
    expect(sagt.some((m) => m.includes('<form method="dialog">'))).toBe(true)
  })

  it("forslagsfeltet uten et felt", async () => {
    // Et `<input>` er nok: komponenten gir det rollen. Uten et felt i det
    // hele tatt finner den ingenting å lytte på.
    const advarsel = lytt()

    monter(`
      <lt-suggestion>
        <label class="lt-label">Kommune</label>
        <ul class="lt-suggestion__list"><li>Bergen</li></ul>
      </lt-suggestion>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("combobox"))).toBe(true)
  })

  it("forslagsfeltet uten en listboks", async () => {
    const advarsel = lytt()

    monter(`
      <lt-suggestion>
        <label class="lt-label" for="kommune">Kommune</label>
        <input class="lt-input" id="kommune" role="combobox"
               aria-expanded="false" aria-autocomplete="list" />
      </lt-suggestion>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("listbox"))).toBe(true)
  })

  it("forslagsfeltet uten et statuselement", async () => {
    // Antall treff leses opp i statuselementet. Uten det sto komponenten
    // stille, og den som ikke ser skjermen fikk aldri vite at lista snevret
    // seg inn.
    const advarsel = lytt()

    monter(`
      <lt-suggestion>
        <label class="lt-label" for="kommune">Kommune</label>
        <input class="lt-input" id="kommune" role="combobox"
               aria-expanded="false" aria-controls="kommuner" aria-autocomplete="list" />
        <ul class="lt-suggestion__list" id="kommuner" role="listbox" hidden>
          <li class="lt-suggestion__option" id="kommune-0" role="option">Bergen</li>
        </ul>
      </lt-suggestion>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes('[role="status"]'))).toBe(
      true,
    )
  })

  it("sprettoppvinduet uten et panel", async () => {
    const advarsel = lytt()

    monter(`
      <lt-popover>
        <button class="lt-button">Handlinger</button>
      </lt-popover>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen panel")),
    ).toBe(true)
  })

  it("sprettoppvinduet med et panel uten id", async () => {
    // Komponenten skriver aldri id på panelet, så knappen kan ikke kobles.
    const advarsel = lytt()

    monter(`
      <lt-popover>
        <button class="lt-button">Handlinger</button>
        <div class="lt-popover">Flytt saken</div>
      </lt-popover>
    `)
    await ventTilRo()

    const om = meldinger(advarsel).filter((m) =>
      m.includes("panelet har ingen id"),
    )
    expect(om).toHaveLength(1)
  })

  it("sprettoppvinduet uten en knapp", async () => {
    // En knapp utenfor panelet er nok: komponenten kobler den. Uten en
    // eneste, eller med bare en som peker på noe annet, finner den ingen.
    const advarsel = lytt()

    monter(`
      <lt-popover>
        <a href="/handlinger" class="lt-link">Handlinger</a>
        <div popover id="handlinger" class="lt-popover">Flytt saken</div>
      </lt-popover>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen knapp")),
    ).toBe(true)
  })

  it("feiloppsummeringen med punkter som ikke lenker noe sted", async () => {
    const advarsel = lytt()

    monter(`
      <lt-error-summary class="lt-error-summary" role="alert" tabindex="-1">
        <h2 class="lt-error-summary__title">Skjemaet har én feil</h2>
        <ul class="lt-list"><li>Skriv en gyldig e-postadresse</li></ul>
      </lt-error-summary>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("fant ingen lenker")),
    ).toBe(true)
  })

  it("feiloppsummeringen med lenker som peker på ingenting", async () => {
    // Uten et klikk. En lenke som ikke fører noe sted er like ødelagt om
    // ingen prøver den, og den som leser oppsummeringen har nettopp
    // mislyktes med et skjema. Hver lenke sier fra om seg selv.
    const advarsel = lytt()

    monter(`
      <lt-error-summary class="lt-error-summary" role="alert" tabindex="-1">
        <h2 class="lt-error-summary__title">Skjemaet har to feil</h2>
        <ul class="lt-list">
          <li><a href="#finnes-ikke">Skriv en gyldig adresse</a></li>
          <li><a href="#heller-ikke">Velg en kommune</a></li>
        </ul>
      </lt-error-summary>
    `)
    await ventTilRo()

    const sagt = meldinger(advarsel)
    expect(sagt.some((m) => m.includes("#finnes-ikke"))).toBe(true)
    expect(sagt.some((m) => m.includes("#heller-ikke"))).toBe(true)
  })

  it("sier det én gang, ikke én gang per synkronisering", async () => {
    const advarsel = lytt()

    const flate = monter(`
      <lt-field>
        <label class="lt-label">E-post</label>
      </lt-field>
    `)
    const felt = flate.querySelector("lt-field") as HTMLElement
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
      <lt-tabs>
        <ul class="lt-tabs__list" aria-label="Deler av saken">
          <li><a href="#en">En</a></li>
          <li><a href="#to">To</a></li>
          <li><a href="#tre">Tre</a></li>
        </ul>
      </lt-tabs>
    `)
    const faner = flate.querySelector("lt-tabs") as HTMLElement
    await ventTilRo()

    // To av tre paneler, ett om gangen. Den tredje fanen står uten panel hele tiden.
    for (const id of ["en", "to"]) {
      const panel = document.createElement("section")
      panel.className = "lt-tabs__panel"
      panel.id = id
      faner.append(panel)
      await ventTilRo()
    }

    expect(
      meldinger(advarsel).filter((m) => m.includes("faner uten et panel")),
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
      <lt-field>
        <label class="lt-label" for="epost">E-post</label>
      </lt-field>
    `)
    const kontroll = document.createElement("input")
    kontroll.className = "lt-input"
    kontroll.id = "epost"
    flate.querySelector("lt-field")?.append(kontroll)

    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("sier ingenting om et tomt område serveren ikke har fylt", async () => {
    const advarsel = lytt()

    monter(`
      <div>
        <lt-field></lt-field>
        <lt-tabs></lt-tabs>
        <lt-dialog></lt-dialog>
        <lt-popover></lt-popover>
        <lt-suggestion></lt-suggestion>
        <lt-error-summary hidden></lt-error-summary>
        <lt-session-timeout></lt-session-timeout>
      </div>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("sier ingenting om markup som henger sammen", async () => {
    const advarsel = lytt()

    monter(`
      <div>
        <lt-field>
          <label class="lt-label" for="epost">E-post</label>
          <input class="lt-input" id="epost" />
          <p class="lt-help-text">Vi sender aldri spam.</p>
        </lt-field>

        <lt-field>
          <label class="lt-label">Telefon <input class="lt-input" type="tel" /></label>
        </lt-field>

        <lt-tabs>
          <ul class="lt-tabs__list" aria-label="Deler av saken">
            <li><a href="#sak-soknaden">Søknaden</a></li>
            <li><a href="#sak-vedlegg">Vedlegg</a></li>
          </ul>
          <section class="lt-tabs__panel" id="sak-soknaden"><h2>Søknaden</h2>Søknaden kom 3. mars.</section>
          <section class="lt-tabs__panel" id="sak-vedlegg"><h2>Vedlegg</h2>To vedlegg.</section>
        </lt-tabs>

        <lt-dialog>
          <dialog class="lt-dialog" aria-labelledby="boks-tittel">
            <h2 class="lt-dialog__title" id="boks-tittel">Vedtaket er registrert</h2>
            <div class="lt-dialog__body"><p>Saken er ferdigbehandlet.</p></div>
            <form method="dialog" class="lt-dialog__footer">
              <button class="lt-button" value="lukk">Lukk</button>
            </form>
          </dialog>
        </lt-dialog>

        <lt-popover>
          <button class="lt-button" aria-expanded="false"
                  aria-controls="handlinger">Handlinger</button>
          <div popover id="handlinger" class="lt-popover__panel">Flytt saken</div>
        </lt-popover>

        <lt-suggestion>
          <label class="lt-label" for="kommune">Kommune</label>
          <input class="lt-input" id="kommune" role="combobox"
                 aria-expanded="false" aria-controls="kommuner"
                 aria-autocomplete="list" />
          <ul class="lt-suggestion__list" id="kommuner" role="listbox" hidden>
            <li class="lt-suggestion__option" id="kommune-0" role="option"
                aria-selected="false">Bergen</li>
          </ul>
          <span class="lt-sr-only" role="status"></span>
        </lt-suggestion>

        <lt-error-summary class="lt-error-summary" role="alert" tabindex="-1"
                          data-autofocus="false">
          <h2 class="lt-error-summary__title">Skjemaet har én feil</h2>
          <ul class="lt-list"><li><a href="#kommune">Velg en kommune</a></li></ul>
        </lt-error-summary>

        <lt-session-timeout data-ignore-morph>
          <dialog class="lt-session-timeout__dialog" role="alertdialog"
                  aria-labelledby="okt-tittel">
            <h2 class="lt-session-timeout__title" id="okt-tittel">Du blir snart logget ut</h2>
            <p class="lt-session-timeout__text">Vi logger deg ut om
              <span class="lt-session-timeout__count" aria-hidden="true"></span>.</p>
            <span class="lt-sr-only" role="status"></span>
            <form method="dialog" class="lt-session-timeout__actions">
              <button class="lt-button" value="extend">Fortsett å være innlogget</button>
              <button class="lt-button" data-variant="secondary" value="logout">Logg ut nå</button>
            </form>
          </dialog>
        </lt-session-timeout>
      </div>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })
})
