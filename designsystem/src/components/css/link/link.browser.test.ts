/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { setAttributes } from "../../../dom"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { farge } from "../../../testing/farge"
import { link } from "./link"

import "../../../tokens/tokens.css"
import "./link.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("fs-link variants", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a id="default" class="fs-link" href="#">Default</a>
      <a id="disabled" class="fs-link" role="link" tabindex="0" aria-disabled="true">Disabled</a>
    `
  })

  it("applies default link styles", () => {
    const defaultLink = css("default")

    expect(defaultLink.color).toBe(farge("--fs-color-accent-text"))
    expect(defaultLink.textDecorationLine).toBe("underline")
  })

  it("applies aria-disabled styles", () => {
    const disabled = css("disabled")

    expect(disabled.color).toBe(farge("--fs-color-neutral-text-subtle"))
    expect(disabled.textDecorationLine).toBe("none")
    expect(disabled.pointerEvents).toBe("none")
  })
})

describe("fs-link tilgjengelighet", () => {
  it("har nok kontrast i tekst og i deaktivert tilstand", async () => {
    monter(`
      <p>
        Søknaden er sendt. Du finner den under
        <a class="fs-link" href="/mine-soknader">Mine søknader</a>.
      </p>
      <a class="fs-link" role="link" tabindex="0" aria-disabled="true">Se årsoppgave</a>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs.link({ disabled })", () => {
  /*
   * Den avslåtte lenken hadde `href`, og Enter fulgte den: `pointer-events`
   * stopper bare musa. Uten `href` er en `<a>` ingen lenke for skjermleseren
   * og står ikke i tabrekkefølgen, så byggefunksjonen gir begge tilbake.
   */
  it("gir en lenke uten href rollen og plassen i tabrekkefølgen", () => {
    monter(`<a id="arsoppgave">Se årsoppgave</a>`)
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
