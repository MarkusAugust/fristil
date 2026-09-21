/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { errorSummary } from "./error-summary"
import { defineFsErrorSummary } from "./fs-error-summary"

import "../../../tokens/tokens.css"
import "./error-summary.css"
import "../../css/input/input.css"
import "../../css/label/label.css"

/** Markupen serveren sender når den fant to feil. */
const FEIL = errorSummary({ count: 2 })

async function tegn() {
  await customElements.whenDefined("fs-error-summary")
  await ventPaTegning()
}

describe("fs-error-summary", () => {
  beforeAll(() => {
    defineFsErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <fs-error-summary ${attr(FEIL.container)}>
        <h2 ${attr(FEIL.title)}>Skjemaet har to feil</h2>
        <ul>
          <li><a href="#epost" id="lenke-epost">Skriv en gyldig e-postadresse</a></li>
          <li><a href="#fodselsdato">Skriv en dato som finnes</a></li>
        </ul>
      </fs-error-summary>

      <label class="fs-label" for="epost">E-postadresse</label>
      <input class="fs-input" id="epost" type="email" aria-invalid="true" data-state="invalid" />

      <label class="fs-label" for="fodselsdato">Fødselsdato</label>
      <input class="fs-input" id="fodselsdato" aria-invalid="true" data-state="invalid" />
    `)
    await tegn()
  })

  it("får varslingsrollen og overskriften fra serveren", () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement
    const tittel = document.querySelector(
      ".fs-error-summary__title",
    ) as HTMLElement

    // Lagde komponenten dette selv, forsvant både klassen og overskriften ved
    // første morfing i Datastar, og kom ikke tilbake.
    expect(boks.classList.contains("fs-error-summary")).toBe(true)
    expect(boks.getAttribute("role")).toBe("alert")
    expect(boks.tabIndex).toBe(-1)
    expect(tittel.textContent).toBe("Skjemaet har to feil")
  })

  it("skjules av serveren når det ikke er noen feil", () => {
    const tom = errorSummary({ count: 0 })

    expect(tom.container.hidden).toBe(true)
    expect(FEIL.container.hidden).toBeUndefined()
  })

  it("flytter fokus til boksen når den kommer til syne", () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement

    // Uten dette vet ikke den som hører siden at innsendingen stoppet.
    expect(document.activeElement).toBe(boks)
  })

  it("gir fokus til selve feltet når en lenke følges", () => {
    const lenke = document.getElementById("lenke-epost") as HTMLElement
    lenke.click()

    // En vanlig ankerlenke ruller bare dit. Da fortsetter neste tastetrykk
    // der fokus sto før, altså i oppsummeringen.
    expect(document.activeElement?.id).toBe("epost")
  })

  it("kobler seg på lenker serveren patcher inn senere", async () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement
    const liste = boks.querySelector("ul") as HTMLElement

    liste.innerHTML = `<li><a href="#fodselsdato" id="ny-lenke">Skriv en dato som finnes</a></li>`
    await tegn()
    ;(document.getElementById("ny-lenke") as HTMLElement).click()

    expect(document.activeElement?.id).toBe("fodselsdato")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-error-summary i en skyggerot", () => {
  /**
   * Forhåndsvisningene i dokumentasjonen ligger i en skyggerot, og det gjør
   * skjemaer inne i andre komponenter også. `document.getElementById` ser
   * ikke inn dit, så lenken ble en vanlig ankerlenke uten fokusflytting.
   */
  it("finner feltet i sin egen rot", async () => {
    const vert = document.createElement("div")
    document.body.append(vert)
    const rot = vert.attachShadow({ mode: "open" })
    const feil = errorSummary({ count: 1 })

    rot.innerHTML = `
      <fs-error-summary ${attr(feil.container)} autofocus="false">
        <h2 ${attr(feil.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#skygge-epost" id="skygge-lenke">Skriv en gyldig adresse</a></li></ul>
      </fs-error-summary>
      <input id="skygge-epost" type="email" />
    `

    await ventPaTegning()
    ;(rot.getElementById("skygge-lenke") as HTMLElement).click()

    expect(rot.activeElement?.id).toBe("skygge-epost")

    vert.remove()
  })
})
