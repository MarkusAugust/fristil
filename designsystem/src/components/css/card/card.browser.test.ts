/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { card } from "./card"

import "../../../tokens/tokens.css"
import "./card.css"
import "../link/link.css"

describe("fs-card", () => {
  beforeEach(() => {
    monter(`
      <div class="fs-card" id="vanlig">
        <h3 class="fs-card__title">Søknad om bostøtte</h3>
        <p>Sendt 4. mars. Saksnummer 2026-0481.</p>
      </div>
      <div class="fs-card" data-variant="filled" id="fylt">
        <h3 class="fs-card__title">Søknad om barnehageplass</h3>
        <p>Under behandling.</p>
      </div>
      <a class="fs-card" data-interactive href="#" id="klikkbar">
        <h3 class="fs-card__title">Se hele saken</h3>
        <p>Alle dokumenter og meldinger.</p>
      </a>
    `)
  })

  it("skiller fylt fra omriss", () => {
    const vanlig = getComputedStyle(
      document.getElementById("vanlig") as Element,
    )
    const fylt = getComputedStyle(document.getElementById("fylt") as Element)

    expect(fylt.backgroundColor).not.toBe(vanlig.backgroundColor)
    expect(fylt.borderTopColor).not.toBe(vanlig.borderTopColor)
  })

  it("lar det klikkbare kortet være et ekte lenkeelement", () => {
    const klikkbar = document.getElementById("klikkbar") as HTMLElement

    // Et <div> med klikklytter kan hverken nås med tastatur eller meldes som
    // noe å trykke på. Derfor setter data-interactive bare stilen.
    expect(klikkbar.tagName).toBe("A")
    expect(getComputedStyle(klikkbar).textDecorationLine).toBe("none")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(card()).toEqual({ class: "fs-card" })
    expect(card({ variant: "filled", interactive: true })).toEqual({
      class: "fs-card",
      "data-variant": "filled",
      "data-interactive": "",
    })
    expect(card.title).toBe("fs-card__title")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
