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
import { type SessionTimeoutOptions, sessionTimeout } from "./session-timeout"

import "../../../tokens/tokens.css"
import "./session-timeout.css"

/**
 * Kort økt: varsel etter 3 sekunder, ute etter 13.
 *
 * Hvert simulerte sekund er ett kall til tidtakeren, og i Firefox koster hvert
 * av dem en rundtur. Med minutter i testen tok den over et minutt å kjøre.
 * Tallene er valgt slik at nedtellingen passerer 10 sekunder, som er den
 * terskelen komponenten leser opp.
 */
const KORT = { warnAt: 3, expiresAt: 13 }

type Tekster = {
  tittel: string
  før: string
  etter: string
  bli: string
  ut: string
}

const NORSK: Tekster = {
  tittel: "Du blir snart logget ut",
  før: "Vi logger deg ut om",
  etter: "for å beskytte opplysningene dine.",
  bli: "Fortsett å være innlogget",
  ut: "Logg ut nå",
}

const ENGELSK: Tekster = {
  tittel: "You will soon be signed out",
  før: "We will sign you out in",
  etter: "to protect your information.",
  bli: "Stay signed in",
  ut: "Sign out now",
}

/** Varselet slik den som rendrer skriver det, med byggefunksjonen. */
function varsel(
  valg: Partial<SessionTimeoutOptions> = KORT,
  tekster: Tekster = NORSK,
): string {
  const okt = sessionTimeout({ titleId: "okt-tittel", ...valg })
  return `
    <fs-session-timeout ${attr(okt.host)}>
      <dialog ${attr(okt.dialog)}>
        <h2 ${attr(okt.title)}>${tekster.tittel}</h2>
        <p ${attr(okt.text)}>${tekster.før} <span ${attr(okt.count)}></span> ${tekster.etter}</p>
        <span ${attr(okt.live)}></span>
        <form ${attr(okt.actions)}>
          <button ${attr(okt.extend)}>${tekster.bli}</button>
          <button ${attr(okt.logout)}>${tekster.ut}</button>
        </form>
      </dialog>
    </fs-session-timeout>`
}

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement
}

function vert(): FsSessionTimeout {
  return document.querySelector("fs-session-timeout") as FsSessionTimeout
}

function opplest(): string {
  return dialog().querySelector("[role='status']")?.textContent ?? ""
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

/**
 * Lukker dialogen og venter på `close`.
 *
 * `close` er en køet oppgave, og i Firefox kom tegningen før hendelsen én
 * gang av ti. Komponentens lytter står på verten i fangstfasen, og kjører
 * derfor før denne, som står på dialogen.
 */
async function lukk(handling: () => void) {
  const lukket = new Promise((r) =>
    dialog().addEventListener("close", r, { once: true }),
  )
  handling()
  await lukket
}

function knapp(verdi: string): HTMLButtonElement {
  return dialog().querySelector(`button[value="${verdi}"]`) as HTMLButtonElement
}

function lytt(element: HTMLElement, navn: string[]) {
  const hendelser: string[] = []
  for (const n of navn) element.addEventListener(n, () => hendelser.push(n))
  return hendelser
}

// requestAnimationFrame må være ekte. Faker vi den også, henger
// ventPaTegning, fordi ingenting flytter klokka mens den venter.
function falskKlokke() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  })
}

