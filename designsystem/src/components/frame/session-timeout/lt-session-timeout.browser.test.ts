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
  defineLtSessionTimeout,
  extendSession,
  LtSessionTimeout,
  resetSession,
} from "./lt-session-timeout"
import { type SessionTimeoutOptions, sessionTimeout } from "./session-timeout"

import "../../../tokens/tokens.css"
import "./session-timeout.css"

/**
 * A short session: warning after 3 seconds, expired after 13.
 *
 * Every simulated second is one call to the timer, and in Firefox each of
 * them costs a round trip. With minutes in the test it took over a minute to
 * run. The numbers are chosen so the countdown passes 10 seconds, which is
 * the threshold the component announces.
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

/** The warning as the renderer writes it, with the builder function. */
function varsel(
  valg: Partial<SessionTimeoutOptions> = KORT,
  tekster: Tekster = NORSK,
): string {
  const okt = sessionTimeout({ titleId: "okt-tittel", ...valg })
  return `
    <lt-session-timeout ${attr(okt.host)}>
      <dialog ${attr(okt.dialog)}>
        <h2 ${attr(okt.title)}>${tekster.tittel}</h2>
        <p ${attr(okt.text)}>${tekster.før} <span ${attr(okt.count)}></span> ${tekster.etter}</p>
        <span ${attr(okt.live)}></span>
        <form ${attr(okt.actions)}>
          <button ${attr(okt.extend)}>${tekster.bli}</button>
          <button ${attr(okt.logout)}>${tekster.ut}</button>
        </form>
      </dialog>
    </lt-session-timeout>`
}

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement
}

function vert(): LtSessionTimeout {
  return document.querySelector("lt-session-timeout") as LtSessionTimeout
}

function opplest(): string {
  return dialog().querySelector("[role='status']")?.textContent ?? ""
}

/**
 * Moves the clock without waiting for it.
 *
 * Only the timer is awaited here, not a frame. The component does all its
 * work synchronously inside the interval, so a `requestAnimationFrame` would
 * only be something extra to wait for, and in Firefox it did not fire while
 * the dialog was opening. The test then hung without an error.
 */
async function gaFram(sekunder: number) {
  await vi.advanceTimersByTimeAsync(sekunder * 1000)
}

