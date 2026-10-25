/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { errorSummary } from "./error-summary"
import { defineLtErrorSummary } from "./lt-error-summary"

import "../../../tokens/tokens.css"
import "./error-summary.css"
import "../../css/input/input.css"
import "../../css/label/label.css"

/** Markupen serveren sender når den fant to feil. */
const FEIL = errorSummary({ count: 2 })

async function tegn() {
  await customElements.whenDefined("lt-error-summary")
  await ventPaTegning()
}

describe("lt-error-summary", () => {
  beforeAll(() => {
    defineLtErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <lt-error-summary ${attr(FEIL.host)}>
        <h2 ${attr(FEIL.title)}>Skjemaet har to feil</h2>
        <ul>
          <li><a href="#epost" id="lenke-epost">Skriv en gyldig e-postadresse</a></li>
          <li><a href="#fodselsdato">Skriv en dato som finnes</a></li>
        </ul>
      </lt-error-summary>

      <label class="lt-label" for="epost">E-postadresse</label>
      <input class="lt-input" id="epost" type="email" aria-invalid="true" data-state="invalid" />

      <label class="lt-label" for="fodselsdato">Fødselsdato</label>
      <input class="lt-input" id="fodselsdato" aria-invalid="true" data-state="invalid" />
    `)
    await tegn()
  })

  it("får varslingsrollen og overskriften fra serveren", () => {
    const boks = document.querySelector("lt-error-summary") as HTMLElement
    const tittel = document.querySelector(
      ".lt-error-summary__title",
    ) as HTMLElement

    // Lagde komponenten dette selv, forsvant både klassen og overskriften ved
    // første morfing i Datastar, og kom ikke tilbake.
    expect(boks.classList.contains("lt-error-summary")).toBe(true)
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
    const boks = document.querySelector("lt-error-summary") as HTMLElement

    // Uten dette vet ikke den som hører siden at innsendingen stoppet.
    expect(document.activeElement).toBe(boks)
  })

  it("virker på lenker en patch har byttet ut", async () => {
    // Én lytter på verten. Før fikk hver ny lenke sin egen, og de gamle ble
    // holdt fast i minnet.
    const liste = document.querySelector("lt-error-summary ul") as HTMLElement
    liste.innerHTML =
      '<li><a href="#fodselsdato" id="ny-lenke">Skriv en dato som finnes</a></li>'
    await tegn()

    ;(document.getElementById("ny-lenke") as HTMLElement).click()

    expect(document.activeElement?.id).toBe("fodselsdato")
  })

  it("gir fokus til selve feltet når en lenke følges", () => {
    const lenke = document.getElementById("lenke-epost") as HTMLElement
    lenke.click()

    // Komponenten gir feltet fokus selv, så det ikke avhenger av om målet
    // kan få fokus fra nettleserens eget hopp. Tab fortsetter fra målet
    // uansett; det er fokuset og opplesningen som mangler uten.
    expect(document.activeElement?.id).toBe("epost")
  })

  it("kobler seg på lenker serveren patcher inn senere", async () => {
    const boks = document.querySelector("lt-error-summary") as HTMLElement
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

describe("lt-error-summary i en skyggerot", () => {
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
      <lt-error-summary ${attr(feil.host)} data-autofocus="false">
        <h2 ${attr(feil.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#skygge-epost" id="skygge-lenke">Skriv en gyldig adresse</a></li></ul>
      </lt-error-summary>
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
describe("lt-error-summary når skjemaet feiler igjen", () => {
  beforeAll(() => {
    defineLtErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <lt-error-summary ${attr(FEIL.host)} hidden>
        <h2 ${attr(FEIL.title)}>Skjemaet har to feil</h2>
        <ul>
          <li><a href="#epost">Skriv en gyldig e-postadresse</a></li>
          <li><a href="#fodselsdato">Skriv en dato som finnes</a></li>
        </ul>
      </lt-error-summary>
      <input id="epost" />
    `)
    await tegn()
  })

  it("tar fokus hver gang boksen vises på nytt", async () => {
    const boks = document.querySelector("lt-error-summary") as HTMLElement
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

describe("lt-error-summary flytter fokus dit det faktisk kan lande", () => {
  beforeAll(() => {
    defineLtErrorSummary()
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
        <lt-error-summary ${attr(FEIL.host)}>
          <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
          <ul><li><a href="#epost">Skriv en gyldig e-postadresse</a></li></ul>
        </lt-error-summary>
      </div>
      <input id="epost" />
    `)
    await tegn()

    const boks = document.querySelector("lt-error-summary") as HTMLElement
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
        <lt-error-summary ${attr(FEIL.host)}>
          <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
          <ul><li><a href="#epost">Skriv en gyldig e-postadresse</a></li></ul>
        </lt-error-summary>
      </div>
      <input id="epost" />
    `)
    await tegn()

    const boks = document.querySelector("lt-error-summary") as HTMLElement
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
      <lt-error-summary ${attr(FEIL.host)} data-autofocus="false">
        <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#valg-label" id="valg-lenke">Velg minst ett alternativ</a></li></ul>
      </lt-error-summary>
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
      <lt-error-summary ${attr(FEIL.host)}>
        <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#ute">Skriv noe</a></li></ul>
      </lt-error-summary>
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
      <lt-error-summary ${attr(FEIL.host)} data-autofocus="false">
        <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
        <ul><li><a href="#navn-label" id="navn-lenke">Skriv navnet ditt</a></li></ul>
      </lt-error-summary>
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

describe("lt-error-summary kobler fra bar struktur", () => {
  beforeAll(() => {
    defineLtErrorSummary()
  })

  beforeEach(async () => {
    monter(`
      <lt-error-summary id="bar-feil">
        <h2>Skjemaet har én feil</h2>
        <ul>
          <li><a href="#bar-epost">Skriv en gyldig e-postadresse</a></li>
        </ul>
      </lt-error-summary>

      <label class="lt-label" for="bar-epost">E-postadresse</label>
      <input class="lt-input" id="bar-epost" type="email" />
    `)
    await tegn()
  })

  function boks() {
    return document.getElementById("bar-feil") as HTMLElement
  }

  it("gir boksen klassen, rollen og tabbestoppen, og overskriften klassen", async () => {
    const tittel = boks().querySelector("h2") as HTMLElement

    expect(boks().classList.contains("lt-error-summary")).toBe(true)
    expect(boks().getAttribute("role")).toBe("alert")
    expect(boks().tabIndex).toBe(-1)
    expect(tittel.classList.contains("lt-error-summary__title")).toBe(true)
    // Og da kan den få fokus, som er hele grunnen til komponenten.
    expect(document.activeElement).toBe(boks())

    await forventIngenTilgjengelighetsbrudd()
  })

  it("lar en rolle serveren skrev stå", async () => {
    monter(`
      <lt-error-summary id="bar-feil" role="status">
        <h2>Skjemaet har én feil</h2>
        <ul><li><a href="#bar-epost">Skriv en gyldig e-postadresse</a></li></ul>
      </lt-error-summary>
      <input class="lt-input" id="bar-epost" type="email" />
    `)
    await tegn()

    expect(boks().getAttribute("role")).toBe("status")
    expect(boks().classList.contains("lt-error-summary")).toBe(true)
  })

  it("setter klassene og tabbestoppen tilbake etter en patch", async () => {
    const tittel = boks().querySelector("h2") as HTMLElement

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    boks().removeAttribute("class")
    boks().removeAttribute("role")
    boks().removeAttribute("tabindex")
    tittel.removeAttribute("class")
    await ventPaTegning()

    expect(boks().classList.contains("lt-error-summary")).toBe(true)
    expect(boks().getAttribute("role")).toBe("alert")
    expect(boks().tabIndex).toBe(-1)
    expect(tittel.classList.contains("lt-error-summary__title")).toBe(true)
  })
})

describe("lt-error-summary mens brukeren retter", () => {
  beforeAll(() => {
    defineLtErrorSummary()
  })

  it("tar ikke fokus når en synlig liste tømmes og fylles igjen", async () => {
    monter(
      `<lt-error-summary ${attr(FEIL.host)}>
        <h2 ${attr(FEIL.title)}>Skjemaet har feil</h2>
        <ul><li><a href="#navn">Navn mangler</a></li></ul>
      </lt-error-summary>
      <label for="navn">Navn</label><input id="navn" />
      <label for="epost">E-post</label><input id="epost" />`,
    )
    await tegn()
    const liste = document.querySelector("lt-error-summary ul") as HTMLElement
    const navn = document.getElementById("navn") as HTMLInputElement

    navn.focus()
    liste.innerHTML = ""
    await ventPaTegning()
    liste.innerHTML = '<li><a href="#epost">E-post mangler</a></li>'
    await ventPaTegning()

    expect(document.activeElement).toBe(navn)
  })

  it("tar fokus igjen når lista tømmes før boksen skjules", async () => {
    /*
     * Rekkefølgen React gir: punktene fjernes før `hidden` settes på verten.
     * Nullstillingen ved `hidden` sto etter returen for en tom liste, så
     * boksen tok fokus ved første feilede innsending og aldri igjen.
     */
    monter(
      `<lt-error-summary ${attr(FEIL.host)}>
        <h2 ${attr(FEIL.title)}>Skjemaet har feil</h2>
        <ul><li><a href="#navn">Navn mangler</a></li></ul>
      </lt-error-summary>
      <label for="navn">Navn</label><input id="navn" />`,
    )
    await tegn()
    const boks = document.querySelector("lt-error-summary") as HTMLElement
    const liste = boks.querySelector("ul") as HTMLElement
    const navn = document.getElementById("navn") as HTMLInputElement
    expect(document.activeElement, "første innsending").toBe(boks)

    navn.focus()
    liste.innerHTML = ""
    boks.hidden = true
    await ventPaTegning()

    liste.innerHTML = '<li><a href="#navn">Navn mangler</a></li>'
    boks.hidden = false
    await ventPaTegning()

    expect(document.activeElement, "andre innsending").toBe(boks)
  })
})

describe("lt-error-summary og en prosentkodet lenke", () => {
  beforeAll(() => {
    defineLtErrorSummary()
  })

  it("finner feltet og sier ikke at lenken er brutt", async () => {
    const advarsler: string[] = []
    const ekte = console.warn
    console.warn = (...deler: unknown[]) => {
      advarsler.push(String(deler[0]))
    }
    try {
      monter(
        `<lt-error-summary ${attr(FEIL.host)} data-autofocus="false">
          <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
          <ul><li><a href="#f%C3%B8dselsdato">Skriv en dato som finnes</a></li></ul>
        </lt-error-summary>
        <label for="fødselsdato">Fødselsdato</label><input id="fødselsdato" />`,
      )
      await tegn()
      await ventPaTegning()
      await ventPaTegning()

      expect(advarsler.filter((a) => a.includes("lenken peker"))).toEqual([])

      ;(document.querySelector("lt-error-summary a") as HTMLElement).click()
      expect(document.activeElement?.id).toBe("fødselsdato")
    } finally {
      console.warn = ekte
    }
  })
})

describe("lt-error-summary under et annet tagnavn", () => {
  it("skjules fortsatt av hidden", async () => {
    /*
     * README fører `<lt-error-summary>` blant dem som ser like ut under et
     * annet navn. `lt-error-summary[hidden]` i error-summary.css følger
     * ikke med, men `display: block` står på klassen komponenten setter
     * selv, og `[hidden]`-regelen i tokens.css er skrevet på den samme
     * klassen, så boksen skjules likevel.
     */
    defineLtErrorSummary("annen-oppsummering")
    monter(`
      <annen-oppsummering ${attr(FEIL.host)} hidden>
        <h2 ${attr(FEIL.title)}>Skjemaet har to feil</h2>
        <ul>
          <li><a href="#epost">Skriv en gyldig e-postadresse</a></li>
          <li><a href="#fodselsdato">Skriv en dato som finnes</a></li>
        </ul>
      </annen-oppsummering>
      <input id="epost" />
    `)
    await customElements.whenDefined("annen-oppsummering")
    await ventPaTegning()
    const boks = document.querySelector("annen-oppsummering") as HTMLElement

    expect(boks.classList.contains("lt-error-summary")).toBe(true)
    expect(getComputedStyle(boks).display).toBe("none")

    boks.hidden = false
    await ventPaTegning()
    expect(getComputedStyle(boks).display).toBe("block")
    expect(document.activeElement).toBe(boks)
  })
})

/*
 * React gir fokus tilbake til elementet som hadde det før en commit, rett
 * etter at DOM-en er endret. Komponenten flytter fokus i det `hidden` tas
 * bort eller den kobles til, altså inne i den samme commiten, så React tok
 * det tilbake til innsendingsknappen. Testene gjør det samme som React, uten
 * React: endrer DOM-en og gir knappen fokus igjen i samme omgang.
 */
describe("lt-error-summary når et rammeverk gir fokus tilbake", () => {
  beforeAll(() => {
    defineLtErrorSummary()
  })

  const boks = () => `
    <lt-error-summary ${attr(FEIL.host)} id="feil-r" hidden>
      <h2 ${attr(FEIL.title)}>Skjemaet har én feil</h2>
      <ul><li><a href="#epost-r">Skriv e-postadressen</a></li></ul>
    </lt-error-summary>`

  it("tar fokus tilbake når boksen vises", async () => {
    monter(
      `<form>${boks()}<input id="epost-r"><button type="submit" id="send-r">Send</button></form>`,
    )
    await tegn()
    const send = document.getElementById("send-r") as HTMLButtonElement
    const feil = document.getElementById("feil-r") as HTMLElement
    send.focus()

    feil.hidden = false
    send.focus()
    await ventPaTegning()

    expect(document.activeElement).toBe(feil)
  })

  it("tar fokus tilbake når boksen settes inn", async () => {
    monter(
      `<form id="skjema-r"><input id="epost-r"><button type="submit" id="send-r">Send</button></form>`,
    )
    await tegn()
    const send = document.getElementById("send-r") as HTMLButtonElement
    send.focus()

    const mal = document.createElement("template")
    mal.innerHTML = boks().replace(" hidden>", ">")
    const feil = mal.content.firstElementChild as HTMLElement
    document.getElementById("skjema-r")?.prepend(feil)
    send.focus()
    await ventPaTegning()

    expect(document.activeElement).toBe(feil)
  })

  it("tar ikke fokus fra et felt i den samme skyggerota", async () => {
    const vert = document.createElement("div")
    document.body.append(vert)
    const rot = vert.attachShadow({ mode: "open" })
    rot.innerHTML = `${boks()}<input id="epost-r"><button type="submit" id="send-r">Send</button>`
    await tegn()
    const send = rot.getElementById("send-r") as HTMLButtonElement
    const epost = rot.getElementById("epost-r") as HTMLInputElement
    const feil = rot.getElementById("feil-r") as HTMLElement
    send.focus()

    feil.hidden = false
    // Boksen fikk fokus, ellers sier testen ingenting om vilkåret.
    expect(rot.activeElement).toBe(feil)
    epost.focus()
    await ventPaTegning()

    expect(rot.activeElement).toBe(epost)
    vert.remove()
  })

  it("lar fokus stå når et skript har flyttet det til noe annet", async () => {
    monter(
      `<form>${boks()}<input id="epost-r"><button type="submit" id="send-r">Send</button></form>`,
    )
    await tegn()
    const send = document.getElementById("send-r") as HTMLButtonElement
    const epost = document.getElementById("epost-r") as HTMLInputElement
    const feil = document.getElementById("feil-r") as HTMLElement
    send.focus()

    feil.hidden = false
    expect(document.activeElement).toBe(feil)
    epost.focus()
    await ventPaTegning()

    expect(document.activeElement).toBe(epost)
  })
})
