/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { checkbox } from "./checkbox"

import "../../../tokens/tokens.css"
import "./checkbox.css"
import "../label/label.css"

function stil(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Mangler #${id}`)
  }
  return getComputedStyle(element)
}

describe("fs-checkbox", () => {
  beforeEach(() => {
    monter(`
      <div class="fs-checkbox-row">
        <input class="fs-checkbox" type="checkbox" id="vilkar" />
        <label class="fs-label" for="vilkar">Jeg godtar vilkårene</label>
      </div>
      <div class="fs-checkbox-row">
        <input class="fs-checkbox" type="checkbox" id="nyhetsbrev" checked />
        <label class="fs-label" for="nyhetsbrev">Send meg nyhetsbrev</label>
      </div>
      <div class="fs-checkbox-row">
        <input class="fs-checkbox" type="checkbox" id="delvis" />
        <label class="fs-label" for="delvis">Velg alle vedlegg</label>
      </div>
      <div class="fs-checkbox-row">
        <input class="fs-checkbox" type="checkbox" id="ugyldig"
          data-state="invalid" aria-invalid="true" />
        <label class="fs-label" for="ugyldig">Jeg bekrefter opplysningene</label>
      </div>
    `)

    const delvis = document.getElementById("delvis") as HTMLInputElement
    delvis.indeterminate = true
  })

  it("viser haken når boksen er krysset av", () => {
    expect(stil("nyhetsbrev").backgroundImage).toContain("polyline")
    expect(stil("vilkar").backgroundImage).toBe("none")
  })

  it("viser streken når boksen er delvis avkrysset", () => {
    expect(stil("delvis").backgroundImage).toContain("line")
  })

  it("er stor nok til å treffes", () => {
    const boks = document.getElementById("vilkar") as HTMLElement
    const rute = boks.getBoundingClientRect()

    // 20 piksler pluss fokusmarkeringen utenfor. Under 20 blir boksen
    // vanskelig å treffe med finger, og haken utydelig.
    expect(rute.width).toBeGreaterThanOrEqual(20)
    expect(rute.height).toBeGreaterThanOrEqual(20)
  })

  it("markerer ugyldig med både farge og aria", () => {
    const ugyldig = document.getElementById("ugyldig") as HTMLInputElement

    expect(ugyldig.getAttribute("aria-invalid")).toBe("true")
    expect(stil("ugyldig").borderColor).not.toBe(stil("vilkar").borderColor)
  })

  it("setter attributtene fra byggefunksjonen", () => {
    expect(checkbox()).toEqual({ class: "fs-checkbox", type: "checkbox" })
    expect(checkbox({ state: "invalid" })).toEqual({
      class: "fs-checkbox",
      type: "checkbox",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
    expect(checkbox.row).toBe("fs-checkbox-row")
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
