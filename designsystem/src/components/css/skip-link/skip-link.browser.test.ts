/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { skipLink } from "./skip-link"
import skipLinkCss from "./skip-link.css?inline"

import "../../../tokens/tokens.css"
import "./skip-link.css"

/** `transform` når lenken står på plass: identitetsmatrisen, eller `none`. */
const SYNLIG = /matrix\(1, 0, 0, 1, 0, 0\)|none/

describe("fs-skip-link", () => {
  beforeEach(() => {
    monter(`
      <a class="fs-skip-link" href="#hovedinnhold" id="hopp">Hopp til hovedinnhold</a>
      <main id="hovedinnhold" tabindex="-1">
        <p>Innholdet på siden.</p>
      </main>
    `)
  })

  it("blir værende i tastaturrekkefølgen mens den er skjult", () => {
    const lenke = document.getElementById("hopp") as HTMLElement
    const stil = getComputedStyle(lenke)

    // display: none eller visibility: hidden ville tatt lenken ut av
    // tastaturrekkefølgen, og da finnes den ikke for den som trenger den.
    expect(stil.display).not.toBe("none")
    expect(stil.visibility).not.toBe("hidden")
  })

  it("kommer til syne når den får fokus", async () => {
    const lenke = document.getElementById("hopp") as HTMLElement
    const skjult = getComputedStyle(lenke).transform

    // Lenken glir på plass, så verdien leses til den står der, og ikke
    // etter en fast pause eller på `transitionend`: 250 millisekunder holdt
    // ikke alltid i Firefox, og hendelsen kom ikke alltid fram der heller.
    lenke.focus()
    await vi.waitFor(
      () => expect(getComputedStyle(lenke).transform).toMatch(SYNLIG),
      {
        timeout: 3000,
      },
    )

    expect(skjult).not.toMatch(SYNLIG)
    expect(document.activeElement).toBe(lenke)
  })

  it("kommer til syne på :focus, ikke på :focus-visible", () => {
    // Hadde lenken brukt `:focus-visible`, sto den skjult for den som
    // hopper dit fra et skript etter et museklikk. Regelen leses fra
    // stilarket, og prøves med et attributt i stedet for pseudoklassen, så
    // svaret ikke avhenger av om vinduet har fokus i motoren testen kjører i.
    expect(skipLinkCss).toContain(".fs-skip-link:focus {")
    expect(skipLinkCss).not.toMatch(/\.fs-skip-link:focus-visible/)
    monter(`
      <style>
        ${skipLinkCss.replaceAll(":focus", "[data-fokus]")}
        .fs-skip-link { transition: none; }
      </style>
      <a class="fs-skip-link" href="#hovedinnhold" id="hopp">Hopp til hovedinnhold</a>
      <main id="hovedinnhold" tabindex="-1"><p>Innholdet på siden.</p></main>
    `)
    const lenke = document.getElementById("hopp") as HTMLElement
    expect(getComputedStyle(lenke).transform).not.toMatch(SYNLIG)

    lenke.setAttribute("data-fokus", "")
    expect(getComputedStyle(lenke).transform).toMatch(SYNLIG)
  })

  it("regner ikke fokus satt fra kode etter et museklikk som synlig fokus", async () => {
    // Det er derfor stilarket bruker `:focus`. Etter et tastetrykk treffer
    // `:focus-visible` også fra kode, så det er museklikket som avgjør, og
    // klikket må være ekte, fra pekeren.
    monter(`
      <a class="fs-skip-link" href="#hovedinnhold" id="hopp">Hopp til hovedinnhold</a>
      <main id="hovedinnhold" tabindex="-1">
        <p>Innholdet på siden.</p>
        <button type="button" id="topp">Til toppen</button>
      </main>
    `)
    const lenke = document.getElementById("hopp") as HTMLElement
    const knapp = document.getElementById("topp") as HTMLElement
    let klikk = 0
    knapp.addEventListener("click", () => {
      klikk += 1
      lenke.focus()
    })

    // I Firefox i CI kommer pekerklikket fra Playwright ikke alltid fram til
    // siden, så det gjentas til lytteren har kjørt.
    for (let forsøk = 0; forsøk < 5 && klikk === 0; forsøk++) {
      await userEvent.click(knapp)
      await new Promise((ferdig) => setTimeout(ferdig, 100))
    }
    expect(klikk, "pekerklikket kom ikke fram til knappen").toBeGreaterThan(0)

    const tilstand = () =>
      `activeElement=${document.activeElement?.id ?? document.activeElement?.tagName}, hasFocus=${document.hasFocus()}, :focus=${lenke.matches(":focus")}`
    await vi.waitFor(
      () => expect(document.activeElement, tilstand()).toBe(lenke),
      { timeout: 3000 },
    )
    expect(lenke.matches(":focus-visible"), tilstand()).toBe(false)
  })

  it("flytter fokus til målet når det har tabindex", async () => {
    // Uten `tabindex="-1"` flytter nettleseren visningen til målet, men
    // ikke fokus, så skjermleseren får ikke beskjed om at brukeren er
    // framme. Siden sa at neste Tab da fortsatte i menyen, men nettleseren
    // fortsetter fra målet uansett: det er fokuset som mangler.
    monter(`
      <a class="fs-skip-link" href="#hovedinnhold" id="hopp">Hopp til hovedinnhold</a>
      <header><a href="#meny" id="meny">Meny</a></header>
      <main id="hovedinnhold" tabindex="-1">
        <input id="inne" aria-label="Søk i innholdet" />
      </main>
    `)
    // Et tekstfelt og ikke en lenke først i innholdet: WebKit på macOS
    // hopper som Safari over lenker og knapper med Tab, men stopper i et
    // tekstfelt. Det testen spør om, hvor neste Tab fortsetter fra, er det
    // samme.
    const lenke = document.getElementById("hopp") as HTMLAnchorElement
    const maal = document.getElementById("hovedinnhold") as HTMLElement

    // Hoppet til fragmentet skjer ikke i samme omgang som klikket i alle
    // motorer: Chromium flytter fokus med en gang, Firefox i en senere
    // oppgave. Derfor ventes det på fokuset, ikke på klikket.
    lenke.focus()
    lenke.click()
    await vi.waitFor(() => expect(document.activeElement).toBe(maal))

    await userEvent.tab()
    expect(document.activeElement?.id).toBe("inne")

    maal.removeAttribute("tabindex")
    location.hash = ""
    lenke.focus()
    lenke.click()
    await vi.waitFor(() => expect(document.activeElement).toBe(document.body))

    await userEvent.tab()
    expect(document.activeElement?.id).toBe("inne")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(skipLink()).toEqual({ class: "fs-skip-link" })
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
