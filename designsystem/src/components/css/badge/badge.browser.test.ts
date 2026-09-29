/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/farge"

import "../../../tokens/tokens.css"
import "./badge.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-badge", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="default" class="fs-badge">Info</span>
      <span id="success" class="fs-badge" data-color="success">Aktiv</span>
      <span id="warning" class="fs-badge" data-color="warning">Advarsel</span>
      <span id="danger" class="fs-badge" data-color="danger">Feil</span>
      <span id="neutral" class="fs-badge" data-color="neutral">Inaktiv</span>
    `
  })

  it("applies default (interactive) colors", () => {
    const badge = css("default")
    expect(badge.backgroundColor).toBe(farge("--fs-color-accent-surface"))
    expect(badge.color).toBe(farge("--fs-color-accent-text"))
  })

  it("applies success colors", () => {
    const badge = css("success")
    expect(badge.backgroundColor).toBe(farge("--fs-color-success-surface"))
    expect(badge.color).toBe(farge("--fs-color-success-text"))
  })

  it("applies warning colors", () => {
    const badge = css("warning")
    expect(badge.backgroundColor).toBe(farge("--fs-color-warning-surface"))
    expect(badge.color).toBe(farge("--fs-color-warning-text"))
  })

  it("applies danger colors", () => {
    const badge = css("danger")
    expect(badge.backgroundColor).toBe(farge("--fs-color-danger-surface"))
    expect(badge.color).toBe(farge("--fs-color-danger-text"))
  })

  it("applies neutral colors", () => {
    const badge = css("neutral")
    expect(badge.backgroundColor).toBe(farge("--fs-color-neutral-surface"))
    expect(badge.color).toBe(farge("--fs-color-neutral-text"))
  })
})

describe("fs-badge tilgjengelighet", () => {
  it("har nok kontrast i alle fargevarianter", async () => {
    monter(`
      <span class="fs-badge">Under behandling</span>
      <span class="fs-badge" data-color="success">Innvilget</span>
      <span class="fs-badge" data-color="warning">Mangler vedlegg</span>
      <span class="fs-badge" data-color="danger">Avslått</span>
      <span class="fs-badge" data-color="neutral">Arkivert</span>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
