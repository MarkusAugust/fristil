/// <reference path="../types/css.d.ts" />
// Testerens reproduksjon av 3.1 (hidden). Ikke en del av repoet.
import { describe, expect, it } from "vitest"
import { classes } from "../vocabulary/classes"
import { elements } from "../vocabulary/elements"

// Alle komponentstilark, som i fristil.css.
import.meta.glob("../components/**/*.css", { eager: true })
import "../tokens/tokens.css"

const TAGS = [
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
  "ol",
  "li",
  "nav",
  "details",
  "progress",
  "fieldset",
  "table",
  "h2",
  "img",
  "hr",
  "dialog",
  "output",
]

describe("3.1 hidden", () => {
  it("hver klasse (med og uten varianter) blir display:none med hidden", () => {
    const feil = new Set<string>()
    const flate = document.createElement("div")
    document.body.replaceChildren(flate)
    for (const [klasse, info] of Object.entries(classes)) {
      const varianter: Array<[string, string] | null> = [null]
      for (const [navn, a] of Object.entries(
        (
          info as unknown as {
            attributes: Record<string, { values?: string[] }>
          }
        ).attributes,
      )) {
        for (const v of a.values ?? [""]) varianter.push([navn, v])
      }
      for (const tag of TAGS) {
        for (const variant of varianter) {
          const el = document.createElement(tag)
          el.className = klasse
          if (variant) el.setAttribute(variant[0], variant[1])
          el.hidden = true
          flate.append(el)
          if (getComputedStyle(el).display !== "none") {
            feil.add(klasse)
          }
          el.remove()
        }
      }
    }
    for (const navn of Object.keys(elements)) {
      const el = document.createElement(navn)
      el.hidden = true
      flate.append(el)
      if (getComputedStyle(el).display !== "none") feil.add(`<${navn}>`)
      el.remove()
    }
    // Høy spesifisitet nevnt i planen.
    flate.innerHTML = `
      <select class="fs-select" data-picker="styled"><option id="o1" hidden>x</option><option>y</option></select>
      <nav class="fs-pagination"><span id="s1" aria-disabled="true" hidden>x</span></nav>`
    for (const id of ["o1", "s1"]) {
      const el = document.getElementById(id) as HTMLElement
      if (getComputedStyle(el).display !== "none") feil.add(`#${id}`)
    }
    // until-found skal ikke tvinges til display:none.
    flate.innerHTML = `<div class="fs-card" id="uf" hidden="until-found">x</div>`
    const uf = getComputedStyle(document.getElementById("uf") as HTMLElement)
    const ufInfo = `until-found display=${uf.display} content-visibility=${uf.contentVisibility}`
    expect({ antall: feil.size, feil: [...feil].sort(), ufInfo }).toEqual({
      antall: 0,
      feil: [],
      ufInfo,
    })
  })
})

describe("3.1 konsumentens overstyring", () => {
  it("unlayered !important hos konsumenten slår lagets !important?", () => {
    const stil = document.createElement("style")
    stil.textContent = `#k[hidden] { display: block !important; }`
    document.head.append(stil)
    document.body.innerHTML = `<div class="fs-card" id="k" hidden>x</div>`
    const d = getComputedStyle(
      document.getElementById("k") as HTMLElement,
    ).display
    stil.remove()
    expect(d).toBe("block")
  })

  it("fremmed klasse som inneholder «fs-» (gifs-grid) treffes også", () => {
    const stil = document.createElement("style")
    stil.textContent = `.gifs-grid[hidden] { display: grid; }`
    document.head.append(stil)
    document.body.innerHTML = `<div class="gifs-grid" id="g" hidden>x</div>`
    const d = getComputedStyle(
      document.getElementById("g") as HTMLElement,
    ).display
    stil.remove()
    expect(d).toBe("grid")
  })
})
