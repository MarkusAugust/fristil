/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { defineDsField } from "./ds-field"

describe("ds-field", () => {
  beforeAll(() => {
    defineDsField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("wires label[for] to the control id", async () => {
    document.body.innerHTML = `
      <ds-field>
        <label id="label">E-post</label>
        <input id="email" class="ds-input" type="email" />
      </ds-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.htmlFor).toBe("email")
  })

  it("adds ids and aria-describedby for help and error text", async () => {
    document.body.innerHTML = `
      <ds-field invalid>
        <label for="email">E-post</label>
        <input id="email" class="ds-input" type="email" />
        <p class="ds-help-text">Hjelp</p>
        <p class="ds-error-text">Feil</p>
      </ds-field>
    `

    await Promise.resolve()

    const field = document.querySelector("ds-field") as HTMLElement
    const input = field.querySelector("input") as HTMLInputElement
    const help = field.querySelector(".ds-help-text") as HTMLElement
    const error = field.querySelector(".ds-error-text") as HTMLElement

    expect(help.id.length).toBeGreaterThan(0)
    expect(error.id.length).toBeGreaterThan(0)
    expect(input.getAttribute("aria-invalid")).toBe("true")

    const describedBy = input.getAttribute("aria-describedby") || ""
    expect(describedBy).toContain(help.id)
    expect(describedBy).toContain(error.id)
  })

  it("hides error text until invalid is true", async () => {
    document.body.innerHTML = `
      <ds-field>
        <label for="email">E-post</label>
        <input id="email" class="ds-input" type="email" />
        <p class="ds-error-text">Skriv en gyldig e-post.</p>
      </ds-field>
    `

    await Promise.resolve()

    const error = document.querySelector(".ds-error-text") as HTMLElement
    expect(error.hidden).toBe(true)
    expect(error.getAttribute("aria-hidden")).toBe("true")

    const field = document.querySelector("ds-field") as DsField
    field.invalid = true

    await Promise.resolve()

    expect(error.hidden).toBe(false)
    expect(error.getAttribute("aria-hidden")).toBe("false")
  })

  it("applies required marker and optional marker on label", async () => {
    document.body.innerHTML = `
      <ds-field required-marker="text">
        <label id="label">Navn</label>
        <input class="ds-input" />
      </ds-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.getAttribute("data-required")).toBe("text")

    document.body.innerHTML = `
      <ds-field optional>
        <label id="label-2">Telefon</label>
        <input class="ds-input" />
      </ds-field>
    `

    await Promise.resolve()

    const label2 = document.getElementById("label-2") as HTMLLabelElement
    expect(label2.hasAttribute("data-optional")).toBe(true)
  })
})
