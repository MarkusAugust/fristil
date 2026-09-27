/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { monter, ventPaTegning } from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./suggestion.css"

/*
 * Ingen `defineFsSuggestion()` her, med vilje. Fila kjører i sin egen ramme,
 * så `fs-suggestion` er uregistrert gjennom hele testen, og det er den
 * tilstanden regelen i `suggestion.css` gjelder for: markup skrevet uten
 * JavaScript, før komponenten har rukket å lukke lista.
 */
describe("suggestion.css før komponenten er registrert", () => {
  it("holder en bar liste skjult", async () => {
    expect(customElements.get("fs-suggestion")).toBeUndefined()
    monter(`
      <fs-suggestion>
        <label>Kommune</label>
        <div class="fs-suggestion__field">
          <input class="fs-input" name="kommune">
          <ul class="fs-suggestion__list"><li>Bergen</li><li>Bodø</li></ul>
        </div>
      </fs-suggestion>
    `)
    await ventPaTegning()

    const liste = document.querySelector("ul") as HTMLElement
    expect(getComputedStyle(liste).display).toBe("none")
  })
})
