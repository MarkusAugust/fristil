/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/farge"

import "../../../tokens/tokens.css"
import "./button.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-button variants", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="primary" class="fs-button">Primary</button>
      <button id="secondary" class="fs-button" data-variant="secondary">Secondary</button>
      <button id="ghost" class="fs-button" data-variant="ghost">Ghost</button>
      <button id="danger" class="fs-button" data-variant="danger">Danger</button>
      <button id="disabled" class="fs-button" disabled>Disabled</button>
    `
  })

  it("applies primary defaults", () => {
    const primary = css("primary")

    expect(primary.backgroundColor).toBe(farge("--fs-color-accent-fill"))
    expect(primary.borderTopColor).toBe(farge("--fs-color-accent-fill"))
    expect(primary.color).toBe(farge("--fs-color-accent-content"))
  })

  it("applies secondary variant styles", () => {
    const secondary = css("secondary")

    expect(secondary.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(secondary.borderTopColor).toBe(farge("--fs-color-accent-border"))
    expect(secondary.color).toBe(farge("--fs-color-accent-text"))
  })

  it("applies ghost variant styles", () => {
    const ghost = css("ghost")

    expect(ghost.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(ghost.borderTopColor).toBe("rgba(0, 0, 0, 0)")
    expect(ghost.color).toBe(farge("--fs-color-accent-text"))
  })

  it("applies danger variant styles", () => {
    const danger = css("danger")

    expect(danger.backgroundColor).toBe(farge("--fs-color-danger-surface"))
    expect(danger.borderTopColor).toBe(farge("--fs-color-danger-text"))
    expect(danger.color).toBe(farge("--fs-color-danger-text"))
  })

  it("applies disabled styles", () => {
    const disabled = css("disabled")

    expect(disabled.backgroundColor).toBe(farge("--fs-color-disabled-surface"))
    expect(disabled.borderTopColor).toBe(farge("--fs-color-disabled-surface"))
    expect(disabled.color).toBe(farge("--fs-color-disabled-text"))
    // Markøren vises bare hvis elementet treffes av pekeren
    expect(disabled.pointerEvents).toBe("auto")
  })
})

describe("fs-button tilgjengelighet", () => {
  it("har nok kontrast i alle varianter", async () => {
    monter(`
      <button class="fs-button">Send søknad</button>
      <button class="fs-button" data-variant="secondary">Lagre utkast</button>
      <button class="fs-button" data-variant="ghost">Legg til vedlegg</button>
      <button class="fs-button" data-variant="danger">Slett søknad</button>
      <button class="fs-button" disabled>Send søknad</button>
      <a class="fs-button" href="/oversikt">Gå til oversikten</a>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-button deaktivert", () => {
  it("viser not-allowed-markøren, og blir faktisk truffet av musa", () => {
    monter(`<button class="fs-button" disabled>Av</button>`)

    const element = document.querySelector("button") as HTMLElement
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