/**
 * Closes the dialog and waits for `close`.
 *
 * `close` is a queued task, and in Firefox the frame came before the event
 * one time in ten. The component's listener is on the host in the capture
 * phase, and so runs before this one, which is on the dialog.
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

// requestAnimationFrame must be real. If we fake it too, ventPaTegning
// hangs, because nothing moves the clock while it waits.
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

describe("lt-session-timeout", () => {
  beforeAll(() => {
    defineLtSessionTimeout()
  })

  beforeEach(async () => {
    falskKlokke()
    monter(`<div lang="nb">${varsel()}</div>`)
    await customElements.whenDefined("lt-session-timeout")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("asks the server to leave the dialog alone", () => {
    // Without this Datastar's morph removes `open` while the dialog is in the
    // top layer.
    expect(vert().hasAttribute("data-ignore-morph")).toBe(true)
  })

  it("shows nothing before the warning is due", async () => {
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("warns when it has been quiet long enough", async () => {
    await gaFram(4)

    expect(dialog().open).toBe(true)
    expect(dialog().matches(":modal")).toBe(true)
    expect(dialog().getAttribute("role")).toBe("alertdialog")
  })

  it("counts down towards the expiry", async () => {
    await gaFram(5)

    const tall = dialog().querySelector(
      ".lt-session-timeout__count",
    ) as HTMLElement
    // 13 - 5 = 8 seconds left
    expect(tall.textContent).toBe("0:08")
    // The number changes every second. If it is announced every time, the
    // dialog is unusable with a screen reader.
    expect(tall.getAttribute("aria-hidden")).toBe("true")
  })

  it("announces the paragraph at a few thresholds, not every second", async () => {
    await gaFram(3)
    expect(opplest()).toBe(
      "Vi logger deg ut om 10 sekunder for å beskytte opplysningene dine.",
    )

    await gaFram(1)
    // No new announcement one second later.
    expect(opplest()).toBe(
      "Vi logger deg ut om 10 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("extends when the user presses the button with value=extend", async () => {
    await gaFram(4)
    const hendelser = lytt(vert(), ["session-extend"])

    await lukk(() => knapp("extend").click())

    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-extend"])

    // And the clock is reset, so the warning does not come straight back.
    await gaFram(2)
    expect(dialog().open).toBe(false)
  })

  it("reports when the session has actually expired", async () => {
    const hendelser = lytt(vert(), ["session-expired"])

    await gaFram(14)

    expect(hendelser).toEqual(["session-expired"])
    expect(dialog().open).toBe(false)
  })

  it("has no accessibility violations with the warning open", async () => {
    await gaFram(4)
    expect(dialog().open).toBe(true)

    vi.useRealTimers()
    await ventPaTegning()

    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("lt-session-timeout handles Escape, wrong numbers and an expiry", () => {
  beforeAll(() => {
    defineLtSessionTimeout()
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
    await customElements.whenDefined("lt-session-timeout")
    return vert()
  }

  it("extends when the user closes with Escape, and does not open again", async () => {
    // Escape comes from the browser and closes without a return value.
    // Without a listener on `close` the next tick saw a closed dialog after
    // the warning threshold, and opened it again every second.
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

  it("also extends for a button with a value the component does not know", async () => {
    // Without this the dialog closed, and the next tick opened it again a
    // second later, so the user never got out.
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

  it("announces the time left as the dialog opens", async () => {
    // The number in the paragraph is `aria-hidden`, so without this the screen
    // reader heard the paragraph without a number, and the first number came
    // only at the next threshold.
    await monterKort(varsel({ warnAt: 3, expiresAt: 30 }))
    await gaFram(3)

    expect(dialog().open).toBe(true)
    expect(opplest()).toBe(
      "Vi logger deg ut om 27 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("reports numbers that do not add up", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    await monterKort(varsel({ warnAt: 10, expiresAt: 5 }))
    await ventPaTegning()
    await ventPaTegning()

    expect(
      advarsel.mock.calls.some((k) =>
        String(k[0]).includes("is not less than"),
      ),
    ).toBe(true)

    advarsel.mockClear()
    const element = await monterKort(
      varsel().replace(/warn-at="\d+"/, 'warn-at="abc"'),
    )
    element.setAttribute("expires-at", "-3")
    await ventPaTegning()
    await ventPaTegning()

    expect(
      advarsel.mock.calls.some((k) => String(k[0]).includes("not a number")),
    ).toBe(true)
    expect(element.warnAt).toBe(25 * 60)
    expect(element.expiresAt).toBe(30 * 60)
  })

  it("stops after the expiry, until extend() is called", async () => {
    // An app that does not navigate away got a new dialog and a new
    // `session-expired` every `expires-at` seconds, for a session that was
    // already gone.
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

  it("lets warnAt and expiresAt be set as properties", async () => {
    const element = await monterKort()
    element.warnAt = 5
    element.expiresAt = 9
    expect(element.getAttribute("warn-at")).toBe("5")
    expect(element.getAttribute("expires-at")).toBe("9")
    expect(element.warnAt).toBe(5)
  })

  it("counts scrolling in a box as activity", async () => {
    // `scroll` does not bubble. Listened for without capture, only scrolling
    // of the page itself counted, while the documentation promised
    // "scrolling". A screen reader in browse mode sends only scrolling, no
    // key presses.
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

  it("does not report activity after the tab has been frozen past the expiry", async () => {
    // Before, `session-activity` and `session-expired` came in the same tick.
    const element = await monterKort(
      varsel({ warnAt: 100, expiresAt: 130, activityInterval: 20 }),
    )
    const hendelser = lytt(element, ["session-activity", "session-expired"])
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
    await gaFram(5)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))

    vi.setSystemTime(Date.now() + 200_000)
    await gaFram(1)

    expect(hendelser).toEqual(["session-activity", "session-expired"])
  })

  it("sends at most one activity a second, also with activity-interval 0", async () => {
    const element = await monterKort(
      varsel({ warnAt: 100, expiresAt: 130 }).replace(
        "<lt-session-timeout ",
        '<lt-session-timeout activity-interval="0" ',
      ),
    )
    const hendelser = lytt(element, ["session-activity"])
    for (let i = 0; i < 20; i++) {
      document.body.dispatchEvent(new Event("scroll"))
    }

    expect(hendelser).toEqual(["session-activity"])
  })

  it("does not report activity while the warning is showing", async () => {
    // The activity at 1 second waited for the end of the interval, which came
    // after the warning opened at 3. Then the app kept the server session
    // alive while the user was being asked to respond.
    const element = await monterKort(
      varsel({ warnAt: 3, expiresAt: 13, activityInterval: 5 }),
    )
    const hendelser = lytt(element, ["session-activity"])
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
    await gaFram(1)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
    await gaFram(6)

    expect(dialog().open).toBe(true)
    expect(hendelser).toEqual(["session-activity"])
  })

  it("reports activity at the start and the end of an interval", async () => {
    // The server session does not know about activity in the browser. Only
    // at the start, the server would have been up to a whole interval behind
    // the clock here, and signed out before the warning was done.
    const element = await monterKort(
      varsel({ warnAt: 100, expiresAt: 130, activityInterval: 20 }),
    )
    const start = Date.now()
    const tider: number[] = []
    element.addEventListener("session-activity", () =>
      tider.push(Math.round((Date.now() - start) / 1000)),
    )

    for (let sekund = 0; sekund < 50; sekund += 10) {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true }),
      )
      await gaFram(10)
    }

    // Activity at 0, 10, 20, 30 and 40. One event at 0, then one for each
    // interval with activity: at 20 and 40, as the key press came, and no
    // more.
    expect(tider).toEqual([0, 20, 40])
  })

  it("reports activity at the end of the interval, also without a new key press", async () => {
    const element = await monterKort(
      varsel({ warnAt: 100, expiresAt: 130, activityInterval: 20 }),
    )
    const start = Date.now()
    const tider: number[] = []
    element.addEventListener("session-activity", () =>
      tider.push(Math.round((Date.now() - start) / 1000)),
    )

    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
    await gaFram(5)
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
    await gaFram(30)

    // The last key press at 5 reaches the server at 20, not never.
    expect(tider).toEqual([0, 20])
  })

  it("resets without reporting anything with reset()", async () => {
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

  it("reports session-logout when the user signs out, without extending", async () => {
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

    // And it does not come back while the app is signing out.
    await gaFram(3)
    expect(dialog().open).toBe(false)
    expect(hendelser).toEqual(["session-warn", "session-logout"])
  })

  it("reports the sign-out even when the clock ticks before close arrives", async () => {
    // `close` arrives in a later task than the click. When the clock ticked
    // in between, the component opened the dialog again, and the queued event
    // was read as an extension: the app got `session-extend` and never
    // `session-logout`.
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

  it("puts open back when a morph takes it while the warning is showing", async () => {
    // Datastar's morph without data-ignore-morph removes `open`, since the
    // renderer did not send it. The dialog stayed in the top layer,
    // invisible, and the rest of the page was inert. Checked with real
    // Datastar 1.0.4.
    await monterKort(varsel().replace("data-ignore-morph", ""))
    await gaFram(4)
    expect(dialog().matches(":modal")).toBe(true)

    dialog().removeAttribute("open")
    await ventPaTegning()

    expect(dialog().open).toBe(true)
    expect(dialog().matches(":modal")).toBe(true)
  })

  it("leaves open removed when the user has closed the dialog", async () => {
    // The condition is `:modal`. A closed dialog has left the top layer, and
    // must not be opened again by the repair.
    await monterKort()
    await gaFram(4)

    await lukk(() => knapp("extend").click())
    await ventPaTegning()

    expect(dialog().open).toBe(false)
  })

  it("fills in the role and the name on a bare dialog", async () => {
    // A template without the builder function may forget them. Accessibility
    // requires both, so the component sets them when they are missing, and
    // only then.
    await monterKort(`
      <lt-session-timeout warn-at="3" expires-at="13">
        <dialog>
          <h2>Du blir snart logget ut</h2>
          <p class="lt-session-timeout__text">Vi logger deg ut om
            <span class="lt-session-timeout__count" aria-hidden="true"></span>.</p>
          <span class="lt-sr-only" role="status"></span>
          <form method="dialog"><button value="extend">Fortsett</button></form>
        </dialog>
      </lt-session-timeout>`)
    await gaFram(4)

    expect(dialog().getAttribute("role")).toBe("alertdialog")
    const tittel = document.getElementById(
      dialog().getAttribute("aria-labelledby") ?? "",
    )
    expect(tittel?.textContent).toBe("Du blir snart logget ut")
  })

  it("leaves a name the renderer has written in place", async () => {
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

describe("lt-session-timeout does not touch the markup from the builder function", () => {
  beforeAll(() => {
    defineLtSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("gives no mutation records before the warning", async () => {
    // The direct claim behind "what the renderer wrote stays": markup from
    // the builder function already has everything the component would fill
    // in.
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
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(2)
    poster.push(...observator.takeRecords())
    observator.disconnect()

    const fraKomponenten = poster.filter((p) => p.target !== beholder)
    expect(fraKomponenten).toEqual([])
  })
})

/*
 * A tag name registered late. `lt-session-timeout` has already taken the
 * constructor, so `defineLtSessionTimeout("lt-session-timeout-sen")`
 * registers a subclass of it.
 */
