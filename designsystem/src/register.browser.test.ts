import { afterEach, describe, expect, it, vi } from "vitest"
import { defineElement, whenUpgraded } from "./components/host-element"
import { defineLtToast, LtToast } from "./components/standalone/toast/lt-toast"
import * as pakke from "./index"
import { defineLt } from "./register"

/*
 * Tagnavnene hentes fra hovedinngangen, ikke fra `register.ts`. Da feller
 * testen en komponent som er lagt til i pakken uten å bli med i
 * registreringen, som er den feilen som ellers ville vært stille.
 */
const tagger = Object.entries(pakke)
  .filter(([navn]) => navn.endsWith("_TAG"))
  .map(([, verdi]) => verdi as string)

describe("defineLt()", () => {
  it("tåler at en komponent alt er registrert under et eget navn", () => {
    /*
     * En konstruktør kan bare stå i registeret én gang. Var klassen alt
     * registrert under et annet navn, kastet `customElements.define`
     * NotSupportedError, og komponentene etter den i lista ble aldri
     * registrert.
     */
    defineLtToast("app-toast")

    expect(() => defineLt()).not.toThrow()

    for (const tag of tagger) {
      expect(customElements.get(tag), tag).toBeDefined()
    }
    expect(document.createElement("app-toast")).toBeInstanceOf(LtToast)
    expect(document.createElement("lt-toast")).toBeInstanceOf(LtToast)
  })

  it("registrerer hver web component pakken har", () => {
    expect(tagger.length).toBeGreaterThanOrEqual(9)

    defineLt()

    for (const tag of tagger) {
      expect(customElements.get(tag), tag).toBeDefined()
    }
  })

  it("tåler å bli kalt to ganger", () => {
    defineLt()
    expect(() => defineLt()).not.toThrow()
  })
})

describe("defineElement()", () => {
  it("registrerer samme klasse under to navn", () => {
    class Egen extends HTMLElement {}
    defineElement("lt-egen-første", Egen)

    expect(() => defineElement("lt-egen-andre", Egen)).not.toThrow()

    expect(customElements.get("lt-egen-andre")).toBeDefined()
    expect(document.createElement("lt-egen-andre")).toBeInstanceOf(Egen)
  })

  it("klarer seg uten customElements.getName", () => {
    // Chrome før 117, Firefox før 116 og Safari før 17 har ikke `getName`.
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

  it("sier fra én gang om et element ingen registrerer", async () => {
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
      "<lt-aldri-registrert> er ikke registrert",
    )
  })

  it("avviser et element som ikke kan være en komponent, uten å advare", async () => {
    vi.useFakeTimers()
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(whenUpgraded(document.createElement("div"))).rejects.toThrow()
    vi.advanceTimersByTime(3000)

    expect(advarsel).not.toHaveBeenCalled()
  })

  it("tier når registreringen kommer før fristen", async () => {
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
