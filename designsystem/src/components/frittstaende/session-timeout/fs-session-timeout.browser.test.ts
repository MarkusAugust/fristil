/// <reference path="../../../types/css.d.ts" />

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import {
  defineFsSessionTimeout,
  type FsSessionTimeout,
} from "./fs-session-timeout"
import { sessionTimeout } from "./session-timeout"

import "../../../tokens/tokens.css"
import "./session-timeout.css"
import "../../css/sr-only/sr-only.css"

/**
 * Kort økt: varsel etter 3 sekunder, ute etter 13.
 *
 * Hvert simulerte sekund er ett kall til tidtakeren, og i Firefox koster hvert
 * av dem en rundtur. Med minutter i testen tok den over et minutt å kjøre.
 * Tallene er valgt slik at nedtellingen passerer 10 sekunder, som er den
 * terskelen komponenten leser opp.
 */
const KORT = sessionTimeout({ warnAt: 3, expiresAt: 13 })

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement
}

/**
 * Flytter klokka uten å vente på den.
 *
 * Her ventes det bare på tidtakeren, ikke på en tegning. Komponenten gjør alt
 * arbeidet synkront inne i intervallet, så en `requestAnimationFrame` ville
 * bare vært noe ekstra å vente på, og i Firefox fyrte den ikke mens dialogen
 * åpnet seg. Testen hang da uten feilmelding.
 */
async function gaFram(sekunder: number) {
  await vi.advanceTimersByTimeAsync(sekunder * 1000)
}

describe("fs-session-timeout", () => {
  beforeAll(() => {
    defineFsSessionTimeout()
  })

  beforeEach(async () => {
    // requestAnimationFrame må være ekte. Faker vi den også, henger
    // ventPaTegning, fordi ingenting flytter klokka mens den venter.
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    })
    monter(`<fs-session-timeout ${attr(KORT)}></fs-session-timeout>`)
    await customElements.whenDefined("fs-session-timeout")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("ber serveren la dialogen være i fred", () => {
    const vert = document.querySelector("fs-session-timeout") as HTMLElement

    // Nedtellingen er klientens klokke. Uten dette river en patch dialogen
    // bort mens den står åpen.
    expect(vert.hasAttribute("data-ignore-morph")).toBe(true)
  })

  it("lager ingenting før varselet skal komme", async () => {
    await gaFram(2)

    // Dialogen bygges først når den skal vises. Sto den i DOM-en fra start,
    // fant React et element den ikke hadde rendret, og hydreringen feilet.
    expect(document.querySelector("dialog")).toBeNull()
  })

  it("varsler når det har vært stille lenge nok", async () => {
    await gaFram(4)

    expect(dialog().open).toBe(true)
    expect(dialog().getAttribute("role")).toBe("alertdialog")
  })

  it("teller ned mot utløpet", async () => {
    await gaFram(5)

    const tall = document.querySelector(
      ".fs-session-timeout__count",
    ) as HTMLElement
    // 13 - 5 = 8 sekunder igjen
    expect(tall.textContent).toBe("0:08")
    // Tallet endrer seg hvert sekund. Leses det opp hver gang, er dialogen
    // ubrukelig med skjermleser.
    expect(tall.getAttribute("aria-hidden")).toBe("true")
  })

  it("leser opp nedtellingen ved noen terskler, ikke hvert sekund", async () => {
    await gaFram(3)
    const live = document.querySelector("[role='status']") as HTMLElement
    expect(live.textContent).toBe("Du blir logget ut om 10 sekunder.")

    await gaFram(1)
    // Ingen ny opplesning ett sekund senere.
    expect(live.textContent).toBe("Du blir logget ut om 10 sekunder.")
  })

  it("lukker og melder fra når brukeren vil fortsette", async () => {
    await gaFram(4)

    const meldinger: string[] = []
    const vert = document.querySelector(
      "fs-session-timeout",
    ) as FsSessionTimeout
    vert.addEventListener("session-extend", () => meldinger.push("extend"))
    ;(
      document.querySelector(
        ".fs-session-timeout__actions button",
      ) as HTMLElement
    ).click()
    await ventPaTegning()

    expect(dialog().open).toBe(false)
    expect(meldinger).toEqual(["extend"])

    // Og klokka er nullstilt, så varselet kommer ikke rett tilbake.
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("melder fra når økten faktisk er ute", async () => {
    const utlopt: string[] = []
    const vert = document.querySelector(
      "fs-session-timeout",
    ) as FsSessionTimeout
    vert.addEventListener("session-expired", () => utlopt.push("ute"))

    await gaFram(14)

    expect(utlopt).toEqual(["ute"])
    expect(dialog().open).toBe(false)
  })

  it("har ingen tilgjengelighetsbrudd med varselet oppe", async () => {
    await gaFram(4)
    expect(dialog().open).toBe(true)

    vi.useRealTimers()
    await ventPaTegning()

    await forventIngenTilgjengelighetsbrudd()
  })
})
