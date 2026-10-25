/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { alert } from "./alert"

import "../../../tokens/tokens.css"
import "./alert.css"
import "../help-text/help-text.css"

describe("lt-alert", () => {
  beforeEach(() => {
    mount(`
      <div class="lt-alert">
        <p class="lt-alert__title">Saken er registrert</p>
        <p>Du får svar innen tre uker.</p>
      </div>
      <div class="lt-alert" data-color="success" id="vellykket">
        <p>Søknaden er sendt.</p>
      </div>
      <div class="lt-alert" data-color="warning" id="advarsel">
        <p>Fristen går ut om tre dager.</p>
      </div>
      <div class="lt-alert" data-color="danger" id="feil" role="alert">
        <p class="lt-alert__title">Søknaden ble ikke sendt</p>
        <p>Nettverket svarte ikke. Prøv igjen.</p>
      </div>
      <div class="lt-alert" data-color="info" id="info">
        <p>Tjenesten er oppdatert.</p>
      </div>
    `)
  })

  it("gir hver farge sin egen flate", () => {
    const farger = ["vellykket", "advarsel", "feil", "info"].map(
      (id) =>
        getComputedStyle(document.getElementById(id) as Element)
          .backgroundColor,
    )

    expect(new Set(farger).size).toBe(farger.length)
  })

  it("merker kanten i statusfargen", () => {
    const feil = getComputedStyle(document.getElementById("feil") as Element)

    expect(feil.borderInlineStartWidth).not.toBe("0px")
    expect(feil.borderInlineStartColor).not.toBe(feil.backgroundColor)
  })

  it("lar marginen til en hjelpetekst i meldingen stå", () => {
    // `.lt-alert p` nullet den, siden den slo `.lt-help-text` på spesifisitet.
    mount(`
      <div class="lt-alert">
        <p>Du får svar innen tre uker.</p>
        <p class="lt-help-text" id="hjelp">Saksnummeret står i kvitteringen.</p>
      </div>
    `)

    expect(
      getComputedStyle(document.getElementById("hjelp") as HTMLElement)
        .marginTop,
    ).not.toBe("0px")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(alert()).toEqual({ class: "lt-alert" })
    expect(alert({ color: "danger" })).toEqual({
      class: "lt-alert",
      "data-color": "danger",
    })
    expect(alert.title).toBe("lt-alert__title")
    expect(alert.isColor("danger")).toBe(true)
    expect(alert.isColor("critical")).toBe(false)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
