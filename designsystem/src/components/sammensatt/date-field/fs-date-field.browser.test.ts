import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { defineFsDateField } from "./fs-date-field"

describe("fs-date-field", () => {
  beforeAll(() => {
    defineFsDateField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("renders input and calendar together", async () => {
    document.body.innerHTML = `<fs-date-field label="Fødselsdato"></fs-date-field>`

    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const calendar = el.querySelector("fs-calendar") as HTMLElement

    expect(input).toBeTruthy()
    expect(calendar).toBeTruthy()
    expect(input.getAttribute("data-variant")).toBeNull()
    expect(input.type).toBe("text")
  })

  it("updates input value when date is selected from calendar popup", async () => {
    document.body.innerHTML = `<fs-date-field value="2026-05-31"></fs-date-field>`

    await Promise.resolve()
    await customElements.whenDefined("fs-calendar")
    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const calendar = el.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
    }

    const trigger = calendar.shadowRoot.querySelector(
      ".trigger",
    ) as HTMLButtonElement
    trigger.click()
    await Promise.resolve()

    const day = calendar.shadowRoot.querySelector(
      '.day[data-date="2026-05-15"]',
    ) as HTMLButtonElement
    day.click()
    await Promise.resolve()

    expect(input.value).toBe("15-05-2026")
  })

  it("applies invalid state and toggles error visibility", async () => {
    document.body.innerHTML = `<fs-date-field invalid error-text="Skriv en gyldig dato"></fs-date-field>`

    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const error = el.querySelector(".fs-error-text") as HTMLElement

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)

    el.removeAttribute("invalid")
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBeNull()
    expect(error.hidden).toBe(true)
  })

  it("shows error feedback when the user leaves an invalid typed date", async () => {
    document.body.innerHTML = `<fs-date-field error-text="Skriv en gyldig dato"></fs-date-field>`

    await Promise.resolve()

    const el = document.querySelector("fs-date-field") as HTMLElement
    const input = el.querySelector("input.fs-input") as HTMLInputElement
    const error = el.querySelector(".fs-error-text") as HTMLElement

    input.value = "32-06-2026"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new FocusEvent("blur"))
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)
  })
})
