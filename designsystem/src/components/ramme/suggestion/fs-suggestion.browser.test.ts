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

/**
 * Serveren kan også bestemme hvilket alternativ som er aktivt.
 *
 * `fs.suggestion({ activeIndex })` skriver `aria-selected="true"` på ett av
 * dem. Holdt komponenten en egen teller ved siden av, ville første piltast
 * hoppe til toppen av lista i stedet for til neste alternativ, og
 * markeringen serveren nettopp sendte var borte.
 */
describe("fs-suggestion med markeringen fra serveren", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(async () => {
    const fra = suggestion({
      id: "kommune",
      count: KOMMUNER.length,
      open: true,
      activeIndex: 2,
    })

    monter(`
      <fs-suggestion>
        <label ${attr(fra.label)}>Kommune</label>
        <div ${attr(fra.field)}>
          <input ${attr(fra.control)} name="kommune">
          <ul ${attr(fra.list)}>
            ${fra.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(fra.empty)}>Ingen treff</p>
          <span ${attr(fra.status)}></span>
        </div>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("går videre fra det serveren markerte", async () => {
    const felt = document.querySelector("fs-suggestion") as FsSuggestion
    const input = felt.querySelector("input") as HTMLInputElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    expect(valg[2].getAttribute("aria-selected")).toBe("true")

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await ventPaTegning()

    expect(
      valg[3].getAttribute("aria-selected"),
      "piltasten hoppet ikke til alternativet etter det serveren markerte",
    ).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[3].id)
  })
})

describe("fs-suggestion med pil opp", () => {
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
          <p ${attr(FORSLAG.empty)}>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("åpner lista og går til det siste alternativet", async () => {
    const felt = document.querySelector("fs-suggestion") as FsSuggestion
    const input = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    )
    await ventPaTegning()

    // Uten åpningen pekte aria-activedescendant inn i en liste feltet
    // samtidig meldte som lukket.
    expect(liste.hidden, "lista ble ikke åpnet").toBe(false)
    expect(input.getAttribute("aria-expanded")).toBe("true")

    const siste = valg[valg.length - 1]
    expect(
      siste.getAttribute("aria-selected"),
      "pil opp gikk ikke til det siste alternativet",
    ).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(siste.id)
  })
})
