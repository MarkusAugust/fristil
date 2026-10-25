/// <reference path="./types/css.d.ts" />

import { describe, expect, it } from "vitest"
import { mount } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/checkbox/checkbox.css"
import "./components/css/file-upload/file-upload.css"
import "./components/css/input/input.css"
import "./components/css/radio/radio.css"
import "./components/css/select/select.css"
import "./components/css/textarea/textarea.css"

/**
 * That disabled wins over a state.
 *
 * `[data-state]` came after `:disabled` with the same specificity, so an
 * invalid field in a form that was disabled during submission looked red and
 * not disabled. Each field is compared with a disabled field without a state.
 */
const FIELDS = {
  input: '<input class="lt-input"',
  select: '<select class="lt-select"',
  textarea: '<textarea class="lt-textarea"',
  "file-upload": '<input type="file" class="lt-file-upload"',
  checkbox: '<input type="checkbox" class="lt-checkbox"',
  radio: '<input type="radio" class="lt-radio"',
}

const END: Record<string, string> = {
  select: "><option>Option</option></select>",
  textarea: "></textarea>",
}

describe("disabled with a state", () => {
  for (const [name, start] of Object.entries(FIELDS)) {
    for (const state of ["invalid", "success"]) {
      it(`${name} with ${state} looks disabled`, () => {
        const end = END[name] ?? ">"
        mount(`
          ${start} id="plain" aria-label="Plain" disabled${end}
          ${start} id="with" aria-label="With" disabled data-state="${state}"${end}
        `)
        const plain = getComputedStyle(
          document.getElementById("plain") as Element,
        )
        const withState = getComputedStyle(
          document.getElementById("with") as Element,
        )

        expect(withState.backgroundColor).toBe(plain.backgroundColor)
        expect(withState.borderTopColor).toBe(plain.borderTopColor)
      })
    }
  }
})
