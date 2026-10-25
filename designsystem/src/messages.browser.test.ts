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
 * That a component speaks up when the markup it was given does not hold
 * together, and only then.
 *
 * The components attach behaviour to markup someone else wrote, and that
 * markup can come from a Go template, a PHP file or a publishing system where
 * no TypeScript compiler is looking. If the component did not find its
 * parts, it did nothing, without a word. The error only showed when someone
 * read the page with a screen reader.
 *
 * The test that matters most is the last one: that correct markup produces
 * not a single word. A warning that also comes when everything is fine gets
 * switched off, and then it is worthless.
 */

/**
 * The warning only comes once the page has settled, that is after two
 * frames. Here we wait two rounds, so the check is done whichever of them
 * was scheduled first.
 */
async function ventTilRo(): Promise<void> {
  await ventPaTegning()
  await ventPaTegning()
}

function meldinger(advarsel: { mock: { calls: unknown[][] } }): string[] {
  return advarsel.mock.calls.map((kall) => String(kall[0]))
}

describe("the component reports markup that does not hold together", () => {
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

  it("the field without a control", async () => {
    const advarsel = lytt()

    monter(`
      <lt-field>
        <label class="lt-label">E-post</label>
        <p class="lt-help-text">Vi sender aldri spam.</p>
      </lt-field>
    `)
    await ventTilRo()

    expect(
      meldinger(advarsel).some((m) => m.includes("found no control")),
    ).toBe(true)
  })

  it("the field without a label", async () => {
    const advarsel = lytt()

    monter(`
      <lt-field>
        <input class="lt-input" />
      </lt-field>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("<label>"))).toBe(true)
  })

  it("but not when the field gets its name from aria-label", async () => {
    // A search field with only an icon has no visible label, and that is a
    // valid solution. A warning there would be wrong.
    const advarsel = lytt()

    monter(`
      <lt-field>
        <input class="lt-input lt-search" type="search" aria-label="Søk i saker" />
      </lt-field>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("but not when the label is outside the element", async () => {
    // A `<label for>` outside `<lt-field>` names the field just as well, and
    // the component connects it the same way as one inside.
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

  it("the field with more than one control", async () => {
    // Only the first control gets the wiring. The second has no label, and
    // that must be reported.
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
      meldinger(advarsel).filter((m) => m.includes("more than one control")),
    ).toHaveLength(1)
  })

  it("the label that neither has for nor wraps the field", async () => {
    /*
     * Without JavaScript the field then has no label. The component does not
     * create the id itself: an id the server did not send makes a server
     * update replace the field, along with focus and what the user has typed.
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
        m.includes("is not connected to the field"),
      ),
    ).toHaveLength(1)
    expect(flate.querySelector("input")?.hasAttribute("id")).toBe(false)
  })

  it("but not when the label wraps the field", async () => {
    const advarsel = lytt()

    monter(`
      <lt-field>
        <label class="lt-label">E-post <input class="lt-input" type="email" /></label>
      </lt-field>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("the field that was replaced because the id from the server changed", async () => {
    /*
     * A template that builds the id from a random number or a counter gives a
     * new id on every render, and a server update then does not recognise the
     * field. What the user typed is lost.
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
        m.includes("control's id was different from last time"),
      ),
    ).toHaveLength(1)
  })

  it("but not when the server sent a different field on purpose", async () => {
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

  it("but not when the second control is in a field inside", async () => {
    // A field in a field is ordinary markup: a search field in a popover
    // inside the field. Each field then has its own control.
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

  it("the dialog without a name", async () => {
    // No aria-labelledby, no aria-label, and the only heading is in the
    // body, where it belongs to the content and not to the dialog.
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
      meldinger(advarsel).filter((m) => m.includes("has no name")),
    ).toHaveLength(1)
  })

  it("but not about an empty dialog the server has not filled yet", async () => {
    const advarsel = lytt()

    monter(`
      <lt-dialog>
        <dialog></dialog>
      </lt-dialog>
    `)
    await ventTilRo()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("the tabs without links", async () => {
    // The tabs are links to the panels. A row with only buttons, as the tabs
    // used to be, has no tabs the component can connect.
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

    expect(meldinger(advarsel).some((m) => m.includes("found no tabs"))).toBe(
      true,
    )
  })

  it("tabs without a panel", async () => {
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
      meldinger(advarsel).some((m) => m.includes("tabs without a panel")),
    ).toBe(true)
  })

  it("the dialog without a <dialog>", async () => {
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

  it("the session timeout without a <dialog>", async () => {
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

  it("the session timeout without a count, announcement or buttons", async () => {
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

  it("the suggestion field without a field", async () => {
    // An `<input>` is enough: the component gives it the role. Without a
    // field at all it finds nothing to listen to.
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

  it("the suggestion field without a listbox", async () => {
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

  it("the suggestion field without a status element", async () => {
    // The number of matches is announced in the status element. Without it
    // the component stayed silent, and someone who cannot see the screen
    // never learnt that the list narrowed.
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

  it("the popover without a panel", async () => {
    const advarsel = lytt()

    monter(`
      <lt-popover>
        <button class="lt-button">Handlinger</button>
      </lt-popover>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("found no panel"))).toBe(
      true,
    )
  })

  it("the popover with a panel without an id", async () => {
    // The component never writes an id on the panel, so the button cannot be connected.
    const advarsel = lytt()

    monter(`
      <lt-popover>
        <button class="lt-button">Handlinger</button>
        <div class="lt-popover">Flytt saken</div>
      </lt-popover>
    `)
    await ventTilRo()

    const om = meldinger(advarsel).filter((m) =>
      m.includes("the panel has no id"),
    )
    expect(om).toHaveLength(1)
  })

  it("the popover without a button", async () => {
    // A button outside the panel is enough: the component connects it.
    // Without a single one, or with only one pointing to something else, it
    // finds none.
    const advarsel = lytt()

    monter(`
      <lt-popover>
        <a href="/handlinger" class="lt-link">Handlinger</a>
        <div popover id="handlinger" class="lt-popover">Flytt saken</div>
      </lt-popover>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("found no button"))).toBe(
      true,
    )
  })

  it("the error summary with items that link nowhere", async () => {
    const advarsel = lytt()

    monter(`
      <lt-error-summary class="lt-error-summary" role="alert" tabindex="-1">
        <h2 class="lt-error-summary__title">Skjemaet har én feil</h2>
        <ul class="lt-list"><li>Skriv en gyldig e-postadresse</li></ul>
      </lt-error-summary>
    `)
    await ventTilRo()

    expect(meldinger(advarsel).some((m) => m.includes("found no links"))).toBe(
      true,
    )
  })

  it("the error summary with links that point to nothing", async () => {
    // Without a click. A link that leads nowhere is just as broken if nobody
    // tries it, and whoever reads the summary has just failed with a form.
    // Each link reports itself.
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

  it("says it once, not once per sync", async () => {
    const advarsel = lytt()

    const flate = monter(`
      <lt-field>
        <label class="lt-label">E-post</label>
      </lt-field>
    `)
    const felt = flate.querySelector("lt-field") as HTMLElement
    await ventTilRo()

    // Every change to the children triggers a new sync, as a patch does.
    for (let n = 0; n < 5; n += 1) {
      felt.append(document.createElement("span"))
      await ventTilRo()
    }

    expect(
      meldinger(advarsel).filter((m) => m.includes("found no control")),
    ).toHaveLength(1)
  })

  it("also says it only once when the panels arrive one at a time", async () => {
    /*
     * The message must be the same every round.
     *
     * If the numbers were in the text, as in "has 3 tabs but 1 panels", each
     * round would be a new message, and the deduplication was gone: three
     * panels arriving one at a time gave three warnings.
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

    // Two of three panels, one at a time. The third tab has no panel throughout.
    for (const id of ["en", "to"]) {
      const panel = document.createElement("section")
      panel.className = "lt-tabs__panel"
      panel.id = id
      faner.append(panel)
      await ventTilRo()
    }

    expect(
      meldinger(advarsel).filter((m) => m.includes("tabs without a panel")),
    ).toHaveLength(1)
  })

  it("says nothing about markup that is completed in the next round", async () => {
    /*
     * HTML streamed from a server arrives in chunks, and a break between the
     * label and the field is entirely normal. The component sees its markup
     * the moment it is connected, and there it is half finished. The warning
     * waits until the page has settled, and checks again.
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

  it("says nothing about an empty region the server has not filled", async () => {
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

  it("says nothing about markup that holds together", async () => {
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
