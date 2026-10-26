/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { mount, waitForPaint } from "../../../testing/a11y"

import "../../../tokens/tokens.css"
import "./suggestion.css"

/*
 * No `defineLtSuggestion()` here, on purpose. The file runs in its own frame,
 * so `lt-suggestion` stays unregistered for the whole test, and that is the
 * state the rule in `suggestion.css` applies to: markup written without
 * JavaScript, before the component has had time to close the list.
 */
describe("suggestion.css before the component is registered", () => {
  it("keeps a bare list hidden", async () => {
    expect(customElements.get("lt-suggestion")).toBeUndefined()
    mount(`
      <lt-suggestion>
        <label>Municipality</label>
        <div>
          <input class="lt-input" name="municipality">
          <ul class="lt-suggestion__list"><li>Bath</li><li>Bristol</li></ul>
        </div>
      </lt-suggestion>
    `)
    await waitForPaint()

    const list = document.querySelector("ul") as HTMLElement
    expect(getComputedStyle(list).display).toBe("none")
  })
})
