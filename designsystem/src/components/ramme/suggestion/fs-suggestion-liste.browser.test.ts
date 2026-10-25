/// <reference path="../../../types/css.d.ts" />

/**
 * Lista i forslagsfeltet: navnet, valgt-statusen, lasting og topplaget.
 *
 * Lista er en `listbox`, og den trenger et navn som alle andre kontroller
 * (axe: `aria-input-field-name`). Hvert alternativ sier om det er valgt fra
 * starten, ikke først når lista lukkes. Mens svaret på et søk er underveis,
 * sier lista `aria-busy`. Og lista står i det øverste laget, så en forelder med
 * `overflow` ikke klipper den, som kroppen i en dialog.
 */

import { beforeAll, describe, expect, it } from "vitest"

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
const NOKLER = ["bergen", "bodo", "oslo", "tromso"]

/** Slik en mal skriver det uten byggefunksjonen: ingen roller, ingen navn på lista. */
const BAR = `
  <fs-suggestion>
    <label class="fs-label" for="kommune">Kommune</label>
    <input class="fs-input" id="kommune" name="kommune">
    <ul class="fs-suggestion__list">
      ${KOMMUNER.map((k) => `<li>${k}</li>`).join("")}
    </ul>
    <span class="fs-sr-only" role="status"></span>
  </fs-suggestion>`

/** Ledeteksten rundt feltet, uten id på noe. */
const RUNDT = `
  <fs-suggestion>
    <label class="fs-label">Kommune <input class="fs-input" name="kommune"></label>
    <ul class="fs-suggestion__list">
      ${KOMMUNER.map((k) => `<li>${k}</li>`).join("")}
    </ul>
    <span class="fs-sr-only" role="status"></span>
  </fs-suggestion>`

function fraByggefunksjonen(valg: { pending?: boolean } = {}) {
  const f = suggestion({ id: "kommune", keys: NOKLER, ...valg })
  return `
  <fs-suggestion>
    <label ${attr(f.label)}>Kommune</label>
    <input ${attr(f.control)} name="kommune">
    <ul ${attr(f.list)}>
      ${f.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
    </ul>
    <p ${attr(f.empty)}>Ingen treff</p>
    <span ${attr(f.status)}></span>
  </fs-suggestion>`
}

async function tegn() {
  await customElements.whenDefined("fs-suggestion")
  await ventPaTegning()
  await ventPaTegning()
  return document.querySelector("fs-suggestion") as FsSuggestion
}

const liste = () => document.querySelector("[role='listbox']") as HTMLElement
const felt = () => document.querySelector("input") as HTMLInputElement
const alternativer = () => [
  ...document.querySelectorAll<HTMLElement>("[role='option']"),
]

async function apne() {
  felt().focus()
  felt().dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  )
  await tegn()
}

/** Navnet lista får, gjennom `aria-labelledby` eller `aria-label`. */
function navn(element: HTMLElement): string {
  const label = element.getAttribute("aria-label")
  if (label !== null && !element.hasAttribute("aria-labelledby")) return label
  const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/)
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

