import { afterEach, describe, expect, it, vi } from "vitest"
import { defineElement, whenUpgraded } from "./components/host-element"
import { defineLtToast, LtToast } from "./components/standalone/toast/lt-toast"
import * as pakke from "./index"
import { defineLt } from "./register"

/*
 * The tag names come from the main entry point, not from `register.ts`. Then
 * the test fails on a component added to the package without being included
 * in the registration, which is the mistake that would otherwise be silent.
 */
const tagger = Object.entries(pakke)
  .filter(([navn]) => navn.endsWith("_TAG"))
  .map(([, verdi]) => verdi as string)

describe("defineLt()", () => {
  it("copes with a component already registered under a custom name", () => {
    /*
     * A constructor can only be in the registry once. If the class was
     * already registered under another name, `customElements.define` threw
     * NotSupportedError, and the components after it in the list were never
     * registered.
     */
    defineLtToast("app-toast")

    expect(() => defineLt()).not.toThrow()

    for (const tag of tagger) {
      expect(customElements.get(tag), tag).toBeDefined()
    }
    expect(document.createElement("app-toast")).toBeInstanceOf(LtToast)
    expect(document.createElement("lt-toast")).toBeInstanceOf(LtToast)
  })

  it("registers every web component in the package", () => {
    expect(tagger.length).toBeGreaterThanOrEqual(9)

    defineLt()

    for (const tag of tagger) {
      expect(customElements.get(tag), tag).toBeDefined()
    }
  })

  it("copes with being called twice", () => {
    defineLt()
    expect(() => defineLt()).not.toThrow()
  })
})

describe("defineElement()", () => {
  it("registers the same class under two names", () => {
    class Egen extends HTMLElement {}
    defineElement("lt-egen-første", Egen)

    expect(() => defineElement("lt-egen-andre", Egen)).not.toThrow()

    expect(customElements.get("lt-egen-andre")).toBeDefined()
    expect(document.createElement("lt-egen-andre")).toBeInstanceOf(Egen)
  })

  it("works without customElements.getName", () => {
    // Chrome before 117, Firefox before 116 and Safari before 17 lack `getName`.
    class Egen extends HTMLElement {}
    defineElement("lt-egen-uten-getname", Egen)
    Object.defineProperty(customElements, "getName", {
      value: undefined,
      configurable: true,
    })

    try {
      expect(() => defineElement("lt-egen-uten-getname-to", Egen)).not.toThrow()
    } finally {
      Reflect.deleteProperty(customElements, "getName")
    }

    expect(document.createElement("lt-egen-uten-getname-to")).toBeInstanceOf(
      Egen,
    )
  })
})

describe("whenUpgraded()", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("warns once about an element nobody registers", async () => {
    vi.useFakeTimers()
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    const element = document.createElement("lt-aldri-registrert")

    void whenUpgraded(element)
    void whenUpgraded(element)
    vi.advanceTimersByTime(2999)
    expect(advarsel).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0]?.[0])).toContain(
      "<lt-aldri-registrert> is not registered",
    )
  })

  it("rejects an element that cannot be a component, without warning", async () => {
    vi.useFakeTimers()
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(whenUpgraded(document.createElement("div"))).rejects.toThrow()
    vi.advanceTimersByTime(3000)

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("stays quiet when the registration comes before the deadline", async () => {
    vi.useFakeTimers()
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    const element = document.createElement("lt-registrert-i-tide")

    const løfte = whenUpgraded(element)
    customElements.define("lt-registrert-i-tide", class extends HTMLElement {})
    await løfte
    vi.advanceTimersByTime(3000)

    expect(advarsel).not.toHaveBeenCalled()
  })
})
