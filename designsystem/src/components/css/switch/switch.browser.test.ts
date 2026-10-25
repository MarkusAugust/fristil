/// <reference path="../../../types/css.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import side from "../../../../../documentation/src/content/docs/components/switch.mdx?raw"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { switchControl } from "./switch"

import "../../../tokens/tokens.css"
import "./switch.css"
import "../label/label.css"

/**
 * The saving example on the page, run the way a reader pastes it.
 *
 * Nothing else runs the code blocks on the component pages. The "Plain HTML"
 * tab under "Saving immediately" promises that the switch flips back when
 * saving fails, and the page promises that the keyboard works as for a plain
 * checkbox. The example used to disable the switch while it saved, and then
 * the browser took focus from it without giving it back; and `fetch` does
 * not reject a response with an error status, so a refusal from the server
 * was reported as a success.
 */
describe("the saving example on the page", () => {
  /** The markup and script in the "Plain HTML" tab, read from the page. */
  function lesFanen(): { markup: string; skript: string } {
    const fane = /<TabItem label="Plain HTML">\s*```html\n([\s\S]*?)```/.exec(
      side,
    )?.[1]
    if (fane === undefined) throw new Error('Found no "Plain HTML" tab')
    const skript = /<script type="module">([\s\S]*?)<\/script>/.exec(fane)?.[1]
    if (skript === undefined) throw new Error("Found no script in the tab")
    return { markup: fane.replace(/<script[\s\S]*<\/script>/, ""), skript }
  }
  const { markup, skript } = lesFanen()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Mounts the example with a server that answers `status`, and flips the switch. */
  function slaOm(status: number) {
    monter(markup)
    let kall = 0
    vi.stubGlobal("fetch", () => {
      kall += 1
      return new Promise((svar) => {
        setTimeout(() => svar(new Response("", { status })), 50)
      })
    })
    new Function(skript)()

    const bryter = document.getElementById("notifications") as HTMLInputElement
    const melding = document.getElementById(
      "notifications-status",
    ) as HTMLElement
    bryter.focus()
    bryter.click()

    return { bryter, melding, kall: () => kall }
  }

  it("rolls back and reports it when the server answers with an error status", async () => {
    const { bryter, melding } = slaOm(500)
    expect(bryter.checked).toBe(true)

    await vi.waitFor(() => expect(melding.textContent).not.toBe(""))

    expect(bryter.checked).toBe(false)
    expect(melding.textContent).toBe("Could not save. Try again.")
  })

  it("keeps focus and blocks another press while it saves", async () => {
    const { bryter, melding, kall } = slaOm(200)
    expect(document.activeElement).toBe(bryter)

    // Another press while saving should neither flip the switch nor send.
    bryter.click()
    expect(bryter.checked).toBe(true)

    await vi.waitFor(() =>
      expect(melding.textContent).toBe("Notifications are on."),
    )

    expect(document.activeElement).toBe(bryter)
    expect(kall()).toBe(1)

    // And afterwards it works as before.
    bryter.click()
    expect(bryter.checked).toBe(false)
    expect(kall()).toBe(2)
    await vi.waitFor(() =>
      expect(melding.textContent).toBe("Notifications are off."),
    )
  })
})

describe("lt-switch", () => {
  beforeEach(() => {
    monter(`
      <div class="lt-switch-row">
        <input class="lt-switch" type="checkbox" role="switch" id="varsler" checked />
        <label class="lt-label" for="varsler">Varsle meg på e-post</label>
      </div>
      <div class="lt-switch-row">
        <input class="lt-switch" type="checkbox" role="switch" id="sms" />
        <label class="lt-label" for="sms">Varsle meg på SMS</label>
      </div>
    `)
  })

  it("announces itself as a switch, not a checkbox", () => {
    const bryter = document.getElementById("varsler") as HTMLInputElement

    // role="switch" makes screen readers say "on" and "off". The element is
    // still a checkbox, so FormData finds it as before.
    expect(bryter.getAttribute("role")).toBe("switch")
    expect(bryter.type).toBe("checkbox")
  })

  it("moves the knob to the right when it is on", () => {
    const pa = getComputedStyle(document.getElementById("varsler") as Element)
    const av = getComputedStyle(document.getElementById("sms") as Element)

    expect(pa.backgroundPositionX).not.toBe(av.backgroundPositionX)
    expect(pa.backgroundColor).not.toBe(av.backgroundColor)
  })

  it("is submitted with the form like a checkbox", () => {
    document.body.innerHTML = `
      <form id="skjema">
        <input class="lt-switch" type="checkbox" role="switch"
          name="varsler" value="ja" checked />
      </form>
    `
    const skjema = document.getElementById("skjema") as HTMLFormElement

    expect(Object.fromEntries(new FormData(skjema))).toEqual({ varsler: "ja" })
  })

  it("sets the attributes from the builder function", () => {
    expect(switchControl()).toEqual({
      class: "lt-switch",
      type: "checkbox",
      role: "switch",
    })
    expect(switchControl({ disabled: true }).disabled).toBe(true)
    expect(switchControl.row).toBe("lt-switch-row")
  })

  it("has no accessibility violations", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
