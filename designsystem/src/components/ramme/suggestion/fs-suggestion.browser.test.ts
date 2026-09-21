/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsSuggestion, type FsSuggestion } from "./fs-suggestion"
import { suggestion } from "./suggestion"

import "../../../tokens/tokens.css"
import "./suggestion.css"
import "../../css/sr-only/sr-only.css"

const KOMMUNER = ["Bergen", "Bodø", "Oslo", "Tromsø"]

/** Markupen serveren sender. Feltet og lista finnes før skriptet har kjørt. */
const FORSLAG = suggestion({
  id: "kommune",
  count: KOMMUNER.length,
  help: true,
})

async function tegn() {
  await customElements.whenDefined("fs-suggestion")
  await ventPaTegning()
  return document.querySelector("fs-suggestion") as FsSuggestion
}

function skriv(felt: FsSuggestion, tekst: string) {
  const input = felt.querySelector("input") as HTMLInputElement
  input.value = tekst
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("fs-suggestion", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(async () => {
    monter(`
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div ${attr(FORSLAG.field)}>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(FORSLAG.empty)} hidden>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
        <p class="fs-help-text" ${attr(FORSLAG.help)}>Begynn å skrive</p>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("er et ekte felt før skriptet har kjørt", () => {
    // Komponenten rendret tidligere hele feltet selv. Da fantes det ikke noe
    // å fylle ut, og ingenting ble med i innsendingen.
    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement

    expect(input.name).toBe("kommune")
    expect(label.htmlFor).toBe(input.id)
    expect(input.getAttribute("role")).toBe("combobox")
    expect(input.getAttribute("aria-autocomplete")).toBe("list")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.querySelectorAll("[role='option']")).toHaveLength(4)
  })

  it("ber serveren bevare det komponenten endrer", () => {
    const input = document.querySelector("input") as HTMLInputElement
    const liste = document.querySelector("[role='listbox']") as HTMLElement

    expect(input.getAttribute("data-preserve-attr")).toBe(
      "aria-expanded aria-activedescendant",
    )
    expect(liste.getAttribute("data-preserve-attr")).toBe("hidden")
  })

  it("snevrer inn forslagene mens brukeren skriver", async () => {
    const felt = await tegn()
    skriv(felt, "bo")
    await tegn()

    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)

    expect(synlige.map((o) => o.textContent?.trim())).toEqual(["Bodø"])
  })

  it("melder antall treff til skjermlesere", async () => {
    const felt = await tegn()
    skriv(felt, "bod")
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("Ett treff")
  })

  it("flytter markeringen med piltastene og peker på den med aria", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()

    const aktiv = felt.querySelector("[aria-selected='true']") as HTMLElement
    expect(aktiv.textContent?.trim()).toBe("Bergen")
    // Fokus blir i feltet. aria-activedescendant er det som gjør at
    // skjermleseren likevel leser opp alternativet.
    expect(input.getAttribute("aria-activedescendant")).toBe(aktiv.id)
  })

  it("velger med Enter og melder fra", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const valgt: string[] = []
    felt.addEventListener("suggestion-select", (hendelse) => {
      valgt.push((hendelse as CustomEvent<{ value: string }>).detail.value)
    })

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    )
    await tegn()

    expect(input.value).toBe("Bergen")
    expect(valgt).toEqual(["Bergen"])
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("sier fra når ingenting passer", async () => {
    const felt = await tegn()
    skriv(felt, "xyz")
    await tegn()

    const tom = felt.querySelector(".fs-suggestion__empty") as HTMLElement
    expect(tom.hidden).toBe(false)
    expect(
      (felt.querySelector("[role='status']") as HTMLElement).textContent,
    ).toBe("Ingen treff")
  })

  it("lukker lista på Escape", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    skriv(felt, "bo")
    await tegn()

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
    await tegn()

    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    expect(liste.hidden).toBe(true)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("lar serveren bestemme når den filtrerer selv", async () => {
    const felt = await tegn()
    felt.setAttribute("server-filtered", "")
    skriv(felt, "xyz")
    await tegn()

    // I en Datastar-app patcher serveren lista mens brukeren skriver. Da skal
    // komponenten holde fingrene av fatet.
    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)
    expect(synlige).toHaveLength(4)
  })

  it("har ingen tilgjengelighetsbrudd med lista åpen", async () => {
    const felt = await tegn()
    skriv(felt, "o")
    await tegn()

    await forventIngenTilgjengelighetsbrudd()
  })
})
