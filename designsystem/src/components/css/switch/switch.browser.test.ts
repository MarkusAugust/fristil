/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { switchControl } from "./switch"

import "../../../tokens/tokens.css"
import "./switch.css"
import "../label/label.css"

describe("fs-switch", () => {
  beforeEach(() => {
    monter(`
      <div class="fs-switch-row">
        <input class="fs-switch" type="checkbox" role="switch" id="varsler" checked />
        <label class="fs-label" for="varsler">Varsle meg på e-post</label>
      </div>
      <div class="fs-switch-row">
        <input class="fs-switch" type="checkbox" role="switch" id="sms" />
        <label class="fs-label" for="sms">Varsle meg på SMS</label>
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
        <input class="fs-switch" type="checkbox" role="switch"
          name="varsler" value="ja" checked />
      </form>
    `
    const skjema = document.getElementById("skjema") as HTMLFormElement

    expect(Object.fromEntries(new FormData(skjema))).toEqual({ varsler: "ja" })
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(switchControl()).toEqual({
      class: "fs-switch",
      type: "checkbox",
      role: "switch",
    })
    expect(switchControl({ disabled: true }).disabled).toBe(true)
    expect(switchControl.row).toBe("fs-switch-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
