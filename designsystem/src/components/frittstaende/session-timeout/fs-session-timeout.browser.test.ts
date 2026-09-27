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
  extendSession,
  FsSessionTimeout,
  resetSession,
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

describe("fs-session-timeout tåler Escape, feil tall og et utløp", () => {
  beforeAll(() => {
    defineFsSessionTimeout()
  })

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function monterKort(attributter = attr(KORT)) {
    monter(`<fs-session-timeout ${attributter}></fs-session-timeout>`)
    await customElements.whenDefined("fs-session-timeout")
    return document.querySelector("fs-session-timeout") as FsSessionTimeout
  }

  function lytt(vert: HTMLElement, navn: string[]) {
    const hendelser: string[] = []
    for (const n of navn) vert.addEventListener(n, () => hendelser.push(n))
    return hendelser
  }

  it("forlenger når brukeren lukker med Escape, og åpner ikke igjen", async () => {
    // Escape kommer fra nettleseren. Uten en lytter på `close` så neste tikk
    // en lukket dialog etter varselgrensen, og åpnet den igjen hvert sekund.
    const vert = await monterKort()
    const hendelser = lytt(vert, ["session-warn", "session-extend"])
    await gaFram(4)
    expect(dialog().open).toBe(true)

    // Slik nettleseren lukker på Escape: uten returverdi.
    dialog().close()
    await ventPaTegning()

    expect(hendelser).toEqual(["session-warn", "session-extend"])
    await gaFram(2)
    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-extend"])
  })

  it("leser opp tiden som er igjen i det dialogen åpnes", async () => {
    // Tallet i avsnittet er `aria-hidden`, så uten dette hørte skjermleseren
    // «Vi logger deg ut om  for å beskytte opplysningene dine», og første
    // tall kom først ved neste terskel.
    await monterKort(attr(sessionTimeout({ warnAt: 3, expiresAt: 30 })))
    await gaFram(3)

    const live = document.querySelector("[role='status']") as HTMLElement
    expect(dialog().open).toBe(true)
    expect(live.textContent).toBe("Du blir logget ut om 27 sekunder.")
  })

  it("sier fra om tall som ikke henger sammen", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    await monterKort('warn-at="10" expires-at="5"')
    await ventPaTegning()
    await ventPaTegning()

    expect(
      advarsel.mock.calls.some((k) =>
        String(k[0]).includes("ikke er mindre enn"),
      ),
    ).toBe(true)

    advarsel.mockClear()
    const vert = await monterKort('warn-at="abc" expires-at="-3"')
    await ventPaTegning()
    await ventPaTegning()

    expect(advarsel.mock.calls.some((k) => String(k[0]).includes("tall"))).toBe(
      true,
    )
    expect(vert.warnAt).toBe(25 * 60)
    expect(vert.expiresAt).toBe(30 * 60)
  })

  it("stopper etter utløpet, til extend() kalles", async () => {
    // En app som ikke navigerer bort fikk ny dialog og ny `session-expired`
    // hvert `expires-at`-sekund, for en økt som alt var borte.
    const vert = await monterKort()
    const hendelser = lytt(vert, ["session-warn", "session-expired"])

    await gaFram(14)
    expect(hendelser).toEqual(["session-warn", "session-expired"])

    await gaFram(14)
    expect(hendelser).toEqual(["session-warn", "session-expired"])
    expect(dialog().open).toBe(false)

    vert.extend()
    await gaFram(4)
    expect(dialog().open).toBe(true)
  })

  it("lar warnAt og expiresAt settes som egenskaper", async () => {
    const vert = await monterKort()
    vert.warnAt = 5
    vert.expiresAt = 9
    expect(vert.getAttribute("warn-at")).toBe("5")
    expect(vert.getAttribute("expires-at")).toBe("9")
    expect(vert.warnAt).toBe(5)
  })

  it("teller rulling i en boks som aktivitet", async () => {
    // `scroll` bobler ikke. Lyttet uten fangst telte bare rulling av selve
    // siden, mens dokumentasjonen lovet «rulling».
    monter(`
      <fs-session-timeout ${attr(KORT)}></fs-session-timeout>
      <div id="boks" style="overflow: auto; height: 20px"><div style="height: 200px"></div></div>
    `)
    await customElements.whenDefined("fs-session-timeout")

    await gaFram(2)
    ;(document.getElementById("boks") as HTMLElement).dispatchEvent(
      new Event("scroll"),
    )
    await gaFram(2)
    expect(document.querySelector("dialog")?.open ?? false).toBe(false)

    await gaFram(2)
    expect(dialog().open).toBe(true)
  })

  it("nullstiller uten å melde fra med reset()", async () => {
    const vert = await monterKort()
    const hendelser = lytt(vert, ["session-extend"])
    await gaFram(4)
    expect(dialog().open).toBe(true)

    vert.reset()
    await ventPaTegning()

    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual([])
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("melder session-logout når brukeren logger ut, uten å forlenge", async () => {
    const vert = await monterKort()
    const hendelser = lytt(vert, [
      "session-logout",
      "session-extend",
      "session-warn",
    ])
    await gaFram(4)
    ;(
      document.querySelectorAll(
        ".fs-session-timeout__actions button",
      )[1] as HTMLElement
    ).click()
    await ventPaTegning()

    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-logout"])

    // Og den kommer ikke tilbake mens appen logger ut.
    await gaFram(3)
    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-logout"])
  })

  it("gir hver forekomst sin egen overskrift", async () => {
    monter(`
      <fs-session-timeout ${attr(KORT)}></fs-session-timeout>
      <fs-session-timeout ${attr(KORT)}></fs-session-timeout>
    `)
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(4)

    const ider = [...document.querySelectorAll("dialog")].map((d) =>
      d.getAttribute("aria-labelledby"),
    )
    expect(ider).toHaveLength(2)
    expect(ider[0]).not.toBe(ider[1])
    for (const id of ider) {
      expect(document.getElementById(id as string)).not.toBeNull()
    }
  })
})

/*
 * Et sent registrert tagnavn, som en underklasse: konstruktøren til
 * `fs-session-timeout` kan ikke registreres én gang til.
 */
describe("extendSession() og resetSession() venter på registreringen", () => {
  it("sender session-extend først når elementet er oppgradert", async () => {
    monter(
      `<fs-session-timeout-sen class="fs-session-timeout" warn-at="3" expires-at="13"></fs-session-timeout-sen>`,
    )
    const element = document.querySelector("fs-session-timeout-sen") as Element
    const forlenget: Event[] = []
    element.addEventListener("session-extend", (e) => forlenget.push(e))

    let ferdig = false
    const løfte = extendSession(element).then(() => {
      ferdig = true
    })
    await ventPaTegning()
    expect(ferdig).toBe(false)
    expect(forlenget).toHaveLength(0)

    customElements.define(
      "fs-session-timeout-sen",
      class extends FsSessionTimeout {},
    )

    await løfte
    expect(forlenget).toHaveLength(1)

    await resetSession(element)
    expect(forlenget).toHaveLength(1)
  })
})
