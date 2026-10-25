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
import "../paragraph/paragraph.css"
import "../help-text/help-text.css"
import "../badge/badge.css"
import "../button/button.css"

describe("lt-card", () => {
  beforeEach(() => {
    monter(`
      <div class="lt-card" id="vanlig">
        <h3 class="lt-card__title">Søknad om bostøtte</h3>
        <p>Sendt 4. mars. Saksnummer 2026-0481.</p>
      </div>
      <div class="lt-card" data-variant="filled" id="fylt">
        <h3 class="lt-card__title">Søknad om barnehageplass</h3>
        <p>Under behandling.</p>
      </div>
      <a class="lt-card" data-interactive href="#" id="klikkbar">
        <h3 class="lt-card__title">Se hele saken</h3>
        <p>Alle dokumenter og meldinger.</p>
      </a>
    `)
  })

  it("lar et merke, en knapp og en lenke ha sin egen bredde, og strekker avsnittet", () => {
    monter(`
      <div class="lt-card" id="med-merke" style="width: 400px">
        <p>Sendt 4. mars.</p>
        <span class="lt-badge" data-color="success">Innvilget</span>
        <button class="lt-button" data-variant="secondary">Last opp vedlegg</button>
        <a class="lt-link" href="#">Se vedtaket</a>
      </div>
    `)
    const kort = document.getElementById("med-merke") as HTMLElement
    const bredde = (s: string) =>
      (kort.querySelector(s) as HTMLElement).getBoundingClientRect().width
    const innside =
      kort.clientWidth -
      2 * Number.parseFloat(getComputedStyle(kort).paddingLeft)

    expect(bredde(".lt-badge")).toBeLessThan(innside / 2)
    expect(bredde(".lt-button")).toBeLessThan(innside)
    expect(bredde(".lt-link")).toBeLessThan(innside / 2)
    expect(bredde("p")).toBeCloseTo(innside, 0)
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
    expect(card()).toEqual({ class: "lt-card" })
    expect(card({ variant: "filled", interactive: true })).toEqual({
      class: "lt-card",
      "data-variant": "filled",
      "data-interactive": "",
    })
    expect(card.title).toBe("lt-card__title")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("lt-card som knapp", () => {
  it("har samme skrift som et kort som er en lenke", () => {
    // En <button> arver ikke skriften, og kortet hadde 13 piksler.
    monter(`
      <a class="lt-card" data-interactive href="#"><p id="i-lenke">Tekst</p></a>
      <button class="lt-card" data-interactive type="button"><p id="i-knapp">Tekst</p></button>
    `)
    const skrift = (id: string) =>
      getComputedStyle(document.getElementById(id) as HTMLElement).fontSize

    expect(skrift("i-knapp")).toBe(skrift("i-lenke"))
  })
})

describe("avsnitt i lt-card", () => {
  it("lar klassen på avsnittet vinne over kortet", () => {
    // `.lt-card p` slo `.lt-paragraph` på spesifisitet, så
    // `--lt-paragraph-line-height` virket overalt unntatt i et kort.
    monter(`
      <p class="lt-paragraph" id="utenfor" style="--lt-paragraph-line-height: 1.2">Tekst</p>
      <div class="lt-card">
        <p class="lt-paragraph" id="inni" style="--lt-paragraph-line-height: 1.2">Tekst</p>
        <p class="lt-help-text" id="hjelp">Hjelp</p>
      </div>
    `)
    const stil = (id: string) =>
      getComputedStyle(document.getElementById(id) as HTMLElement)

    expect(stil("inni").lineHeight).toBe(stil("utenfor").lineHeight)
    expect(stil("hjelp").marginTop).not.toBe("0px")
  })
})
