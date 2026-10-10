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

/** Reglene som gir et barn uten klasse `display`. Hver er dekket av `BARN`. */
const BARN_MED_DISPLAY = [
  ".fs-accordion summary",
  ".fs-breadcrumbs li",
  ".fs-file-upload-list li",
  ".fs-pagination a",
  ".fs-pagination button",
  '.fs-pagination span[aria-disabled="true"]',
  '.fs-select[data-picker="styled"] option',
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
    // Barna har ingen klasse, og får `display` fra komponenten. To av dem med
    // spesifisitet (0,2,1).
    document.body.innerHTML = `
      <select class="fs-select" data-picker="styled">
        <option id="valg" hidden>Skjult</option>
        <option>Synlig</option>
      </select>
      <nav class="fs-pagination">
        <span id="side" aria-disabled="true" hidden>Forrige</span>
      </nav>
      <nav class="fs-breadcrumbs"><ol><li id="ledd" hidden>Mellom</li></ol></nav>
      <ul class="fs-file-upload-list"><li id="fil" hidden>vedlegg.pdf</li></ul>
      <details class="fs-accordion"><summary id="topp" hidden>Spørsmål</summary></details>`

    for (const id of ["valg", "side", "ledd", "fil", "topp"]) {
      const element = document.getElementById(id) as HTMLElement
      expect(getComputedStyle(element).display, id).toBe("none")
    }
  })

  it("kjenner hvert barn uten klasse som får display fra en komponent", () => {
    // Barn uten egen `fs-`-klasse må stå i `BARN` i generate-tokens.ts.
    // Testen finner reglene selv, så et nytt barn feiler her og ikke hos
    // brukeren.
    const funnet = new Set<string>()
    const besøk = (regler: CSSRuleList) => {
      for (const regel of regler) {
        if ("cssRules" in regel && !(regel instanceof CSSStyleRule)) {
          besøk((regel as CSSGroupingRule).cssRules)
          continue
        }
        if (!(regel instanceof CSSStyleRule)) continue
        const display = regel.style.getPropertyValue("display")
        if (!display || display === "none") continue
        for (const velger of regel.selectorText.split(",")) {
          const siste =
            velger
              .trim()
              .split(/\s*[\s>+~]\s*/)
              .pop() ?? ""
          if (/(^|[.:(])fs-|^fs-/.test(siste) || siste.includes(".fs-"))
            continue
          funnet.add(velger.trim().replace(/\s+/g, " "))
        }
      }
    }
    for (const ark of document.styleSheets) besøk(ark.cssRules)

    expect([...funnet].sort()).toEqual(BARN_MED_DISPLAY)
  })

  it("skjuler en klasse med tab eller linjeskift foran", () => {
    document.body.innerHTML = `
      <div class="mb-4\tfs-alert" id="tab" hidden></div>
      <div class="mb-4\nfs-alert" id="linje" hidden></div>`

    for (const id of ["tab", "linje"]) {
      const element = document.getElementById(id) as HTMLElement
      expect(getComputedStyle(element).display, id).toBe("none")
    }
  })

  it("rører ikke Bootstraps fs-1 til fs-6", () => {
    const stil = document.createElement("style")
    stil.textContent = ".fs-1[hidden] { display: block; }"
    document.head.append(stil)
    try {
      document.body.innerHTML = '<h1 class="fs-1" id="stor" hidden>Tittel</h1>'
      expect(
        getComputedStyle(document.getElementById("stor") as HTMLElement)
          .display,
      ).toBe("block")
    } finally {
      stil.remove()
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
