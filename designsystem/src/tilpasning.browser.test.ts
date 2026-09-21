/// <reference path="./types/css.d.ts" />

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import knappeKilde from "./components/css/button/button.css?inline"
import tokenKilde from "./tokens/tokens.css?inline"

import "./tokens/tokens.css"
import "./components/css/button/button.css"
import "./components/css/input/input.css"

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
 * At Fristil og Tailwind kan ligge i samme app uten å slåss.
 *
 * Lagene teller i den rekkefølgen de først blir nevnt, og det siste laget
 * vinner uansett spesifisitet. Tailwinds Preflight ligger i `base`, og
 * nullstiller blant annet bakgrunnen på `button`. Havner `base` etter
 * `fristil`, forsvinner knappefargen vår, uten at noe sier fra.
 *
 * Rekkefølgen kan ikke endres etter at et lag er nevnt, så hver variant måles
 * i sitt eget dokument.
 */
async function medStilark(css: string): Promise<Document> {
  const ramme = document.createElement("iframe")
  ramme.style.width = "400px"
  ramme.style.height = "200px"
  document.body.append(ramme)

  const dok = ramme.contentDocument as Document
  dok.open()
  dok.write(`<!doctype html><html><head><style>${css}</style></head>
    <body><button class="fs-button" id="knapp">Send søknad</button></body></html>`)
  dok.close()

  await new Promise((resolve) => requestAnimationFrame(resolve))
  return dok
}

/** Det Preflight gjør med en knapp, i sitt eget lag. */
const PREFLIGHT = `@layer base { button { background-color: transparent; border: 0; } }`

describe("sammen med Tailwind", () => {
  afterEach(() => {
    // Rammene må bort. Blir de stående, kan fokus havne i dem, og testene
    // som måler fokus lenger ned i suiten måler feil dokument.
    for (const ramme of document.querySelectorAll("iframe")) ramme.remove()
  })

  it("beholder knappefargen når fristil står etter base", async () => {
    const dok = await medStilark(`
      @layer theme, base, fristil, components, utilities;
      ${tokenKilde}
      ${knappeKilde}
      ${PREFLIGHT}
    `)

    const knapp = dok.getElementById("knapp") as HTMLElement
    const bakgrunn = dok.defaultView?.getComputedStyle(knapp).backgroundColor

    expect(bakgrunn).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("mister knappefargen uten rekkefølgen, og det er derfor linja står i dokumentasjonen", async () => {
    const dok = await medStilark(`
      ${tokenKilde}
      ${knappeKilde}
      ${PREFLIGHT}
    `)

    const knapp = dok.getElementById("knapp") as HTMLElement
    const bakgrunn = dok.defaultView?.getComputedStyle(knapp).backgroundColor

    // `base` nevnes her etter `fristil`, og vinner derfor.
    expect(bakgrunn).toBe("rgba(0, 0, 0, 0)")
  })

  it("lar en Tailwind-utility slå komponentens egen verdi", async () => {
    const dok = await medStilark(`
      @layer theme, base, fristil, components, utilities;
      ${tokenKilde}
      ${knappeKilde}
      @layer utilities { .p-6 { padding: 1.5rem; } }
    `)

    const knapp = dok.getElementById("knapp") as HTMLElement
    knapp.classList.add("p-6")

    expect(dok.defaultView?.getComputedStyle(knapp).padding).toBe("24px")
  })
})
