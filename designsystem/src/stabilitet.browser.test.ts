import { beforeAll, describe, expect, it } from "vitest"
import { dialog } from "./components/ramme/dialog/dialog"
import { defineFsDialog } from "./components/ramme/dialog/fs-dialog"
import { defineFsField } from "./components/ramme/field/fs-field"
import { defineFsPopover } from "./components/ramme/popover/fs-popover"
import { popover } from "./components/ramme/popover/popover"
import { defineFsSuggestion } from "./components/ramme/suggestion/fs-suggestion"
import { suggestion } from "./components/ramme/suggestion/suggestion"
import { defineFsTabs } from "./components/ramme/tabs/fs-tabs"
import { tabs } from "./components/ramme/tabs/tabs"
import { monter, ventPaTegning } from "./testing/a11y"

/**
 * At en komponent ikke skriver i ring.
 *
 * Komponentene observerer de attributtene de selv setter, for å kunne sette
 * dem tilbake etter en patch. Skriver en av dem en verdi som alt står der,
 * teller det som en endring, observatøren kaller seg selv, og den skriver på
 * nytt. Testkjøringen henger da uten feilmelding, og det er den verste måten
 * å feile på: ingen stakksporing, ingen påstand, bare stillhet.
 *
 * Testen her gjør det brukeren gjør, lar det falle til ro, og teller så
 * mutasjoner over noen tegninger. Står tallet på null, har komponenten
 * sluttet å skrive.
 *
 * Den fanger en komponent som skriver litt for mye, men ikke en som skriver
 * i ring: da henger kjøringen her også. Selve regelen håndheves derfor av
 * `scripts/sjekk-skriving.ts`, som leser kilden og feiler på sekunder.
 */

const attr = (verdier: Record<string, unknown>) =>
  Object.entries(verdier)
    .map(([navn, verdi]) => (verdi === true ? navn : `${navn}="${verdi}"`))
    .join(" ")

/** Teller mutasjoner i et undertre over fire tegninger. */
async function mutasjonerEtterRo(rot: Element): Promise<number> {
  await ventPaTegning()
  await ventPaTegning()

  let antall = 0
  const observatør = new MutationObserver((poster) => {
    antall += poster.length
  })
  observatør.observe(rot, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  })

  for (let n = 0; n < 4; n += 1) await ventPaTegning()
  observatør.disconnect()
  return antall
}

describe("komponentene faller til ro", () => {
  beforeAll(() => {
    defineFsField()
    defineFsTabs()
    defineFsPopover()
    defineFsSuggestion()
    defineFsDialog()
  })

  it("feltet, etter at koblingen er satt", async () => {
    const flate = monter(`
      <fs-field invalid required-marker="symbol">
        <label class="fs-label">E-post</label>
        <input class="fs-input" type="email" />
        <p class="fs-help-text">Vi sender aldri spam.</p>
        <p class="fs-error-text">Skriv en gyldig adresse.</p>
      </fs-field>
    `)

    expect(await mutasjonerEtterRo(flate)).toBe(0)
  })

  it("fanene, etter at brukeren har valgt", async () => {
    const FANER = tabs({ id: "sak", count: 2 })
    const flate = monter(`
      <fs-tabs>
        <div ${attr(FANER.list)}>
          <button ${attr(FANER.tabs[0])}>Oversikt</button>
          <button ${attr(FANER.tabs[1])}>Vedlegg</button>
        </div>
        <div ${attr(FANER.panels[0])}>Sammendrag</div>
        <div ${attr(FANER.panels[1])}>Filer</div>
      </fs-tabs>
    `)
    await ventPaTegning()

    const knapper = [...flate.querySelectorAll("[role='tab']")] as HTMLElement[]
    knapper[1].click()

    expect(await mutasjonerEtterRo(flate)).toBe(0)
  })

  it("sprettoppvinduet, etter at det er åpnet", async () => {
    const SPRETT = popover({ id: "meny" })
    const flate = monter(`
      <fs-popover ${attr(SPRETT.host)}>
        <button ${attr(SPRETT.trigger)} class="fs-button">Handlinger</button>
        <ul ${attr(SPRETT.panel)}><li>Arkiver</li></ul>
      </fs-popover>
    `)
    await ventPaTegning()

    const vindu = flate.querySelector("fs-popover") as HTMLElement & {
      show(): void
    }
    vindu.show()

    expect(await mutasjonerEtterRo(flate)).toBe(0)
  })

  it("forslagsfeltet, etter at lista er åpnet og et alternativ markert", async () => {
    const FORSLAG = suggestion({ id: "kommune", count: 2 })
    const flate = monter(`
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div ${attr(FORSLAG.field)}>
          <input ${attr(FORSLAG.control)} name="kommune" />
          <ul ${attr(FORSLAG.list)}>
            <li ${attr(FORSLAG.options[0])}>Bergen</li>
            <li ${attr(FORSLAG.options[1])}>Bodø</li>
          </ul>
          <p ${attr(FORSLAG.empty)}>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </fs-suggestion>
    `)
    await ventPaTegning()

    const kontroll = flate.querySelector("input") as HTMLInputElement
    kontroll.focus()
    kontroll.dispatchEvent(new Event("input", { bubbles: true }))
    kontroll.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )

    expect(await mutasjonerEtterRo(flate)).toBe(0)
  })

  it("dialogen, etter at den er åpnet", async () => {
    const BOKS = dialog({ titleId: "tittel", open: true })
    const flate = monter(`
      <fs-dialog ${attr(BOKS.host)}>
        <dialog ${attr(BOKS.dialog)}>
          <h2 ${attr(BOKS.title)}>Vedtaket er registrert</h2>
          <div ${attr(BOKS.body)}><p>Saken er ferdigbehandlet.</p></div>
          <form method="dialog" ${attr(BOKS.footer)}>
            <button class="fs-button" value="lukk">Lukk</button>
          </form>
        </dialog>
      </fs-dialog>
    `)

    expect(await mutasjonerEtterRo(flate)).toBe(0)

    const boks = flate.querySelector("dialog") as HTMLDialogElement
    boks.close("lukk")
  })
})
