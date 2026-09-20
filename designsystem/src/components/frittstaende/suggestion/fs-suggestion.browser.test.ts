/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsSuggestion, type FsSuggestion } from "./fs-suggestion"

import "../../../tokens/tokens.css"
import "./suggestion.css"

async function tegn() {
  const felt = document.querySelector("fs-suggestion") as FsSuggestion
  await customElements.whenDefined("fs-suggestion")
  await felt.updateComplete
  return felt
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
      <fs-suggestion label="Kommune" name="kommune" help-text="Begynn å skrive">
        <option>Bergen</option>
        <option>Bodø</option>
        <option>Oslo</option>
        <option>Tromsø</option>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("kobler feltet som en combobox", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    expect(input.getAttribute("role")).toBe("combobox")
    expect(input.getAttribute("aria-autocomplete")).toBe("list")
    expect(input.getAttribute("aria-controls")).toBe(liste.id)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("snevrer inn forslagene mens brukeren skriver", async () => {
    const felt = await tegn()
    skriv(felt, "bo")
    await tegn()

    const forslag = [...felt.querySelectorAll("[role='option']")].map((o) =>
      o.textContent?.trim(),
    )

    expect(forslag).toEqual(["Bodø"])
  })

  it("melder antall treff til skjermlesere", async () => {
    const felt = await tegn()
    skriv(felt, "b")
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement

    // Nettleserens egen <datalist> sier ingenting om hvor mange treff det er.
    expect(status.textContent?.trim()).toBe("2 forslag")
  })

  it("flytter markeringen med piltastene og peker på den med aria", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(new Event("focus"))
    await tegn()
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()

    const markert = felt.querySelector(
      "[role='option'][aria-selected='true']",
    ) as HTMLElement

    expect(markert.textContent?.trim()).toBe("Bergen")
    expect(input.getAttribute("aria-activedescendant")).toBe(markert.id)
  })

  it("velger med Enter og melder fra", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const valg: string[] = []
    felt.addEventListener("suggestion-select", (hendelse) => {
      valg.push((hendelse as CustomEvent<{ value: string }>).detail.value)
    })

    input.dispatchEvent(new Event("focus"))
    await tegn()
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    )
    await tegn()

    expect(valg).toEqual(["Bergen"])
    expect(felt.value).toBe("Bergen")
    expect(input.value).toBe("Bergen")
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("sier fra når ingenting passer", async () => {
    const felt = await tegn()
    skriv(felt, "xyz")
    await tegn()

    expect(felt.querySelectorAll("[role='option']")).toHaveLength(0)
    expect(
      (
        felt.querySelector("[role='status']") as HTMLElement
      ).textContent?.trim(),
    ).toBe("Ingen treff")
  })

  it("lukker lista på Escape", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(new Event("focus"))
    await tegn()
    expect(felt.open).toBe(true)

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
    await tegn()

    expect(felt.open).toBe(false)
  })

  it("lar brukeren skrive noe som ikke står i lista", async () => {
    const felt = await tegn()
    skriv(felt, "Kautokeino")
    await tegn()

    // Feltet er et fritekstfelt, ikke en nedtrekksliste.
    expect(felt.value).toBe("Kautokeino")
  })

  it("har ingen tilgjengelighetsbrudd med lista åpen", async () => {
    const felt = await tegn()
    felt.show()
    await tegn()
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
