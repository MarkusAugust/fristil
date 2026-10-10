/// <reference path="./types/css.d.ts" />

import { afterEach, describe, expect, it } from "vitest"
import { classes } from "./vocabulary/classes"
import { elements } from "./vocabulary/elements"

import "./tokens/tokens.css"

// Alle komponentstilarkene, slik `fristil.css` har dem.
import.meta.glob("./components/**/*.css", { eager: true })

/**
 * At `hidden` skjuler, også en komponent som setter `display` selv.
 *
 * Forfatterstil i et hvilket som helst lag slår nettleserens
 * `[hidden] { display: none }`, og bare tre komponenter hadde en egen regel.
 * `<div class="fs-alert" hidden>` sto synlig, og det samme gjorde 41 andre
 * klasser og åtte av elementene.
 */

const TAGGER = [
  "div",
  "span",
  "p",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "ul",
  "li",
  "nav",
  "details",
  "progress",
  "fieldset",
  "table",
  "h2",
  "hr",
  "dialog",
]

afterEach(() => {
  document.body.replaceChildren()
})

function synlig(element: HTMLElement): boolean {
  document.body.append(element)
  const synlig = getComputedStyle(element).display !== "none"
  element.remove()
  return synlig
}

describe("hidden", () => {
  it("skjuler hver klasse, med hver variant", () => {
    const synlige = new Set<string>()
    for (const [klasse, info] of Object.entries(classes)) {
      const varianter: Array<[string, string] | null> = [null]
      for (const [navn, attributt] of Object.entries(info.attributes)) {
        for (const verdi of attributt.values) {
          varianter.push([navn, verdi])
        }
      }
      for (const tagg of TAGGER) {
        for (const variant of varianter) {
          const element = document.createElement(tagg)
          element.className = klasse
          if (variant) element.setAttribute(...variant)
          element.hidden = true
          if (synlig(element)) synlige.add(`${tagg}.${klasse}`)
        }
      }
    }

    expect([...synlige]).toEqual([])
  })

  it("skjuler hvert element", () => {
    const synlige = Object.keys(elements).filter((tagg) => {
      const element = document.createElement(tagg)
      element.hidden = true
      return synlig(element)
    })

    expect(synlige).toEqual([])
  })

  it("skjuler barn som får display fra komponenten", () => {
    // Begge har en regel med spesifisitet (0,2,1), og barna har ingen klasse.
    document.body.innerHTML = `
      <select class="fs-select" data-picker="styled">
        <option id="valg" hidden>Skjult</option>
        <option>Synlig</option>
      </select>
      <nav class="fs-pagination">
        <span id="side" aria-disabled="true" hidden>Forrige</span>
      </nav>`

    for (const id of ["valg", "side"]) {
      const element = document.getElementById(id) as HTMLElement
      expect(getComputedStyle(element).display, id).toBe("none")
    }
  })

  it("rører ikke en klasse som bare inneholder fs-", () => {
    const stil = document.createElement("style")
    stil.textContent = ".gifs-grid[hidden] { display: grid; }"
    document.head.append(stil)
    try {
      document.body.innerHTML = '<div class="gifs-grid" id="grid" hidden></div>'
      expect(
        getComputedStyle(document.getElementById("grid") as HTMLElement)
          .display,
      ).toBe("grid")
    } finally {
      stil.remove()
    }
  })

  it("lar until-found stå, så nettleseren kan søke i innholdet", () => {
    document.body.innerHTML =
      '<div class="fs-card" id="kort" hidden="until-found">Tekst</div>'

    expect(
      getComputedStyle(document.getElementById("kort") as HTMLElement).display,
    ).not.toBe("none")
  })
})
