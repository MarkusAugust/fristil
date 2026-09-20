/// <reference path="./types/css.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { monter, ventPaTegning } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/input/input.css"
import "./components/css/search/search.css"
import "./components/css/switch/switch.css"

/**
 * At komponentene snur når språket går fra høyre til venstre.
 *
 * Systemet bruker logiske egenskaper overalt, altså `padding-inline-start` og
 * `inset-inline-end`, og de snur av seg selv. `background-position` har ingen
 * logisk variant, og de tre stedene som tegner et ikon i bakgrunnen måtte
 * derfor snus for hånd. Uten det står forstørrelsesglasset i søkefeltet på
 * feil side, og knappen i bryteren viser motsatt tilstand av den den har.
 */

function stil(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`Mangler #${id}`)
  return getComputedStyle(element)
}

describe("høyre til venstre", () => {
  beforeEach(() => {
    // Bryteren glir mellom av og på. Overgangen er ikke det som måles her,
    // og gjør bare avlesningen avhengig av hvor raskt maskinen er.
    const uten = document.createElement("style")
    uten.dataset.test = ""
    uten.textContent = `.fs-switch { transition: none; }`
    document.head.append(uten)

    monter(`
      <input class="fs-input fs-search" type="search" id="sok" />
      <input class="fs-input" type="date" data-variant="date" id="dato" />
      <input class="fs-switch" type="checkbox" role="switch" id="av" />
      <input class="fs-switch" type="checkbox" role="switch" id="pa" checked />
    `)
  })

  afterEach(() => {
    // Retningen må tilbake selv om en test feilet, ellers måler den neste
    // feil dokument.
    document.documentElement.dir = "ltr"
    for (const stil of document.querySelectorAll("style[data-test]")) {
      stil.remove()
    }
  })

  it("snur ikonet i søkefeltet", async () => {
    await ventPaTegning()
    const venstre = stil("sok").backgroundPositionX

    document.documentElement.dir = "rtl"
    await ventPaTegning()
    const hoyre = stil("sok").backgroundPositionX

    expect(venstre).not.toBe(hoyre)
  })

  it("snur ikonet i datofeltet", async () => {
    await ventPaTegning()
    const foer = stil("dato").backgroundPositionX

    document.documentElement.dir = "rtl"
    await ventPaTegning()

    expect(stil("dato").backgroundPositionX).not.toBe(foer)
  })

  it("lar bryterknappen bety det samme i begge retninger", async () => {
    await ventPaTegning()
    const avFoer = stil("av").backgroundPositionX
    const paaFoer = stil("pa").backgroundPositionX

    // Av og på står på hver sin side. Det er hele signalet.
    expect(avFoer).not.toBe(paaFoer)

    document.documentElement.dir = "rtl"
    await ventPaTegning()

    const avEtter = stil("av").backgroundPositionX
    const paaEtter = stil("pa").backgroundPositionX

    expect(avEtter).not.toBe(paaEtter)
    // Sidene har byttet plass: knappen som lå på starten i den ene retningen,
    // ligger på slutten i den andre.
    expect(avEtter).toBe(paaFoer)
    expect(paaEtter).toBe(avFoer)
  })

  it("lar de logiske egenskapene snu av seg selv", async () => {
    await ventPaTegning()
    const foer = stil("sok").paddingLeft

    document.documentElement.dir = "rtl"
    await ventPaTegning()

    // padding-inline-start i CSS-en, altså ingen egen regel for retningen.
    expect(stil("sok").paddingLeft).not.toBe(foer)
  })
})
