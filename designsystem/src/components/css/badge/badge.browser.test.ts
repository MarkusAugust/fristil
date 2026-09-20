/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"

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
    expect(badge.backgroundColor).toBe("rgb(205, 225, 249)")
    expect(badge.color).toBe("rgb(19, 98, 174)")
  })

  it("applies success colors", () => {
    const badge = css("success")
    expect(badge.backgroundColor).toBe("rgb(227, 245, 234)")
    expect(badge.color).toBe("rgb(49, 111, 42)")
  })

  it("applies warning colors", () => {
    const badge = css("warning")
    expect(badge.backgroundColor).toBe("rgb(249, 237, 226)")
    expect(badge.color).toBe("rgb(137, 101, 8)")
  })

  it("applies danger colors", () => {
    const badge = css("danger")
    expect(badge.backgroundColor).toBe("rgb(247, 226, 232)")
    expect(badge.color).toBe("rgb(168, 46, 57)")
  })

  it("applies neutral colors", () => {
    const badge = css("neutral")
    expect(badge.backgroundColor).toBe("rgb(229, 229, 229)")
    expect(badge.color).toBe("rgb(77, 77, 77)")
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
