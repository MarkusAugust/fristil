import { afterEach, describe, expect, it, vi } from "vitest"

import { whenUpgraded } from "./components/host-element"
import * as pakke from "./index"
import { defineFs } from "./register"

/*
 * Tagnavnene hentes fra hovedinngangen, ikke fra `register.ts`. Da feller
 * testen en komponent som er lagt til i pakken uten å bli med i
 * registreringen, som er den feilen som ellers ville vært stille.
 */
const tagger = Object.entries(pakke)
  .filter(([navn]) => navn.endsWith("_TAG"))
  .map(([, verdi]) => verdi as string)

describe("defineFs()", () => {
  it("registrerer hver web component pakken har", () => {
    expect(tagger.length).toBeGreaterThanOrEqual(9)

    defineFs()

    for (const tag of tagger) {
      expect(customElements.get(tag), tag).toBeDefined()
    }
  })

  it("tåler å bli kalt to ganger", () => {
    defineFs()
    expect(() => defineFs()).not.toThrow()
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
    const element = document.createElement("fs-aldri-registrert")

    void whenUpgraded(element)
    void whenUpgraded(element)
    vi.advanceTimersByTime(2999)
    expect(advarsel).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0]?.[0])).toContain(
      "<fs-aldri-registrert> er ikke registrert",
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
    const element = document.createElement("fs-registrert-i-tide")

    const løfte = whenUpgraded(element)
    customElements.define("fs-registrert-i-tide", class extends HTMLElement {})
    await løfte
    vi.advanceTimersByTime(3000)

    expect(advarsel).not.toHaveBeenCalled()
  })
})