describe("extendSession() and resetSession() wait for the registration", () => {
  it("sends session-extend only once the element is upgraded", async () => {
    monter(
      `<lt-session-timeout-sen class="lt-session-timeout" warn-at="3" expires-at="13"></lt-session-timeout-sen>`,
    )
    const element = document.querySelector("lt-session-timeout-sen") as Element
    const forlenget: Event[] = []
    element.addEventListener("session-extend", (e) => forlenget.push(e))

    let ferdig = false
    const løfte = extendSession(element).then(() => {
      ferdig = true
    })
    await ventPaTegning()
    expect(ferdig).toBe(false)
    expect(forlenget).toHaveLength(0)

    defineLtSessionTimeout("lt-session-timeout-sen")

    await løfte
    expect(forlenget).toHaveLength(1)

    // `reset()` sends nothing, so the call must be seen on the method itself.
    const nullstilt = vi.spyOn(LtSessionTimeout.prototype, "reset")
    await resetSession(element)
    expect(nullstilt).toHaveBeenCalledTimes(1)
    expect(forlenget).toHaveLength(1)
    nullstilt.mockRestore()
  })
})

describe("lt-session-timeout: a threshold that is skipped", () => {
  beforeAll(() => {
    defineLtSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("announces when the clock jumps past a threshold", async () => {
    // A tick that comes late, or is throttled in a background tab, can jump
    // from 61 to 59. Before, the announcement required exactly 60.
    monter(`<div lang="nb">${varsel({ warnAt: 1, expiresAt: 70 })}</div>`)
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(9)
    expect(dialog().open).toBe(true)

    vi.setSystemTime(Date.now() + 1000)
    await gaFram(1)

    expect(
      dialog().querySelector(".lt-session-timeout__count")?.textContent,
    ).toBe("0:59")
    expect(opplest()).toContain("59 sekunder")
  })
})

describe("lt-session-timeout: announcements in the page language, and moving", () => {
  beforeAll(() => {
    defineLtSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("announces the same as the number shows when it is not whole minutes", async () => {
    // Rounded off, the announcement said "2 minutter" while the number
    // showed 1:30.
    monter(`<div lang="nb">${varsel({ warnAt: 1, expiresAt: 91 })}</div>`)
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(1)

    expect(opplest()).toBe(
      "Vi logger deg ut om 1 minutt og 30 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("announces in English on an English page, without anyone translating the time", async () => {
    monter(
      `<div lang="en">${varsel({ warnAt: 1, expiresAt: 91 }, ENGELSK)}</div>`,
    )
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(1)

    expect(opplest()).toBe(
      "We will sign you out in 1 minute and 30 seconds to protect your information.",
    )
  })

  it("announces in the browser's language when lang is not a language code", async () => {
    // `Intl` throws on an invalid code. Then the browser's language is better
    // than no announcement.
    monter(`<div lang="!!">${varsel({ warnAt: 1, expiresAt: 91 })}</div>`)
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(1)

    expect(opplest()).toMatch(/1.*30/)
  })

  it("finds lang outside a shadow root", async () => {
    // `closest()` stops at the shadow root. Every preview in the
    // documentation is in one, and without this the demo announced in the
    // browser's language on a Norwegian page.
    // Norwegian and not English: the browser the tests run in has English as
    // its language, and then English would have passed without the fix too.
    const flate = monter(`<div lang="nb"><div id="vert"></div></div>`)
    const rot = (flate.querySelector("#vert") as HTMLElement).attachShadow({
      mode: "open",
    })
    rot.innerHTML = varsel({ warnAt: 1, expiresAt: 91 })
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(1)

    expect(rot.querySelector("[role='status']")?.textContent).toBe(
      "Vi logger deg ut om 1 minutt og 30 sekunder for å beskytte opplysningene dine.",
    )
  })

  it("announces the time alone when the number is outside the paragraph", async () => {
    // Otherwise the paragraph was read without a number, and the number on
    // screen is `aria-hidden`, so the screen reader never heard how much time
    // was left.
    monter(`
      <div lang="nb">
        <lt-session-timeout warn-at="1" expires-at="91">
          <dialog>
            <h2>Ut om <span class="lt-session-timeout__count" aria-hidden="true"></span></h2>
            <p class="lt-session-timeout__text">Lagre det du holder på med.</p>
            <span class="lt-sr-only" role="status"></span>
            <form method="dialog"><button value="extend">Fortsett</button></form>
          </dialog>
        </lt-session-timeout>
      </div>`)
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(1)

    expect(opplest()).toBe("1 minutt og 30 sekunder")
  })

  /**
   * The component in a shadow root, as a shell with shadow DOM or a preview
   * places it. The field the user was in can be in the page or in the same
   * shadow root, and both must get focus back.
   *
   * The browser itself restores focus inside `close()`, before the `close`
   * event the component listens for. So focus is moved away again after
   * `close()`, so that it is the component's memory that shows when the
   * event arrives. If the memory is empty, or points to the shadow host,
   * focus stays on the button.
   */
  async function husketFokus(
    rot: ShadowRoot,
    felt: HTMLInputElement,
    annet: HTMLButtonElement,
  ) {
    felt.focus()
    await gaFram(1)
    const varselet = rot.querySelector("dialog") as HTMLDialogElement
    expect(varselet.open).toBe(true)
    const lukket = new Promise((r) =>
      varselet.addEventListener("close", r, { once: true }),
    )
    varselet.close("extend")
    annet.focus()
    await lukket
    const rotenTilFeltet = felt.getRootNode() as Document | ShadowRoot
    return rotenTilFeltet.activeElement
  }

  it("gives focus back to a field in the page when the component is in a shadow root", async () => {
    // The component's root has no `activeElement` when focus is outside it,
    // so read from there the component remembered nothing.
    const flate = monter(
      `<div lang="nb"><input id="felt"><button id="annet">Annet</button><div id="vert"></div></div>`,
    )
    const rot = (flate.querySelector("#vert") as HTMLElement).attachShadow({
      mode: "open",
    })
    rot.innerHTML = varsel({ warnAt: 1, expiresAt: 91 })
    await customElements.whenDefined("lt-session-timeout")
    const felt = flate.querySelector("#felt") as HTMLInputElement
    const annet = flate.querySelector("#annet") as HTMLButtonElement

    expect(await husketFokus(rot, felt, annet)).toBe(felt)
  })

  it("gives focus back to a field in the same shadow root", async () => {
    // `document.activeElement` is the shadow host here, and `focus()` on it
    // did nothing.
    const flate = monter(
      `<div lang="nb"><button id="annet">Annet</button><div id="vert"></div></div>`,
    )
    const rot = (flate.querySelector("#vert") as HTMLElement).attachShadow({
      mode: "open",
    })
    rot.innerHTML = `<input id="felt">${varsel({ warnAt: 1, expiresAt: 91 })}`
    await customElements.whenDefined("lt-session-timeout")
    const felt = rot.querySelector("#felt") as HTMLInputElement
    const annet = flate.querySelector("#annet") as HTMLButtonElement

    expect(await husketFokus(rot, felt, annet)).toBe(felt)
  })

  it("is still modal after the element has been moved while the warning is showing", async () => {
    const flate = monter(`${varsel()}<div id="annet"></div>`)
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(3)
    expect(dialog().matches(":modal")).toBe(true)

    flate.querySelector("#annet")?.append(vert())

    expect(dialog().open).toBe(true)
    expect(dialog().matches(":modal")).toBe(true)
  })
})

describe("lt-session-timeout when warn-at is raised while the warning is showing", () => {
  beforeAll(() => {
    defineLtSessionTimeout()
  })

  beforeEach(() => {
    falskKlokke()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("lets the countdown continue", async () => {
    monter(varsel())
    await customElements.whenDefined("lt-session-timeout")
    await gaFram(4)
    const tall = () => dialog().textContent?.match(/\d+:\d+/)?.[0]
    const for_ = tall()

    vert().setAttribute("warn-at", "12")
    await gaFram(3)

    expect(dialog().open).toBe(true)
    expect(tall(), "the number froze").not.toBe(for_)
  })
})
