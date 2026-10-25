/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { setAttributes } from "../../../dom"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { color } from "../../../testing/color"
import { link } from "./link"
import linkCss from "./link.css?inline"

import "../../../tokens/tokens.css"
import "./link.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("lt-link variants", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a id="default" class="lt-link" href="#">Default</a>
      <a id="disabled" class="lt-link" role="link" tabindex="0" aria-disabled="true">Disabled</a>
    `
  })

  it("applies default link styles", () => {
    const defaultLink = css("default")

    expect(defaultLink.color).toBe(color("--lt-color-accent-text"))
    expect(defaultLink.textDecorationLine).toBe("underline")
  })

  it("applies aria-disabled styles", () => {
    const disabled = css("disabled")

    expect(disabled.color).toBe(color("--lt-color-neutral-text-subtle"))
    expect(disabled.textDecorationLine).toBe("none")
    expect(disabled.pointerEvents).toBe("none")
  })
})

describe("lt-link tilgjengelighet", () => {
  it("har nok kontrast i tekst og i deaktivert tilstand", async () => {
    mount(`
      <p>
        Søknaden er sendt. Du finner den under
        <a class="lt-link" href="/mine-soknader">Mine søknader</a>.
      </p>
      <a class="lt-link" role="link" tabindex="0" aria-disabled="true">Se årsoppgave</a>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})

describe("lt.link({ disabled })", () => {
  /*
   * Den avslåtte lenken hadde `href`, og Enter fulgte den: `pointer-events`
   * stopper bare musa. Uten `href` er en `<a>` ingen lenke for skjermleseren
   * og står ikke i tabrekkefølgen, så byggefunksjonen gir begge tilbake.
   */
  it("gir en lenke uten href rollen og plassen i tabrekkefølgen", () => {
    mount(`<a id="arsoppgave">Se årsoppgave</a>`)
    const lenke = document.getElementById("arsoppgave") as HTMLAnchorElement

    setAttributes(lenke, link({ disabled: true }))
    expect(lenke.getAttribute("role")).toBe("link")
    expect(lenke.getAttribute("aria-disabled")).toBe("true")
    lenke.focus()
    expect(document.activeElement).toBe(lenke)

    // Klar: href settes av appen, og byggefunksjonen tar sitt tilbake.
    lenke.href = "/arsoppgave"
    setAttributes(lenke, link())
    expect(lenke.hasAttribute("role")).toBe(false)
    expect(lenke.hasAttribute("tabindex")).toBe(false)
    expect(lenke.hasAttribute("aria-disabled")).toBe(false)
  })
})

describe("lt-link besøkt", () => {
  /*
   * Nettleseren skjuler `:visited` for skript, så en lenke kan ikke gjøres
   * besøkt herfra. Testen bytter derfor `:visited` med et attributt i en kopi
   * av reglene, i samme rekkefølge. `:hover` sto før `:visited` med samme
   * spesifisitet, og en besøkt lenke skiftet ikke color under musa. `:hover`
   * byttes også, for nettlesersiden har én mus, og hover.browser.test.ts
   * flytter den samtidig.
   */
  it("skifter color under musa også når lenken er besøkt", () => {
    mount(`
      <style>
        ${linkCss.replaceAll(":visited", "[data-besokt]").replaceAll(":hover", "[data-mus]")}
        .lt-link { transition: none; }
      </style>
      <a id="besokt" class="lt-link" href="#" data-besokt>Søknaden din</a>
    `)
    const lenke = document.getElementById("besokt") as HTMLElement
    expect(getComputedStyle(lenke).color).toBe(color("--lt-color-visited-text"))

    lenke.setAttribute("data-mus", "")
    expect(getComputedStyle(lenke).color).toBe(
      color("--lt-color-accent-text-strong"),
    )
  })
})
