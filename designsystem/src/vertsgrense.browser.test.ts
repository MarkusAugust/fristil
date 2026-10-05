/// <reference path="./types/css.d.ts" />

import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { buttonVariants } from "./components/css/button/button"
import { defineFsField } from "./components/ramme/field/fs-field"

import "./tokens/tokens.css"
import "./tokens/boundary.css"
import "./components/css/button/button.css"
import "./components/ramme/field/field.css"

/**
 * At `data-fs-boundary` gir en innebygd komponent stilen tilbake i en
 * vertsside med CSS uten lag.
 *
 * Vertens regler under er de vanlige: en nullstilling av knapper, et utdrag
 * av normalize, og nullstillinger med (0,1,1), som er grunnen til at
 * attributtet står to ganger i `boundary.css`. Alle står uten lag, og slår
 * dermed `@layer fristil` uten grensen.
 */
const ARV = "body { font-family: Georgia, serif; }"

const NULLSTILLING = `
  button { background: none; text-decoration: none; border: none; border-radius: 0; cursor: pointer; color: rgb(200, 0, 0); }
  button, input, optgroup, select, textarea { margin: 0; font-family: inherit; font-size: 100%; line-height: 1.15; }
  button:not(:disabled) { padding: 0; }
  input[type="text"] { border: 0; padding: 0; }
  label { display: inline; font-weight: 400; }
  label::after { content: none; }
`

const EGENSKAPER = [
  "background-color",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-top-left-radius",
  "color",
  "cursor",
  "display",
  "font-size",
  "font-weight",
  "line-height",
  "margin-top",
  "padding-top",
  "padding-inline-start",
  "text-decoration-line",
] as const

const MARKUP = `
  <div id="utenfor"><button type="button" class="fs-button">Utenfor</button></div>
  <div data-fs-boundary data-theme="light">
    ${buttonVariants
      .map(
        (variant) =>
          `<button type="button" class="fs-button" data-variant="${variant}" data-maal="knapp-${variant}">Lagre</button>`,
      )
      .join("")}
    <select class="fs-select" data-maal="select"><option>Ti</option></select>
    <input type="text" class="fs-input" data-maal="input" />
    <label class="fs-label" data-required data-maal="ledetekst">Navn</label>
    <fs-field data-maal="felt">
      <label class="fs-label" data-maal="feltets-ledetekst">Fødselsdato</label>
      <input type="text" class="fs-input" required data-maal="feltets-input" />
      <p class="fs-help-text" data-maal="hjelpetekst">Skriv dag, måned og år.</p>
    </fs-field>
  </div>
`

function verten(css: string): void {
  const stil = document.createElement("style")
  stil.dataset.vert = ""
  stil.textContent = css
  document.head.append(stil)
}

function les(): Record<string, Record<string, string>> {
  const alle: Record<string, Record<string, string>> = {}
  for (const el of document.querySelectorAll<HTMLElement>("[data-maal]")) {
    const stil = getComputedStyle(el)
    const verdier: Record<string, string> = {}
    for (const navn of EGENSKAPER) verdier[navn] = stil.getPropertyValue(navn)
    verdier["::after content"] = getComputedStyle(el, "::after").content
    alle[el.dataset.maal as string] = verdier
  }
  return alle
}

describe("grensen mot en vertsside", () => {
  beforeAll(() => defineFsField())

  afterEach(() => {
    for (const stil of document.querySelectorAll("style[data-vert]"))
      stil.remove()
    document.body.innerHTML = ""
  })

  it("gir komponentene de samme verdiene som uten vertens nullstillinger", () => {
    /*
     * Skriften fra vertens `body` er med i begge avlesningene, siden den skal
     * arves også inne i grensen. Skriftfamilien sjekkes i testen under og
     * ikke her. Settes skriften på `body` i samme stilberegning som en
     * `<select>` settes inn, svarer `getComputedStyle` i WebKit med den
     * gamle verdien, `-webkit-standard`, selv om lista tegnes med riktig
     * skrift. Sammenligningen ville da handlet om WebKit og ikke om grensen.
     */
    document.body.innerHTML = MARKUP
    verten(ARV)
    const uten = les()
    expect(Object.keys(uten)).toHaveLength(buttonVariants.length + 7)
    // Markeringen er et pseudoelement, og det må finnes for å kunne sammenlignes
    expect(uten.ledetekst["::after content"]).not.toBe("none")

    verten(NULLSTILLING)

    expect(les()).toEqual(uten)
  })

  it("lar skriften komme fra verten", () => {
    document.body.innerHTML = MARKUP
    verten(ARV + NULLSTILLING)

    for (const maal of ["knapp-primary", "input", "ledetekst"]) {
      const el = document.querySelector(`[data-maal="${maal}"]`) as HTMLElement
      expect(getComputedStyle(el).fontFamily, maal).toBe("Georgia, serif")
    }
  })

  it("lar verten utenfor grensen være som den var", () => {
    document.body.innerHTML = MARKUP
    verten(ARV + NULLSTILLING)

    const utenfor = getComputedStyle(
      document.querySelector("#utenfor button") as HTMLElement,
    )
    expect(utenfor.backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(utenfor.borderTopStyle).toBe("none")
    expect(utenfor.color).toBe("rgb(200, 0, 0)")
  })

  it("lar --fs-variablene på rotelementet virke", () => {
    document.body.innerHTML = MARKUP
    verten(ARV + NULLSTILLING)
    const rot = document.querySelector("[data-fs-boundary]") as HTMLElement
    rot.style.setProperty("--fs-button-radius", "9999px")

    const knapp = document.querySelector(
      '[data-maal="knapp-primary"]',
    ) as HTMLElement
    expect(getComputedStyle(knapp).borderTopLeftRadius).toBe("9999px")
  })

  it("lar verten ta stilen uten grensen", () => {
    // En kontroll på at sammenligningen over sammenligner noe: uten grensen skal
    // vertens CSS faktisk ta stilen fra knappen.
    document.body.innerHTML = MARKUP
    const uten = les()
    document
      .querySelector("[data-fs-boundary]")
      ?.removeAttribute("data-fs-boundary")
    verten(NULLSTILLING)

    expect(les()["knapp-primary"]).not.toEqual(uten["knapp-primary"])
  })
})
