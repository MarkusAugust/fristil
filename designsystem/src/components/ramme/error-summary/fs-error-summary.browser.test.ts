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
      <fs-error-summary ${attr(FEIL.host)}>
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

    expect(tom.host.hidden).toBe(true)
    expect(FEIL.host.hidden).toBeUndefined()
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
      <fs-error-summary ${attr(feil.host)} data-autofocus="false">
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

/**
 * Andre gang det samme skjemaet feiler.
 *
 * Mønsteret i en Datastar-app er at serveren sender boksen skjult og bare tar
 * bort `hidden` når noe er galt. Lista står da med de samme lenkene hele
 * veien, og komponenten kan ikke bruke «har jeg flyttet fokus hit før» som
 * svar på om dette er en ny innsending.
 */
describe("fs-error-summary når skjemaet feiler igjen", () => {
  beforeAll(() => {
    defineFsErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <fs-error-summary ${attr(FEIL.host)} hidden>
        <h2 ${attr(FEIL.title)}>Skjemaet har to feil</h2>
        <ul>
          <li><a href="#epost">Skriv en gyldig e-postadresse</a></li>
          <li><a href="#fodselsdato">Skriv en dato som finnes</a></li>
        </ul>
      </fs-error-summary>
      <input id="epost" />
    `)
    await tegn()
  })

  it("tar fokus hver gang boksen vises på nytt", async () => {
    const boks = document.querySelector("fs-error-summary") as HTMLElement
    const felt = document.getElementById("epost") as HTMLInputElement

    boks.hidden = false
    await ventPaTegning()
    expect(document.activeElement).toBe(boks)

    // Brukeren retter noe, serveren skjuler boksen igjen.
    boks.hidden = true
    felt.focus()
    await ventPaTegning()

    // Og så feiler innsendingen på nytt, med de samme feilene.
    boks.hidden = false
    await ventPaTegning()

    expect(
      document.activeElement,
      "boksen tok ikke fokus andre gang skjemaet feilet",
    ).toBe(boks)
  })
})

describe("fs-error-summary flytter fokus dit det faktisk kan lande", () => {
  beforeAll(() => {
    defineFsErrorSummary()
  })

  it("tar fokus når forelderen vises og lista byttes ut", async () => {
    /*
     * Boksen kan stå i et fanepanel eller en lukket dialog i det den kobles
     * til. `focus()` gjør da ingenting, men flagget «har flyttet fokus» ble
     * satt likevel, og boksen fikk aldri fokus da forelderen ble synlig og
     * lista byttet ut.
     */
    monter(`
      <div id="panel" hidden>
        <fs-error-summary ${attr(FEIL.host)}>
          <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
          <ul><li><a href="#epost">Skriv en gyldig e-postadresse</a></li></ul>
        </fs-error-summary>
      </div>
      <input id="epost" />
    `)
    await tegn()

    const boks = document.querySelector("fs-error-summary") as HTMLElement
    expect(document.activeElement).not.toBe(boks)

    const panel = document.getElementById("panel") as HTMLElement
    panel.hidden = false
    ;(boks.querySelector("ul") as HTMLElement).innerHTML =
      `<li><a href="#epost">Skriv en gyldig e-postadresse</a></li>`
    await tegn()

    expect(document.activeElement).toBe(boks)
  })

  it("river ikke fokus ut av et felt brukeren står i", async () => {
    // Landet ikke første forsøk, prøver komponenten igjen ved neste endring
    // i lista. Men ikke mens noen skriver: da patcher live-valideringen
    // lista, og fokus skal bli der det er.
    monter(`
      <div id="panel" hidden>
        <fs-error-summary ${attr(FEIL.host)}>
          <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
          <ul><li><a href="#epost">Skriv en gyldig e-postadresse</a></li></ul>
        </fs-error-summary>
      </div>
      <input id="epost" />
    `)
    await tegn()

    const boks = document.querySelector("fs-error-summary") as HTMLElement
    const felt = document.getElementById("epost") as HTMLInputElement
    ;(document.getElementById("panel") as HTMLElement).hidden = false
    felt.focus()
    ;(boks.querySelector("ul") as HTMLElement).innerHTML =
      `<li><a href="#epost">Adressen mangler krøllalfa</a></li>`
    await tegn()

    expect(document.activeElement).toBe(felt)
  })

  it("følger for til en gruppe når ledeteksten ikke har en kontroll", async () => {
    monter(`
      <fs-error-summary ${attr(FEIL.host)} data-autofocus="false">
        <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#valg-label" id="valg-lenke">Velg minst ett alternativ</a></li></ul>
      </fs-error-summary>
      <label id="valg-label" for="valg">Alternativer</label>
      <div id="valg" role="group"><input type="checkbox" /></div>
    `)
    await tegn()
    ;(document.getElementById("valg-lenke") as HTMLElement).click()

    expect(document.activeElement?.id).toBe("valg")
  })

  it("river ikke fokus ut av et felt utenfor skyggerota boksen står i", async () => {
    // Rotas `activeElement` er null når fokus står utenfor skyggetreet, så
    // brukeren ble regnet som «ingen», og gjenforsøket tok fokus.
    monter(`<input id="ute" />`)
    const vert = document.createElement("div")
    vert.hidden = true
    document.body.append(vert)
    const rot = vert.attachShadow({ mode: "open" })
    rot.innerHTML = `
      <fs-error-summary ${attr(FEIL.host)}>
        <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#ute">Skriv noe</a></li></ul>
      </fs-error-summary>
    `
    await tegn()

    const felt = document.getElementById("ute") as HTMLInputElement
    vert.hidden = false
    felt.focus()
    ;(rot.querySelector("ul") as HTMLElement).innerHTML =
      `<li><a href="#ute">Skriv noe annet</a></li>`
    await tegn()

    expect(document.activeElement).toBe(felt)
    vert.remove()
  })

  it("følger en ledetekst som omslutter kontrollen", async () => {
    // `for` er ikke den eneste koblingen mellom ledetekst og kontroll. Med
    // kontrollen inni ledeteksten fikk ledeteksten fokus og en `tabindex`
    // den ikke skulle hatt.
    monter(`
      <fs-error-summary ${attr(FEIL.host)} data-autofocus="false">
        <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#navn-label" id="navn-lenke">Skriv navnet ditt</a></li></ul>
      </fs-error-summary>
      <label id="navn-label">Navn <input id="navn" /></label>
    `)
    await tegn()
    ;(document.getElementById("navn-lenke") as HTMLElement).click()

    expect(document.activeElement?.id).toBe("navn")
    expect(
      document.getElementById("navn-label")?.hasAttribute("tabindex"),
    ).toBe(false)
  })
})

describe("fs-error-summary kobler fra bar struktur", () => {
  beforeAll(() => {
    defineFsErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <fs-error-summary id="bar-feil">
        <h2>Skjemaet har én feil</h2>
        <ul>
          <li><a href="#bar-epost">Skriv en gyldig e-postadresse</a></li>
        </ul>
      </fs-error-summary>

      <label class="fs-label" for="bar-epost">E-postadresse</label>
      <input class="fs-input" id="bar-epost" type="email" />
    `)
    await tegn()
  })

  function boks() {
    return document.getElementById("bar-feil") as HTMLElement
  }

  it("gir boksen klassen, rollen og tabbestoppen, og overskriften klassen", async () => {
    const tittel = boks().querySelector("h2") as HTMLElement

    expect(boks().classList.contains("fs-error-summary")).toBe(true)
    expect(boks().getAttribute("role")).toBe("alert")
    expect(boks().tabIndex).toBe(-1)
    expect(tittel.classList.contains("fs-error-summary__title")).toBe(true)
    // Og da kan den få fokus, som er hele grunnen til komponenten.
    expect(document.activeElement).toBe(boks())

    await forventIngenTilgjengelighetsbrudd()
  })

  it("lar en rolle serveren skrev stå", async () => {
    monter(`
      <fs-error-summary id="bar-feil" role="status">
        <h2>Skjemaet har én feil</h2>
        <ul><li><a href="#bar-epost">Skriv en gyldig e-postadresse</a></li></ul>
      </fs-error-summary>
      <input class="fs-input" id="bar-epost" type="email" />
    `)
    await tegn()

    expect(boks().getAttribute("role")).toBe("status")
    expect(boks().classList.contains("fs-error-summary")).toBe(true)
  })

  it("setter klassene og tabbestoppen tilbake etter en patch", async () => {
    const tittel = boks().querySelector("h2") as HTMLElement

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    boks().removeAttribute("class")
    boks().removeAttribute("role")
    boks().removeAttribute("tabindex")
    tittel.removeAttribute("class")
    await ventPaTegning()

    expect(boks().classList.contains("fs-error-summary")).toBe(true)
    expect(boks().getAttribute("role")).toBe("alert")
    expect(boks().tabIndex).toBe(-1)
    expect(tittel.classList.contains("fs-error-summary__title")).toBe(true)
  })
})
