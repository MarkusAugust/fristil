/// <reference path="./types/css.d.ts" />

import { describe, expect, it } from "vitest"
import { monter } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/checkbox/checkbox.css"
import "./components/css/file-upload/file-upload.css"
import "./components/css/input/input.css"
import "./components/css/radio/radio.css"
import "./components/css/select/select.css"
import "./components/css/textarea/textarea.css"

/**
 * At avslått vinner over en tilstand.
 *
 * `[data-state]` sto etter `:disabled` med samme spesifisitet, så et ugyldig
 * felt i et skjema som var slått av under innsending, så rødt ut og ikke
 * avslått. Hvert felt sammenlignes med et avslått felt uten tilstand.
 */
const FELT = {
  input: '<input class="fs-input"',
  select: '<select class="fs-select"',
  textarea: '<textarea class="fs-textarea"',
  "file-upload": '<input type="file" class="fs-file-upload"',
  checkbox: '<input type="checkbox" class="fs-checkbox"',
  radio: '<input type="radio" class="fs-radio"',
}

const SLUTT: Record<string, string> = {
  select: "><option>Valg</option></select>",
  textarea: "></textarea>",
}

describe("avslått med tilstand", () => {
  for (const [navn, start] of Object.entries(FELT)) {
    for (const tilstand of ["invalid", "success"]) {
      it(`${navn} med ${tilstand} ser avslått ut`, () => {
        const slutt = SLUTT[navn] ?? ">"
        monter(`
          ${start} id="ren" aria-label="Ren" disabled${slutt}
          ${start} id="med" aria-label="Med" disabled data-state="${tilstand}"${slutt}
        `)
        const ren = getComputedStyle(document.getElementById("ren") as Element)
        const med = getComputedStyle(document.getElementById("med") as Element)

        expect(med.backgroundColor).toBe(ren.backgroundColor)
        expect(med.borderTopColor).toBe(ren.borderTopColor)
      })
    }
  }
})
