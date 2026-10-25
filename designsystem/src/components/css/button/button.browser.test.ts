/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { color } from "../../../testing/color"

import "../../../tokens/tokens.css"
import "./button.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("lt-button variants", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="primary" class="lt-button">Primary</button>
      <button id="secondary" class="lt-button" data-variant="secondary">Secondary</button>
      <button id="ghost" class="lt-button" data-variant="ghost">Ghost</button>
      <button id="danger" class="lt-button" data-variant="danger">Danger</button>
      <button id="disabled" class="lt-button" disabled>Disabled</button>
    `
  })

  it("applies primary defaults", () => {
    const primary = css("primary")

    expect(primary.backgroundColor).toBe(color("--lt-color-accent-fill"))
    expect(primary.borderTopColor).toBe(color("--lt-color-accent-fill"))
    expect(primary.color).toBe(color("--lt-color-accent-content"))
  })

  it("applies secondary variant styles", () => {
    const secondary = css("secondary")

    expect(secondary.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(secondary.borderTopColor).toBe(color("--lt-color-accent-border"))
    expect(secondary.color).toBe(color("--lt-color-accent-text"))
  })

  it("applies ghost variant styles", () => {
    const ghost = css("ghost")

    expect(ghost.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(ghost.borderTopColor).toBe("rgba(0, 0, 0, 0)")
    expect(ghost.color).toBe(color("--lt-color-accent-text"))
  })

  it("applies danger variant styles", () => {
    const danger = css("danger")

    expect(danger.backgroundColor).toBe(color("--lt-color-danger-surface"))
    expect(danger.borderTopColor).toBe(color("--lt-color-danger-text"))
    expect(danger.color).toBe(color("--lt-color-danger-text"))
  })

  it("applies disabled styles", () => {
    const disabled = css("disabled")

    expect(disabled.backgroundColor).toBe(color("--lt-color-disabled-surface"))
    expect(disabled.borderTopColor).toBe(color("--lt-color-disabled-surface"))
    expect(disabled.color).toBe(color("--lt-color-disabled-text"))
    // Markøren vises bare hvis elementet treffes av pekeren
    expect(disabled.pointerEvents).toBe("auto")
  })
})

describe("lt-button tilgjengelighet", () => {
  it("har nok kontrast i alle varianter", async () => {
    mount(`
      <button class="lt-button">Send søknad</button>
      <button class="lt-button" data-variant="secondary">Lagre utkast</button>
      <button class="lt-button" data-variant="ghost">Legg til vedlegg</button>
      <button class="lt-button" data-variant="danger">Slett søknad</button>
      <button class="lt-button" disabled>Send søknad</button>
      <a class="lt-button" href="/oversikt">Gå til oversikten</a>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})

describe("lt-button deaktivert", () => {
  it("viser not-allowed-markøren, og blir faktisk truffet av musa", () => {
    mount(`<button class="lt-button" disabled>Av</button>`)

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
