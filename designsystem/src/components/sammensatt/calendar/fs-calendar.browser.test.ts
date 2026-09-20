import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsCalendar } from "./fs-calendar"
import "../../../tokens/tokens.css"

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

describe("fs-calendar tastatur og tilgjengelighet", () => {
  async function monterKalender() {
    const flate = monter(`<fs-calendar value="2026-05-31"></fs-calendar>`)
    await ventPaTegning()

    const kalender = flate.querySelector("fs-calendar") as HTMLElement & {
      shadowRoot: ShadowRoot
      open: boolean
    }
    const knapp = kalender.shadowRoot.querySelector(
      ".trigger",
    ) as HTMLButtonElement

    return { kalender, knapp }
  }

  it("flytter fokus tilbake til knappen når panelet lukkes med Escape", async () => {
    const { kalender, knapp } = await monterKalender()

    knapp.click()
    await ventPaTegning()

    const dag = kalender.shadowRoot.activeElement
    expect(dag, "en dag skal ha fokus når panelet åpnes").not.toBeNull()

    dag?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
      }),
    )
    await ventPaTegning()

    expect(kalender.open).toBe(false)
    expect(kalender.shadowRoot.activeElement).toBe(knapp)
  })

  it("flytter fokus tilbake til knappen når en dag velges", async () => {
    const { kalender, knapp } = await monterKalender()

    knapp.click()
    await ventPaTegning()

    const dag = kalender.shadowRoot.querySelector<HTMLButtonElement>(
      '.day[data-selected="true"]',
    )
    dag?.click()
    await ventPaTegning()

    expect(kalender.open).toBe(false)
    expect(kalender.shadowRoot.activeElement).toBe(knapp)
  })

  it("stjeler ikke fokus når panelet lukkes fordi brukeren klikket utenfor", async () => {
    const { kalender, knapp } = await monterKalender()
    const utenfor = document.createElement("button")
    utenfor.textContent = "Et annet sted"
    document.body.append(utenfor)

    knapp.click()
    await ventPaTegning()

    utenfor.focus()
    document.body.click()
    await ventPaTegning()

    expect(kalender.open).toBe(false)
    expect(document.activeElement).toBe(utenfor)

    utenfor.remove()
  })

  it("har ingen tilgjengelighetsbrudd med panelet åpent", async () => {
    const { knapp } = await monterKalender()

    knapp.click()
    await ventPaTegning()

    await forventIngenTilgjengelighetsbrudd()
  })
})
