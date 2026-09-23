import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineFsDialog } from "./components/ramme/dialog/fs-dialog"
import { defineFsErrorSummary } from "./components/ramme/error-summary/fs-error-summary"
import { defineFsField } from "./components/ramme/field/fs-field"
import { defineFsPopover } from "./components/ramme/popover/fs-popover"
import { defineFsSuggestion } from "./components/ramme/suggestion/fs-suggestion"
import { defineFsTabs } from "./components/ramme/tabs/fs-tabs"
import { monter, ventPaTegning } from "./testing/a11y"

/**
 * At en komponent sier fra når markupen den fikk ikke henger sammen.
 *
 * Komponentene fester oppførsel på markup noen andre har skrevet, og den
 * markupen kan komme fra en Go-mal, en PHP-fil eller en publiseringsløsning
 * der ingen TypeScript-kompilator ser etter. Fant ikke komponenten delene
 * sine, gjorde den ingenting, uten et ord. Feilen viste seg først når noen
 * leste siden med skjermleser.
 *
 * Meldingen skal komme én gang per element. En komponent synkroniserer seg
 * ved hver patch, og en advarsel per patch ville fylt konsollen.
 */
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

  it("feltet uten en kontroll", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-field>
        <label class="fs-label">E-post</label>
        <p class="fs-help-text">Vi sender aldri spam.</p>
      </fs-field>
    `)
    await ventPaTegning()

    const meldinger = advarsel.mock.calls.map((kall) => String(kall[0]))
    expect(meldinger.some((m) => m.includes("fant ingen kontroll"))).toBe(true)
  })

  it("feltet uten en ledetekst", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-field>
        <input class="fs-input" />
      </fs-field>
    `)
    await ventPaTegning()

    expect(
      advarsel.mock.calls
        .map((kall) => String(kall[0]))
        .some((m) => m.includes("<label>")),
    ).toBe(true)
  })

  it("forslagsfeltet uten en combobox", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-suggestion>
        <label class="fs-label">Kommune</label>
        <input class="fs-input" />
      </fs-suggestion>
    `)
    await ventPaTegning()

    expect(
      advarsel.mock.calls
        .map((kall) => String(kall[0]))
        .some((m) => m.includes("combobox")),
    ).toBe(true)
  })

  it("sier det én gang, ikke én gang per synkronisering", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-field id="felt">
        <label class="fs-label">E-post</label>
      </fs-field>
    `)
    await ventPaTegning()

    // Hver endring i barna utløser en ny synkronisering, slik en patch gjør.
    const felt = document.getElementById("felt") as HTMLElement
    for (let n = 0; n < 5; n += 1) {
      felt.append(document.createElement("span"))
      await ventPaTegning()
    }

    const om = advarsel.mock.calls
      .map((kall) => String(kall[0]))
      .filter((m) => m.includes("fant ingen kontroll"))
    expect(om).toHaveLength(1)
  })

  it("fanene uten roller", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-tabs>
        <div class="fs-tabs__list">
          <button>Søknaden</button>
          <button>Vedlegg</button>
        </div>
      </fs-tabs>
    `)
    await ventPaTegning()

    expect(
      advarsel.mock.calls
        .map((kall) => String(kall[0]))
        .some((m) => m.includes("fant ingen faner")),
    ).toBe(true)
  })

  it("dialogen uten en <dialog>", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-dialog>
        <div class="fs-dialog">
          <h2 class="fs-dialog__title">Slette søknaden?</h2>
        </div>
      </fs-dialog>
    `)
    await ventPaTegning()

    expect(
      advarsel.mock.calls
        .map((kall) => String(kall[0]))
        .some((m) => m.includes("<dialog>")),
    ).toBe(true)
  })

  it("feiloppsummeringen med punkter som ikke lenker noe sted", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-error-summary class="fs-error-summary" role="alert" tabindex="-1">
        <h2 class="fs-error-summary__title">Skjemaet har én feil</h2>
        <ul class="fs-list"><li>Skriv en gyldig e-postadresse</li></ul>
      </fs-error-summary>
    `)
    await ventPaTegning()

    expect(
      advarsel.mock.calls
        .map((kall) => String(kall[0]))
        .some((m) => m.includes("fant ingen lenker")),
    ).toBe(true)
  })

  it("sier ingenting om et tomt område serveren ikke har fylt", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

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
    await ventPaTegning()

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("sier ingenting om markup som henger sammen", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    monter(`
      <fs-field>
        <label class="fs-label">E-post</label>
        <input class="fs-input" />
        <p class="fs-help-text">Vi sender aldri spam.</p>
      </fs-field>
    `)
    await ventPaTegning()

    expect(advarsel).not.toHaveBeenCalled()
  })
})
