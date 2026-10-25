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
 * Lagringseksempelet på siden, kjørt slik leseren limer det inn.
 *
 * Kodeblokkene på komponentsidene kjøres ikke av noe annet. «Ren HTML»-fanen
 * under «Lagring med en gang» lover at bryteren går tilbake når lagringen
 * feiler, og siden lover at tastaturet virker som for en vanlig boks. Før
 * slo eksemplet av bryteren mens den lagret, og da tok nettleseren fokuset
 * fra den uten å gi det tilbake, og `fetch` avviser ikke et svar med
 * feilkode, så et avslag fra serveren ble meldt som at det gikk bra.
 */
describe("lagringseksempelet på siden", () => {
  /** Markupen og skriptet i «Ren HTML»-fanen, lest fra siden. */
  function lesFanen(): { markup: string; skript: string } {
    const fane = /<TabItem label="Ren HTML">\s*```html\n([\s\S]*?)```/.exec(
      side,
    )?.[1]
    if (fane === undefined) throw new Error("Fant ingen «Ren HTML»-fane")
    const skript = /<script type="module">([\s\S]*?)<\/script>/.exec(fane)?.[1]
    if (skript === undefined) throw new Error("Fant ikke skriptet i fanen")
    return { markup: fane.replace(/<script[\s\S]*<\/script>/, ""), skript }
  }
  const { markup, skript } = lesFanen()

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Monterer eksemplet med en server som svarer `status`, og slår bryteren. */
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

    const bryter = document.getElementById("varsler") as HTMLInputElement
    const melding = document.getElementById("varsler-status") as HTMLElement
    bryter.focus()
    bryter.click()

    return { bryter, melding, kall: () => kall }
  }

  it("ruller tilbake og sier fra når serveren svarer med en feilkode", async () => {
    const { bryter, melding } = slaOm(500)
    expect(bryter.checked).toBe(true)

    await vi.waitFor(() => expect(melding.textContent).not.toBe(""))

    expect(bryter.checked).toBe(false)
    expect(melding.textContent).toBe("Klarte ikke å lagre. Prøv igjen.")
  })

  it("beholder fokus og sperrer et nytt trykk mens den lagrer", async () => {
    const { bryter, melding, kall } = slaOm(200)
    expect(document.activeElement).toBe(bryter)

    // Et nytt trykk under lagringen skal verken slå bryteren eller sende.
    bryter.click()
    expect(bryter.checked).toBe(true)

    await vi.waitFor(() => expect(melding.textContent).toBe("Varsler er på."))

    expect(document.activeElement).toBe(bryter)
    expect(kall()).toBe(1)

    // Og etterpå virker den som før.
    bryter.click()
    expect(bryter.checked).toBe(false)
    expect(kall()).toBe(2)
    await vi.waitFor(() => expect(melding.textContent).toBe("Varsler er av."))
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

  it("melder seg som en bryter, ikke en avkryssingsboks", () => {
    const bryter = document.getElementById("varsler") as HTMLInputElement

    // role="switch" gjør at skjermlesere sier «på» og «av». Selve elementet
    // er fortsatt en avkryssingsboks, så FormData finner den som før.
    expect(bryter.getAttribute("role")).toBe("switch")
    expect(bryter.type).toBe("checkbox")
  })

  it("flytter knappen til høyre når den er på", () => {
    const pa = getComputedStyle(document.getElementById("varsler") as Element)
    const av = getComputedStyle(document.getElementById("sms") as Element)

    expect(pa.backgroundPositionX).not.toBe(av.backgroundPositionX)
    expect(pa.backgroundColor).not.toBe(av.backgroundColor)
  })

  it("sendes med i skjemaet som en avkryssingsboks", () => {
    document.body.innerHTML = `
      <form id="skjema">
        <input class="lt-switch" type="checkbox" role="switch"
          name="varsler" value="ja" checked />
      </form>
    `
    const skjema = document.getElementById("skjema") as HTMLFormElement

    expect(Object.fromEntries(new FormData(skjema))).toEqual({ varsler: "ja" })
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(switchControl()).toEqual({
      class: "lt-switch",
      type: "checkbox",
      role: "switch",
    })
    expect(switchControl({ disabled: true }).disabled).toBe(true)
    expect(switchControl.row).toBe("lt-switch-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
