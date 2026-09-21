/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsErrorSummary } from "./fs-error-summary"

import "../../../tokens/tokens.css"
import "./error-summary.css"
import "../../css/input/input.css"
import "../../css/label/label.css"

async function tegn() {
  const boks = document.querySelector("fs-error-summary") as HTMLElement & {
    updateComplete?: Promise<unknown>
  }
  await customElements.whenDefined("fs-error-summary")
  await boks?.updateComplete
}

describe("fs-error-summary", () => {
  beforeAll(() => {
    defineFsErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <fs-error-summary heading="Skjemaet har to feil">
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

  it("melder seg som en varsling og kan få fokus", () => {
    const boks = document.querySelector(".fs-error-summary") as HTMLElement

    expect(boks.getAttribute("role")).toBe("alert")
    expect(boks.tabIndex).toBe(-1)
  })

  it("flytter fokus til boksen når den kommer til syne", () => {
    const boks = document.querySelector(".fs-error-summary") as HTMLElement

    // Uten dette vet ikke den som hører siden at innsendingen stoppet.
    expect(document.activeElement).toBe(boks)
  })

  it("skriver overskriften når konsumenten ikke har gjort det", () => {
    const tittel = document.querySelector(
      ".fs-error-summary__title",
    ) as HTMLElement

    expect(tittel.textContent).toBe("Skjemaet har to feil")
  })

  it("oppdaterer overskriften når antallet feil endrer seg", async () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement
    const liste = boks.querySelector("ul") as HTMLElement

    liste.innerHTML = `<li><a href="#epost">Skriv en e-postadresse</a></li>`
    boks.setAttribute("heading", "Skjemaet har én feil")
    await tegn()

    const tittel = boks.querySelector(
      `.${"fs-error-summary__title"}`,
    ) as HTMLElement

    // Retter brukeren én av to feil, skal ikke overskriften bli stående på to.
    expect(tittel.textContent).toBe("Skjemaet har én feil")
  })

  it("lar konsumentens egen overskrift stå", async () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement
    boks.querySelector(".fs-error-summary__title")?.remove()
    boks.insertAdjacentHTML(
      "afterbegin",
      `<h2 class="fs-error-summary__title">Vi fant noe som må rettes</h2>`,
    )
    boks.setAttribute("heading", "Skjemaet har én feil")
    await tegn()

    expect(boks.querySelector(".fs-error-summary__title")?.textContent).toBe(
      "Vi fant noe som må rettes",
    )
  })

  it("gir fokus til selve feltet når en lenke følges", () => {
    const lenke = document.getElementById("lenke-epost") as HTMLElement
    lenke.click()

    // En vanlig ankerlenke ruller bare dit. Da fortsetter neste tastetrykk
    // der fokus sto før, altså i oppsummeringen.
    expect(document.activeElement?.id).toBe("epost")
  })

  it("skjuler seg selv når lista er tom", async () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement
    boks.innerHTML = ""
    await tegn()

    expect(boks.hidden).toBe(true)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