describe("fs-session-timeout", () => {
  beforeAll(() => {
    defineFsSessionTimeout()
  })

  beforeEach(async () => {
    falskKlokke()
    monter(`<div lang="nb">${varsel()}</div>`)
    await customElements.whenDefined("fs-session-timeout")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("ber serveren la dialogen være i fred", () => {
    // Uten dette river Datastars morfing `open` bort mens dialogen står i
    // topplaget.
    expect(vert().hasAttribute("data-ignore-morph")).toBe(true)
  })

  it("viser ingenting før varselet skal komme", async () => {
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("varsler når det har vært stille lenge nok", async () => {
    await gaFram(4)

    expect(dialog().open).toBe(true)
    expect(dialog().matches(":modal")).toBe(true)
    expect(dialog().getAttribute("role")).toBe("alertdialog")
  })

  it("teller ned mot utløpet", async () => {
    await gaFram(5)

    const tall = dialog().querySelector(
      ".fs-session-timeout__count",
    ) as HTMLElement
    // 13 - 5 = 8 sekunder igjen
    expect(tall.textContent).toBe("0:08")
    // Tallet endrer seg hvert sekund. Leses det opp hver gang, er dialogen
    // ubrukelig med skjermleser.
    expect(tall.getAttribute("aria-hidden")).toBe("true")
  })

  it("leser opp avsnittet ved noen terskler, ikke hvert sekund", async () => {
    await gaFram(3)
    expect(opplest()).toBe(
      "Vi logger deg ut om 10 sekunder for å beskytte opplysningene dine.",
    )

    await gaFram(1)
    // Ingen ny opplesning ett sekund senere.
    expect(opplest()).toBe(
      "Vi logger deg ut om 10 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("forlenger når brukeren trykker på knappen med value=extend", async () => {
    await gaFram(4)
    const hendelser = lytt(vert(), ["session-extend"])

    await lukk(() => knapp("extend").click())

    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-extend"])

    // Og klokka er nullstilt, så varselet kommer ikke rett tilbake.
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("melder fra når økten faktisk er ute", async () => {
    const hendelser = lytt(vert(), ["session-expired"])

    await gaFram(14)

    expect(hendelser).toEqual(["session-expired"])
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
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function monterKort(markup = varsel()) {
    monter(`<div lang="nb">${markup}</div>`)
    await customElements.whenDefined("fs-session-timeout")
    return vert()
  }

  it("forlenger når brukeren lukker med Escape, og åpner ikke igjen", async () => {
    // Escape kommer fra nettleseren og lukker uten returverdi. Uten en lytter
    // på `close` så neste tikk en lukket dialog etter varselgrensen, og
    // åpnet den igjen hvert sekund.
    const element = await monterKort()
    const hendelser = lytt(element, ["session-warn", "session-extend"])
    await gaFram(4)
    expect(dialog().open).toBe(true)

    await lukk(() => dialog().close())

    expect(hendelser).toEqual(["session-warn", "session-extend"])
    await gaFram(2)
    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-extend"])
  })

  it("forlenger også for en knapp med en verdi komponenten ikke kjenner", async () => {
    // Uten dette ble dialogen lukket, og neste tikk åpnet den igjen ett
    // sekund senere, så brukeren kom seg aldri ut.
    const element = await monterKort(
      varsel().replace('value="extend"', 'value="ok"'),
    )
    const hendelser = lytt(element, ["session-extend"])
    await gaFram(4)

    await lukk(() => knapp("ok").click())

    expect(hendelser).toEqual(["session-extend"])
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("leser opp tiden som er igjen i det dialogen åpnes", async () => {
    // Tallet i avsnittet er `aria-hidden`, så uten dette hørte skjermleseren
    // avsnittet uten tall, og første tall kom først ved neste terskel.
    await monterKort(varsel({ warnAt: 3, expiresAt: 30 }))
    await gaFram(3)

    expect(dialog().open).toBe(true)
    expect(opplest()).toBe(
      "Vi logger deg ut om 27 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("sier fra om tall som ikke henger sammen", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    await monterKort(varsel({ warnAt: 10, expiresAt: 5 }))
    await ventPaTegning()
    await ventPaTegning()

    expect(
      advarsel.mock.calls.some((k) =>
        String(k[0]).includes("ikke er mindre enn"),
      ),
    ).toBe(true)

    advarsel.mockClear()
    const element = await monterKort(
      varsel().replace(/warn-at="\d+"/, 'warn-at="abc"'),
    )
    element.setAttribute("expires-at", "-3")
    await ventPaTegning()
    await ventPaTegning()

    expect(advarsel.mock.calls.some((k) => String(k[0]).includes("tall"))).toBe(
      true,
    )
    expect(element.warnAt).toBe(25 * 60)
    expect(element.expiresAt).toBe(30 * 60)
  })

  it("stopper etter utløpet, til extend() kalles", async () => {
    // En app som ikke navigerer bort fikk ny dialog og ny `session-expired`
    // hvert `expires-at`-sekund, for en økt som alt var borte.
    const element = await monterKort()
    const hendelser = lytt(element, ["session-warn", "session-expired"])

    await gaFram(14)
    expect(hendelser).toEqual(["session-warn", "session-expired"])

    await gaFram(14)
    expect(hendelser).toEqual(["session-warn", "session-expired"])
    expect(dialog().open).toBe(false)

    element.extend()
    await gaFram(4)
    expect(dialog().open).toBe(true)
  })

  it("lar warnAt og expiresAt settes som egenskaper", async () => {
    const element = await monterKort()
    element.warnAt = 5
    element.expiresAt = 9
    expect(element.getAttribute("warn-at")).toBe("5")
    expect(element.getAttribute("expires-at")).toBe("9")
    expect(element.warnAt).toBe(5)
  })

  it("teller rulling i en boks som aktivitet", async () => {
    // `scroll` bobler ikke. Lyttet uten fangst telte bare rulling av selve
    // siden, mens dokumentasjonen lovet «rulling».
    await monterKort(
      `${varsel()}<div id="boks" style="overflow: auto; height: 20px"><div style="height: 200px"></div></div>`,
    )

    await gaFram(2)
    ;(document.getElementById("boks") as HTMLElement).dispatchEvent(
      new Event("scroll"),
    )
    await gaFram(2)
    expect(dialog().open).toBe(false)

    await gaFram(2)
    expect(dialog().open).toBe(true)
  })

  it("nullstiller uten å melde fra med reset()", async () => {
    const element = await monterKort()
    const hendelser = lytt(element, ["session-extend"])
    await gaFram(4)
    expect(dialog().open).toBe(true)

    await lukk(() => element.reset())

    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual([])
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("melder session-logout når brukeren logger ut, uten å forlenge", async () => {
    const element = await monterKort()
    const hendelser = lytt(element, [
      "session-logout",
      "session-extend",
      "session-warn",
    ])
    await gaFram(4)

    await lukk(() => knapp("logout").click())

    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-logout"])

    // Og den kommer ikke tilbake mens appen logger ut.
    await gaFram(3)
    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-logout"])
  })

  it("melder utlogging selv om klokka tikker før close kommer", async () => {
    // `close` kommer i en senere oppgave enn klikket. Tikket klokka imellom,
    // åpnet komponenten dialogen igjen, og den køede hendelsen ble lest som
    // en forlengelse: appen fikk `session-extend` og aldri `session-logout`.
    const element = await monterKort()
    const hendelser = lytt(element, [
      "session-warn",
      "session-extend",
      "session-logout",
    ])
    await gaFram(4)

    const lukket = new Promise((r) =>
      dialog().addEventListener("close", r, { once: true }),
    )
    knapp("logout").click()
    await gaFram(1)
    await lukket
    await gaFram(2)

    expect(hendelser).toEqual(["session-warn", "session-logout"])
    expect(dialog().open).toBe(false)
  })

  it("fyller inn rollen og navnet på en bar dialog", async () => {
    // En mal uten byggefunksjonen kan glemme dem. Tilgjengeligheten krever
    // begge, så komponenten setter dem når de mangler, og bare da.
    await monterKort(`
      <fs-session-timeout warn-at="3" expires-at="13">
        <dialog>
          <h2>Du blir snart logget ut</h2>
          <p class="fs-session-timeout__text">Vi logger deg ut om
            <span class="fs-session-timeout__count" aria-hidden="true"></span>.</p>
          <span class="fs-sr-only" role="status"></span>
          <form method="dialog"><button value="extend">Fortsett</button></form>
        </dialog>
      </fs-session-timeout>`)
    await gaFram(4)

    expect(dialog().getAttribute("role")).toBe("alertdialog")
    const tittel = document.getElementById(
      dialog().getAttribute("aria-labelledby") ?? "",
    )
    expect(tittel?.textContent).toBe("Du blir snart logget ut")
  })

  it("lar et navn den som rendrer har skrevet, stå", async () => {
    await monterKort(
      varsel().replace(
        'aria-labelledby="okt-tittel"',
        'aria-label="Økten går ut"',
      ),
    )
    await gaFram(4)

    expect(dialog().getAttribute("aria-label")).toBe("Økten går ut")
    expect(dialog().hasAttribute("aria-labelledby")).toBe(false)
  })
})

describe("fs-session-timeout rører ikke markupen fra byggefunksjonen", () => {
  beforeAll(() => {
    defineFsSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("gir ingen mutasjonsposter før varselet", async () => {
    // Den direkte påstanden bak «det den som rendrer skrev, står»: markup fra
    // byggefunksjonen har alt komponenten ville fylt inn.
    const flate = monter(`<div id="flate" lang="nb"></div>`)
    const beholder = flate.querySelector("#flate") as HTMLElement
    const poster: MutationRecord[] = []
    const observator = new MutationObserver((p) => poster.push(...p))
    observator.observe(beholder, {
      subtree: true,
      attributes: true,
      characterData: true,
      childList: true,
    })

    beholder.innerHTML = varsel()
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(2)
    poster.push(...observator.takeRecords())
    observator.disconnect()

    const fraKomponenten = poster.filter((p) => p.target !== beholder)
    expect(fraKomponenten).toEqual([])
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

    // `reset()` sender ingenting, så kallet må ses på metoden selv.
    const nullstilt = vi.spyOn(FsSessionTimeout.prototype, "reset")
    await resetSession(element)
    expect(nullstilt).toHaveBeenCalledTimes(1)
    expect(forlenget).toHaveLength(1)
    nullstilt.mockRestore()
  })
})

describe("fs-session-timeout: opplesning på sidens språk, og flytting", () => {
  beforeAll(() => {
    defineFsSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("leser opp det samme som tallet viser når det ikke er hele minutter", async () => {
    // Rundet av sa opplesningen «2 minutter» mens tallet viste 1:30.
    monter(`<div lang="nb">${varsel({ warnAt: 1, expiresAt: 91 })}</div>`)
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(1)

    expect(opplest()).toBe(
      "Vi logger deg ut om 1 minutt og 30 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("leser opp på engelsk på en engelsk side, uten at noen oversetter tiden", async () => {
    monter(
      `<div lang="en">${varsel({ warnAt: 1, expiresAt: 91 }, ENGELSK)}</div>`,
    )
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(1)

    expect(opplest()).toBe(
      "We will sign you out in 1 minute and 30 seconds to protect your information.",
    )
  })

  it("leser opp med nettleserens språk når lang ikke er en språkkode", async () => {
    // `Intl` kaster på en ugyldig kode. Da er nettleserens språk bedre enn
    // ingen opplesning.
    monter(`<div lang="!!">${varsel({ warnAt: 1, expiresAt: 91 })}</div>`)
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(1)

    expect(opplest()).toMatch(/1.*30/)
  })

  it("finner lang utenfor en skyggerot", async () => {
    // `closest()` stopper ved skyggeroten. Hver forhåndsvisning i
    // dokumentasjonen ligger i en, og uten dette leste demoen opp på
    // nettleserens språk på en norsk side.
    // Norsk og ikke engelsk: nettleseren testene kjører i, har engelsk som
    // eget språk, og da ville engelsk gått gjennom også uten rettingen.
    const flate = monter(`<div lang="nb"><div id="vert"></div></div>`)
    const rot = (flate.querySelector("#vert") as HTMLElement).attachShadow({
      mode: "open",
    })
    rot.innerHTML = varsel({ warnAt: 1, expiresAt: 91 })
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(1)

    expect(rot.querySelector("[role='status']")?.textContent).toBe(
      "Vi logger deg ut om 1 minutt og 30 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("leser opp tiden alene når tallet står utenfor avsnittet", async () => {
    // Ellers ble avsnittet lest uten tall, og tallet på skjermen er
    // `aria-hidden`, så skjermleseren hørte aldri hvor lang tid som var igjen.
    monter(`
      <div lang="nb">
        <fs-session-timeout warn-at="1" expires-at="91">
          <dialog>
            <h2>Ut om <span class="fs-session-timeout__count" aria-hidden="true"></span></h2>
            <p class="fs-session-timeout__text">Lagre det du holder på med.</p>
            <span class="fs-sr-only" role="status"></span>
            <form method="dialog"><button value="extend">Fortsett</button></form>
          </dialog>
        </fs-session-timeout>
      </div>`)
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(1)

    expect(opplest()).toBe("1 minutt og 30 sekunder")
  })

  it("er fortsatt modal etter at elementet er flyttet mens varselet står", async () => {
    const flate = monter(`${varsel()}<div id="annet"></div>`)
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(3)
    expect(dialog().matches(":modal")).toBe(true)

    flate.querySelector("#annet")?.append(vert())

    expect(dialog().open).toBe(true)
    expect(dialog().matches(":modal")).toBe(true)
  })
})

describe("fs-session-timeout når warn-at heves mens varselet står", () => {
  beforeAll(() => {
    defineFsSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("lar nedtellingen gå videre", async () => {
    monter(varsel())
    await customElements.whenDefined("fs-session-timeout")
    await gaFram(4)
    const tall = () => dialog().textContent?.match(/\d+:\d+/)?.[0]
    const for_ = tall()

    vert().setAttribute("warn-at", "12")
    await gaFram(3)

    expect(dialog().open).toBe(true)
    expect(tall(), "tallet frøs").not.toBe(for_)
  })
})
