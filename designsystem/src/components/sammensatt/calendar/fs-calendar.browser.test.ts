import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { defineFsCalendar } from "./fs-calendar"

describe("fs-calendar", () => {
  beforeAll(() => {
    defineFsCalendar()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("opens popup calendar from trigger button", async () => {
    document.body.innerHTML = `<fs-calendar value="2026-05-31"></fs-calendar>`

    await Promise.resolve()

    const el = document.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
    }
    const trigger = el.shadowRoot.querySelector(".trigger") as HTMLButtonElement
    const popup = el.shadowRoot.querySelector(".popup") as HTMLElement

    expect(popup.hidden).toBe(true)

    trigger.click()
    await Promise.resolve()

    expect(popup.hidden).toBe(false)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  })

  it("selects a day and emits date-select", async () => {
    document.body.innerHTML = `<fs-calendar value="2026-05-31"></fs-calendar>`

    await Promise.resolve()

    const el = document.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
      value: string
    }
    const trigger = el.shadowRoot.querySelector(".trigger") as HTMLButtonElement

    const selected: string[] = []
    el.addEventListener("date-select", (event) => {
      const custom = event as CustomEvent<{ value: string }>
      selected.push(custom.detail.value)
    })

    trigger.click()
    await Promise.resolve()

    const day = el.shadowRoot.querySelector(
      '.day[data-date="2026-05-15"]',
    ) as HTMLButtonElement
    day.click()
    await Promise.resolve()

    const popup = el.shadowRoot.querySelector(".popup") as HTMLElement
    expect(el.value).toBe("2026-05-15")
    expect(selected).toContain("2026-05-15")
    expect(popup.hidden).toBe(true)
  })

  it("supports keyboard escape to close popup", async () => {
    document.body.innerHTML = `<fs-calendar value="2026-05-31"></fs-calendar>`

    await Promise.resolve()

    const el = document.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
    }
    const trigger = el.shadowRoot.querySelector(".trigger") as HTMLButtonElement
    const popup = el.shadowRoot.querySelector(".popup") as HTMLElement

    trigger.click()
    await Promise.resolve()
    expect(popup.hidden).toBe(false)

    popup.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
    await Promise.resolve()

    expect(popup.hidden).toBe(true)
  })
})
