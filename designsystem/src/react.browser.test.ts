import { describe, expect, it } from "vitest"
import { fs } from "./fs"
import { fs as fsReact } from "./react"

describe("fs fra /react", () => {
  it("gir className i stedet for class", () => {
    expect(fsReact.button({ variant: "danger" })).toEqual({
      className: "fs-button",
      "data-variant": "danger",
    })
  })

  it("gir htmlFor i stedet for for på ledeteksten", () => {
    const felt = fsReact.field({ id: "epost" })

    expect(felt.label).toEqual({ className: "fs-label", htmlFor: "epost" })
  })

  it("lar dataattributter og aria stå urørt", () => {
    expect(fsReact.input({ type: "date", state: "invalid" })).toEqual({
      className: "fs-input",
      type: "date",
      "data-variant": "date",
      "data-state": "invalid",
      "aria-invalid": "true",
    })
  })

  it("beholder lovlige verdier og vaktene fra funksjonen", () => {
    expect(fsReact.button.variants).toEqual(fs.button.variants)
    expect(fsReact.button.isVariant("ghost")).toBe(true)
    expect(fsReact.badge.isColor("neutral")).toBe(true)
    expect(fsReact.input.isType("date")).toBe(true)
  })

  it("gir samme kobling som fs.field for alt som ikke må døpes om", () => {
    const vanlig = fs.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })
    const forReact = fsReact.field({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
    })

    expect(forReact.control).toEqual(vanlig.control)
    expect(forReact.help).toEqual(vanlig.help)
    expect(forReact.error).toEqual(vanlig.error)
    expect(forReact.state).toBe(vanlig.state)
  })

  it("har ingen nøkler React ville klaget på", () => {
    const alle = [
      fsReact.button(),
      fsReact.badge(),
      fsReact.link({ disabled: true }),
      fsReact.label({ required: "text" }),
      fsReact.input(),
      fsReact.textarea(),
      fsReact.select(),
      fsReact.helpText(),
      fsReact.errorText(),
      fsReact.field({ id: "x" }).label,
    ]

    for (const attributter of alle) {
      expect(Object.keys(attributter)).not.toContain("class")
      expect(Object.keys(attributter)).not.toContain("for")
    }
  })
})

/**
 * `tabindex` er ikke bare et annet navn.
 *
 * I HTML er verdien en streng, i React er `tabIndex` et tall. Lot vi
 * strengen stå, kom `fs.tabs()` ut med `tabIndex: "0"`, og TypeScript avviste
 * den i enhver React-app. Den virket i nettleseren, siden React gjør om
 * verdien selv, så feilen viste seg bare som en typefeil hos konsumenten.
 * Det ble funnet i en ekte React-app, ikke her.
 */
describe("tabIndex kommer ut som et tall", () => {
  it("på fanene", () => {
    const faner = fsReact.tabs({ id: "sak", count: 2 })

    expect(typeof faner.tabs[0]?.tabIndex).toBe("number")
    expect(faner.tabs[0]?.tabIndex).toBe(0)
    expect(faner.tabs[1]?.tabIndex).toBe(-1)
    expect(typeof faner.panels[0]?.tabIndex).toBe("number")
  })

  it("på feiloppsummeringen", () => {
    expect(typeof fsReact.errorSummary({ count: 1 }).container.tabIndex).toBe(
      "number",
    )
  })
})
