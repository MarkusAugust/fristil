/// <reference path="./types/css.d.ts" />

import type { LitElement } from "lit"
import { beforeEach, describe, expect, it } from "vitest"

import { defineFsCalendar } from "./components/sammensatt/calendar/fs-calendar"
import { defineFsDateField } from "./components/sammensatt/date-field/fs-date-field"

import "./tokens/tokens.css"
import "./components/css/button/button.css"
import "./components/css/input/input.css"
import "./components/sammensatt/date-field/date-field.css"

/**
 * At en konsument faktisk får lov til å tilpasse systemet.
 *
 * Dette er et løfte til dem som bruker pakken, og det er lett å bryte uten å
 * merke det: legger noen inn en mer spesifikk selektor, eller tar en verdi ut
 * av en variabel, forsvinner muligheten stille. Testen holder de tre veiene
 * åpne.
 */

/** Legger inn CSS som om den kom fra konsumentens eget stilark. */
function apply(css: string): void {
  const style = document.createElement("style")
  style.dataset.consumer = ""
  style.textContent = css
  document.head.append(style)
}

describe("en konsument kan tilpasse systemet", () => {
  beforeEach(() => {
    // Stilarkene havner i <head> og overlever ellers til neste test
    for (const style of document.querySelectorAll("style[data-consumer]")) {
      style.remove()
    }
    document.documentElement.removeAttribute("data-theme")
    document.body.innerHTML = `
      <button class="fs-button">Knapp</button>
      <input class="fs-input" />
    `
  })

  it("kan sette en komponentvariabel uten noen selektor", () => {
    apply(":root { --fs-button-radius: 9999px; }")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).borderRadius).toBe("9999px")

    // Variabelen er komponentens egen: input skal ikke påvirkes
    const input = document.querySelector(".fs-input") as HTMLElement
    expect(getComputedStyle(input).borderRadius).not.toBe("9999px")
  })

  it("faller tilbake til tokenverdien når variabelen ikke er satt", () => {
    // Standardverdien skal følge --size-skalaen, ikke være bakt inn.
    // Det er grunnen til at @property ikke brukes her: en registrert
    // initial-value gjør var()-fallbacken uoppnåelig.
    apply(":root { --size-1: 20px; }")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).borderRadius).toBe("20px")
  })

  it("kan overstyre en regel systemet ikke har eksponert, med lav spesifisitet", () => {
    document.body.innerHTML = '<button class="fs-button" disabled>Av</button>'

    // Systemets regel er .fs-button:disabled, altså 0,2,0. Konsumentens er
    // 0,1,0 og ville tapt uten @layer, uansett rekkefølge. Det er nettopp
    // dette layeret er til for.
    apply(".fs-button { background: rgb(1, 2, 3); }")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("kan overstyre en token, også i mørkt tema via systemvalget", () => {
    apply(":root { --semantic-interactive-main: rgb(124, 58, 237); }")
    document.documentElement.setAttribute("data-theme", "dark")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(124, 58, 237)")
  })
})

/**
 * De sammensatte komponentene, som eier sin egen markup.
 *
 * `<fs-date-field>` rendrer i vanlig DOM, og la tidligere oppsettet sitt i
 * `style=`-attributter. Inline stil taper bare for `!important`, så
 * komponenten var i praksis låst. `<fs-calendar>` har shadow DOM, der
 * konsumentens selektorer ikke når inn i det hele tatt. Der er
 * komponentvariabler og `::part()` de eneste veiene.
 */
describe("de sammensatte komponentene kan tilpasses", () => {
  beforeEach(async () => {
    for (const style of document.querySelectorAll("style[data-consumer]")) {
      style.remove()
    }
    document.body.innerHTML = `
      <fs-date-field label="Fødselsdato"></fs-date-field>
      <fs-calendar id="alene" open></fs-calendar>
    `
    defineFsDateField()
    defineFsCalendar()
    await customElements.whenDefined("fs-date-field")
    await customElements.whenDefined("fs-calendar")
    for (const element of document.querySelectorAll("fs-date-field, fs-calendar")) {
      await (element as LitElement).updateComplete
    }
  })

  it("lar konsumenten flytte ikonet i fs-date-field", () => {
    const button = document.querySelector(".fs-date-field__icon-btn") as HTMLElement

    // Uten inline stil på elementet holder det med én klasse, altså 0,1,0
    apply(".fs-date-field__icon-btn { inset-inline-end: 40px; }")

    expect(getComputedStyle(button).insetInlineEnd).toBe("40px")
  })

  it("lar konsumenten sette komponentvariabler inn i shadow DOM", () => {
    apply(":root { --fs-calendar-radius: 12px; }")

    const calendar = document.getElementById("alene") as HTMLElement
    const popup = calendar.shadowRoot?.querySelector(".popup") as HTMLElement
    expect(getComputedStyle(popup).borderRadius).toBe("12px")
  })

  it("lar konsumenten nå innsiden av kalenderen med ::part()", () => {
    apply("fs-calendar::part(month-button) { background-color: rgb(9, 9, 9); }")

    const calendar = document.getElementById("alene") as HTMLElement
    const knapp = calendar.shadowRoot?.querySelector(".month-button") as HTMLElement
    expect(getComputedStyle(knapp).backgroundColor).toBe("rgb(9, 9, 9)")
  })

  it("når kalenderdelene også gjennom fs-date-field", async () => {
    // fs-date-field har ikke shadow DOM selv, men rendrer en fs-calendar
    // som har det. Delene skal kunne nås gjennom datofeltet.
    apply("fs-date-field fs-calendar::part(trigger) { border-radius: 7px; }")

    const felt = document.querySelector("fs-date-field") as HTMLElement
    const kalender = felt.querySelector("fs-calendar") as LitElement
    await kalender.updateComplete
    const trigger = kalender.shadowRoot?.querySelector(".trigger") as HTMLElement

    expect(getComputedStyle(trigger).borderRadius).toBe("7px")
  })

  it("eksponerer dagens tilstand som egne delnavn", () => {
    // ::part(day)[data-selected] treffer ikke. Det er målt, og derfor delnavn.
    apply("fs-calendar::part(day-today) { outline: 3px solid rgb(8, 8, 8); }")

    const calendar = document.getElementById("alene") as HTMLElement
    const iDag = calendar.shadowRoot?.querySelector(
      '.day[data-today="true"]',
    ) as HTMLElement
    expect(getComputedStyle(iDag).outlineColor).toBe("rgb(8, 8, 8)")
  })
})
