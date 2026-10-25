import { afterEach, describe, expect, it, vi } from "vitest"
import { defineElement, whenUpgraded } from "./components/host-element"
import { defineLtToast, LtToast } from "./components/standalone/toast/lt-toast"
import * as pkg from "./index"
import { defineLt } from "./register"

/*
 * The tag names come from the main entry point, not from `register.ts`. Then
 * the test fails on a component added to the package without being included
 * in the registration, which is the mistake that would otherwise be silent.
 */
const tags = Object.entries(pkg)
  .filter(([name]) => name.endsWith("_TAG"))
  .map(([, value]) => value as string)

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

    for (const tag of tags) {
      expect(customElements.get(tag), tag).toBeDefined()
    }
    expect(document.createElement("app-toast")).toBeInstanceOf(LtToast)
    expect(document.createElement("lt-toast")).toBeInstanceOf(LtToast)
  })

  it("registers every web component in the package", () => {
    expect(tags.length).toBeGreaterThanOrEqual(9)

    defineLt()

    for (const tag of tags) {
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
    class Custom extends HTMLElement {}
    defineElement("lt-custom-first", Custom)

    expect(() => defineElement("lt-custom-second", Custom)).not.toThrow()

    expect(customElements.get("lt-custom-second")).toBeDefined()
    expect(document.createElement("lt-custom-second")).toBeInstanceOf(Custom)
  })

  it("works without customElements.getName", () => {
    // Chrome before 117, Firefox before 116 and Safari before 17 lack `getName`.
    class Custom extends HTMLElement {}
    defineElement("lt-custom-without-getname", Custom)
    Object.defineProperty(customElements, "getName", {
      value: undefined,
      configurable: true,
    })

    try {
      expect(() =>
        defineElement("lt-custom-without-getname-two", Custom),
      ).not.toThrow()
    } finally {
      Reflect.deleteProperty(customElements, "getName")
    }

    expect(
      document.createElement("lt-custom-without-getname-two"),
    ).toBeInstanceOf(Custom)
  })
})

describe("whenUpgraded()", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("warns once about an element nobody registers", async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    const element = document.createElement("lt-never-registered")

    void whenUpgraded(element)
    void whenUpgraded(element)
    vi.advanceTimersByTime(2999)
    expect(warning).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(warning).toHaveBeenCalledTimes(1)
    expect(String(warning.mock.calls[0]?.[0])).toContain(
      "<lt-never-registered> is not registered",
    )
  })

  it("rejects an element that cannot be a component, without warning", async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(whenUpgraded(document.createElement("div"))).rejects.toThrow()
    vi.advanceTimersByTime(3000)

    expect(warning).not.toHaveBeenCalled()
  })

  it("stays quiet when the registration comes before the deadline", async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    const element = document.createElement("lt-registered-in-time")

    const promise = whenUpgraded(element)
    customElements.define("lt-registered-in-time", class extends HTMLElement {})
    await promise
    vi.advanceTimersByTime(3000)

    expect(warning).not.toHaveBeenCalled()
  })
})