describe("lista har et navn", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  it("fra ledeteksten, når markupen kom uten", async () => {
    monter(BAR)
    await tegn()
    expect(navn(liste())).toBe("Kommune")
  })

  it("fra ledeteksten rundt feltet, uten id på ledeteksten eller feltet", async () => {
    // En id på ledeteksten rundt feltet ville fått en morfing til å bytte ut
    // ledeteksten, og feltet i den. Navnet er da teksten, uten verdien.
    monter(RUNDT)
    await tegn()
    felt().value = "Ber"
    felt().dispatchEvent(new Event("input", { bubbles: true }))
    await tegn()
    expect(navn(liste())).toBe("Kommune")
    expect(document.querySelector("label")?.hasAttribute("id")).toBe(false)
    expect(felt().hasAttribute("id")).toBe(false)
  })

  it("fra byggefunksjonen, uten at komponenten skriver noe", async () => {
    monter(fraByggefunksjonen())
    expect(liste().getAttribute("aria-labelledby")).toBe("kommune-label")
    expect(document.querySelector("label")?.id).toBe("kommune-label")
  })

  it("lar et navn serveren skrev stå", async () => {
    monter(BAR.replace('<ul class="fs-suggestion__list">', '<ul class="fs-suggestion__list" aria-label="Kommuner i Norge">'))
    await tegn()
    expect(liste().getAttribute("aria-label")).toBe("Kommuner i Norge")
    expect(liste().hasAttribute("aria-labelledby")).toBe(false)
  })

  it("har ingen tilgjengelighetsbrudd med lista åpen", async () => {
    monter(BAR)
    await tegn()
    await apne()
    expect(liste().hidden).toBe(false)
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("hvert alternativ sier om det er valgt", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  it("fra starten, før lista har vært åpen", async () => {
    // Firefox leser et alternativ uten `aria-selected` som valgt.
    monter(BAR)
    await tegn()
    expect(alternativer().map((o) => o.getAttribute("aria-selected"))).toEqual(
      ["false", "false", "false", "false"],
    )
  })
})

describe("lista sier fra mens svaret er underveis", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  it("fs.suggestion({ pending }) skriver aria-busy på lista", () => {
    expect(suggestion({ id: "k", pending: true }).list["aria-busy"]).toBe(
      "true",
    )
    expect(suggestion({ id: "k" }).list["aria-busy"]).toBeUndefined()
  })

  it("holder tommeldingen skjult mens lista sier aria-busy", async () => {
    monter(
      BAR.replace(
        '<ul class="fs-suggestion__list">',
        '<ul class="fs-suggestion__list" aria-busy="true">',
      ).replace(
        '<span class="fs-sr-only"',
        '<p class="fs-suggestion__empty">Ingen treff</p><span class="fs-sr-only"',
      ),
    )
    await tegn()
    await apne()
    felt().value = "xyz"
    felt().dispatchEvent(new Event("input", { bubbles: true }))
    await tegn()
    const tom = document.querySelector(".fs-suggestion__empty") as HTMLElement
    expect(getComputedStyle(tom).display).toBe("none")

    liste().removeAttribute("aria-busy")
    await tegn()
    expect(getComputedStyle(tom).display).not.toBe("none")
  })
})

describe("lista står i det øverste laget", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  it("er et popover, åpent når lista er åpen og lukket ellers", async () => {
    monter(BAR)
    await tegn()
    expect(liste().getAttribute("popover")).toBe("manual")
    expect(liste().matches(":popover-open")).toBe(false)
    await apne()
    expect(liste().matches(":popover-open")).toBe(true)
    felt().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
    await tegn()
    expect(liste().hidden).toBe(true)
    expect(liste().matches(":popover-open")).toBe(false)
  })

  it("klippes ikke av en forelder med overflow", async () => {
    monter(`<div class="rulleboks">${BAR}</div>`)
    const boks = document.querySelector(".rulleboks") as HTMLElement
    // Som kroppen i en dialog: lav, og rullbar.
    boks.style.blockSize = "4rem"
    boks.style.overflow = "auto"
    await tegn()
    await apne()
    const siste = alternativer()[3]
    const r = siste.getBoundingClientRect()
    const treff = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    expect(treff).toBe(siste)
  })

  it("står under feltet, like bred som det", async () => {
    monter(BAR)
    await tegn()
    await apne()
    const f = felt().getBoundingClientRect()
    const l = liste().getBoundingClientRect()
    expect(Math.abs(l.left - f.left)).toBeLessThan(2)
    expect(Math.abs(l.width - f.width)).toBeLessThan(2)
    expect(l.top).toBeGreaterThanOrEqual(f.bottom)
    expect(l.top - f.bottom).toBeLessThan(12)
  })

  it("står åpent når en oppdatering tar popover fra lista", async () => {
    monter(BAR)
    await tegn()
    await apne()
    // Slik en morfing fra serverens markup gjør det.
    liste().removeAttribute("popover")
    await tegn()
    expect(liste().getAttribute("popover")).toBe("manual")
    expect(liste().matches(":popover-open")).toBe(true)
  })

  it("følger serveren som lukker lista med hidden", async () => {
    monter(BAR.replace("<fs-suggestion>", "<fs-suggestion server-controlled>"))
    await tegn()
    await apne()
    liste().hidden = true
    felt().setAttribute("aria-expanded", "false")
    await tegn()
    expect(liste().matches(":popover-open")).toBe(false)
  })

  it("byggefunksjonen skriver popover", () => {
    expect(suggestion({ id: "k" }).list.popover).toBe("manual")
  })
})
