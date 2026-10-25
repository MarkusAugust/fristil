/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { mount, waitForPaint } from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./suggestion.css"

/*
 * Ingen `defineLtSuggestion()` her, med vilje. Fila kjører i sin egen ramme,
 * så `lt-suggestion` er uregistrert gjennom hele testen, og det er den
 * tilstanden regelen i `suggestion.css` gjelder for: markup skrevet uten
 * JavaScript, før komponenten har rukket å lukke lista.
 */
describe("suggestion.css før komponenten er registrert", () => {
  it("holder en bar liste skjult", async () => {
    expect(customElements.get("lt-suggestion")).toBeUndefined()
    mount(`
      <lt-suggestion>
        <label>Kommune</label>
        <div>
          <input class="lt-input" name="kommune">
          <ul class="lt-suggestion__list"><li>Bergen</li><li>Bodø</li></ul>
        </div>
      </lt-suggestion>
    `)
    await waitForPaint()

    const liste = document.querySelector("ul") as HTMLElement
    expect(getComputedStyle(liste).display).toBe("none")
  })
})
