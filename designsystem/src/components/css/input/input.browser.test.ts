/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/farge"
import { finnOverflyt, monterIsolert } from "../../../testing/isolert"
import inputCss from "./input.css?inline"

import "../../../tokens/tokens.css"
import "./input.css"
import "../label/label.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-input", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="default" class="fs-input" />
      <input id="date" class="fs-input" type="date" data-variant="date" value="2026-05-31" />
      <input id="time" class="fs-input" type="time" data-variant="time" value="10:30" />
      <input id="datetime" class="fs-input" type="datetime-local" data-variant="datetime-local" value="2026-05-31T10:30" />
      <input id="invalid" class="fs-input" data-state="invalid" />
      <input id="success" class="fs-input" data-state="success" />
      <input id="disabled" class="fs-input" disabled />
    `
  })

  it("applies default styles", () => {
    const input = css("default")

    expect(input.backgroundColor).toBe(farge("--fs-color-neutral-canvas"))
    expect(input.borderTopColor).toBe(farge("--fs-color-disabled-text"))
    expect(input.color).toBe(farge("--fs-color-neutral-text-strong"))
  })

  it("applies invalid styles", () => {
    const input = css("invalid")

    expect(input.backgroundColor).toBe(farge("--fs-color-danger-surface"))
    expect(input.borderTopColor).toBe(farge("--fs-color-danger-text"))
  })

  it("applies date variant styles", () => {
    const input = css("date")

    expect(input.fontVariantNumeric).toContain("tabular-nums")
    expect(input.backgroundImage).toContain("data:image")
  })

  it("applies time variant icon styles", () => {
    const input = css("time")

    expect(input.backgroundImage).toContain("data:image")
  })

  it("applies datetime-local variant icon styles", () => {
    const input = css("datetime")

    expect(input.backgroundImage).toContain("data:image")
  })

  it("applies success styles", () => {
    const input = css("success")

    expect(input.backgroundColor).toBe(farge("--fs-color-success-surface"))
    expect(input.borderTopColor).toBe(farge("--fs-color-success-text"))
  })

  it("applies disabled styles", () => {
    const input = css("disabled")

    expect(input.backgroundColor).toBe(farge("--fs-color-disabled-surface"))
    expect(input.borderTopColor).toBe(farge("--fs-color-disabled-surface"))
    expect(input.color).toBe(farge("--fs-color-disabled-text"))
    // Markøren vises bare hvis elementet treffes av pekeren
    expect(input.pointerEvents).toBe("auto")
  })
})

describe("fs-input tilgjengelighet", () => {
  it("har nok kontrast og ledetekst i alle tilstander", async () => {
    monter(`
      <label class="fs-label" for="a11y-standard">E-postadresse</label>
      <input class="fs-input" id="a11y-standard" type="email" />

      <label class="fs-label" for="a11y-gyldig">Bekreft e-postadresse</label>
      <input class="fs-input" id="a11y-gyldig" type="email" data-state="success" value="ola@eksempel.no" />

      <label class="fs-label" for="a11y-ugyldig">Reserve-e-post</label>
      <input class="fs-input" id="a11y-ugyldig" type="email" data-state="invalid" aria-invalid="true" value="ola@" />

      <label class="fs-label" for="a11y-dato">Reisedato</label>
      <input class="fs-input" id="a11y-dato" type="date" data-variant="date" value="2026-05-31" />
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-input uten CSS-reset", () => {
  it("holder seg innenfor boksen sin", () => {
    const { boks } = monterIsolert(
      inputCss,
      `<input class="fs-input" type="email" value="ola@eksempel.no" />`,
    )

    expect(finnOverflyt(boks)).toEqual([])
  })
})

describe("fs-input deaktivert", () => {
  it("viser not-allowed-markøren, og blir faktisk truffet av musa", () => {
    monter(`<input class="fs-input" disabled value="Av" />`)

    const element = document.querySelector("input") as HTMLElement
    const ramme = element.getBoundingClientRect()

    expect(getComputedStyle(element).cursor).toBe("not-allowed")

    // cursor har ingen virkning hvis elementet ikke treffes av pekeren.
    // Alle disse hadde pointer-events: none, så markøren ble aldri vist.
    expect(
      document.elementFromPoint(
        ramme.x + ramme.width / 2,
        ramme.y + ramme.height / 2,
      ),
    ).toBe(element)
  })
})
