/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

import { monter, ventPaTegning } from "../../../testing/a11y"
import { gåTil, settAdresse } from "../../../testing/adresse"

import "../../../tokens/tokens.css"
import "./tabs.css"

/*
 * Ingen `defineFsTabs()` her, med vilje. Fila kjører i sin egen ramme, så
 * `fs-tabs` er uregistrert gjennom hele testen, og det er den tilstanden
 * regelen i `tabs.css` gjelder for: markup skrevet uten JavaScript, før
 * komponenten har rukket å skjule panelene selv.
 */
const BAR = `
  <fs-tabs>
    <ul class="fs-tabs__list">
      <li><a href="#soknaden">Søknaden</a></li>
      <li><a href="#vedlegg">Vedlegg</a></li>
      <li><a href="#meldinger">Meldinger</a></li>
    </ul>
    <section class="fs-tabs__panel" id="soknaden">Søknaden</section>
    <section class="fs-tabs__panel" id="vedlegg">Vedlegg <p id="inne-vedlegg">Inni</p></section>
    <section class="fs-tabs__panel" id="meldinger">Meldinger</section>
  </fs-tabs>`

/** Faner i faner: `#dypt` står i det indre panelet `ib`, i det ytre `yb`. */
const FANER_I_FANER = (indre = "") => `
  <fs-tabs>
    <ul class="fs-tabs__list"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
    <section class="fs-tabs__panel" id="ya">Ytre a</section>
    <section class="fs-tabs__panel" id="yb">Ytre b
      <fs-tabs${indre}>
        <ul class="fs-tabs__list"><li><a href="#ia">IA</a></li><li><a href="#ib">IB</a></li></ul>
        <section class="fs-tabs__panel" id="ia">Indre a</section>
        <section class="fs-tabs__panel" id="ib">Indre b <p id="dypt">Dypt</p></section>
      </fs-tabs>
    </section>
  </fs-tabs>`

function vises(...ider: string[]): boolean[] {
  return ider.map(
    (id) =>
      getComputedStyle(document.getElementById(id) as HTMLElement).display !==
      "none",
  )
}

function visning(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".fs-tabs__panel")].map(
    (panel) => getComputedStyle(panel).display,
  )
}

beforeEach(async () => {
  await settAdresse("")
})

describe("tabs.css før komponenten er registrert", () => {
  it("viser bare det første panelet når serveren ikke sa noe", async () => {
    expect(customElements.get("fs-tabs")).toBeUndefined()
    monter(BAR)
    await ventPaTegning()

    expect(visning()).toEqual(["block", "none", "none"])
  })

  it("lar serverens hidden bestemme hvilket panel som er det første synlige", async () => {
    monter(
      BAR.replace('id="soknaden">Søknaden', 'id="soknaden" hidden>Søknaden'),
    )
    await ventPaTegning()

    expect(visning()).toEqual(["none", "block", "none"])
  })

  /*
   * Peker adressen på et panel, eller på noe i det, viser CSS det panelet.
   * Det er det komponenten velger når den registreres (krav E1), så
   * innholdet ikke hopper (A4). Monteres først og navigeres etter, slik
   * nettleseren finner elementet når siden lastes, se `gåTil()`.
   */
  it("viser panelet adressen peker på", async () => {
    monter(BAR)
    await gåTil("#meldinger")
    await ventPaTegning()

    expect(visning()).toEqual(["none", "none", "block"])
  })

  it("viser panelet med det adressen peker på inni", async () => {
    monter(BAR)
    await gåTil("#inne-vedlegg")
    await ventPaTegning()

    expect(visning()).toEqual(["none", "block", "none"])
  })

  it("viser panelet et kodet fragment peker på", async () => {
    monter(BAR.replace('id="vedlegg"', 'id="søknaden-2"'))
    await gåTil("#s%C3%B8knaden-2")
    await ventPaTegning()

    expect(visning()).toEqual(["none", "block", "none"])
  })

  it("viser det første panelet når adressen peker utenfor raden", async () => {
    monter(`<p id="annet">Annet</p>${BAR}`)
    await gåTil("#annet")
    await ventPaTegning()

    expect(visning()).toEqual(["block", "none", "none"])
  })

  it("lar serverens hidden gå foran adressen", async () => {
    monter(
      BAR.replace('id="meldinger">', 'id="meldinger" hidden>').replace(
        'id="soknaden">',
        'id="soknaden" hidden>',
      ),
    )
    await gåTil("#meldinger")
    await ventPaTegning()

    expect(visning()).toEqual(["none", "block", "none"])
  })

  it("lar adressen være under server-controlled, der komponenten ikke velger fra den", async () => {
    monter(BAR.replace("<fs-tabs>", "<fs-tabs server-controlled>"))
    await gåTil("#meldinger")
    await ventPaTegning()

    expect(visning()).toEqual(["block", "none", "none"])
  })

  it("viser treffet i faner i faner, i begge radene", async () => {
    monter(FANER_I_FANER())
    await gåTil("#dypt")
    await ventPaTegning()

    expect(vises("ya", "yb", "ia", "ib")).toEqual([false, true, false, true])
  })

  it("viser det første i en indre rad med server-controlled, og treffet i den ytre", async () => {
    monter(FANER_I_FANER(" server-controlled"))
    await gåTil("#dypt")
    await ventPaTegning()

    expect(vises("ya", "yb", "ia", "ib")).toEqual([false, true, true, false])
  })

  it("viser panelet en lenke i raden fører til, også når komponenten aldri blir registrert", async () => {
    monter(BAR)
    await ventPaTegning()

    await userEvent.click(
      document.querySelector('a[href="#meldinger"]') as HTMLElement,
    )
    await ventPaTegning()

    expect(visning()).toEqual(["none", "none", "block"])
  })
})
