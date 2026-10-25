/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/color"

import "../../../tokens/tokens.css"
import "./badge.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("lt-badge", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="default" class="lt-badge">Info</span>
      <span id="success" class="lt-badge" data-color="success">Aktiv</span>
      <span id="warning" class="lt-badge" data-color="warning">Advarsel</span>
      <span id="danger" class="lt-badge" data-color="danger">Feil</span>
      <span id="neutral" class="lt-badge" data-color="neutral">Inaktiv</span>
    `
  })

  it("applies default (interactive) colors", () => {
    const badge = css("default")
    expect(badge.backgroundColor).toBe(farge("--lt-color-accent-surface"))
    expect(badge.color).toBe(farge("--lt-color-accent-text"))
  })

  it("applies success colors", () => {
    const badge = css("success")
    expect(badge.backgroundColor).toBe(farge("--lt-color-success-surface"))
    expect(badge.color).toBe(farge("--lt-color-success-text"))
  })

  it("applies warning colors", () => {
    const badge = css("warning")
    expect(badge.backgroundColor).toBe(farge("--lt-color-warning-surface"))
    expect(badge.color).toBe(farge("--lt-color-warning-text"))
  })

  it("applies danger colors", () => {
    const badge = css("danger")
    expect(badge.backgroundColor).toBe(farge("--lt-color-danger-surface"))
    expect(badge.color).toBe(farge("--lt-color-danger-text"))
  })

  it("applies neutral colors", () => {
    const badge = css("neutral")
    expect(badge.backgroundColor).toBe(farge("--lt-color-neutral-surface"))
    expect(badge.color).toBe(farge("--lt-color-neutral-text"))
  })
})

describe("lt-badge tilgjengelighet", () => {
  it("har nok kontrast i alle fargevarianter", async () => {
    monter(`
      <span class="lt-badge">Under behandling</span>
      <span class="lt-badge" data-color="success">Innvilget</span>
      <span class="lt-badge" data-color="warning">Mangler vedlegg</span>
      <span class="lt-badge" data-color="danger">Avslått</span>
      <span class="lt-badge" data-color="neutral">Arkivert</span>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
