/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { connectionStatus } from "./connection-status"
import {
  defineLtConnectionStatus,
  type LtConnectionStatus,
  reportFailure,
  reportSuccess,
} from "./lt-connection-status"

import "../../../tokens/tokens.css"
import "./connection-status.css"

function linje(): HTMLElement | null {
  return document.querySelector(".lt-connection-status__bar")
}

describe("lt-connection-status", () => {
  beforeAll(() => {
    defineLtConnectionStatus()
  })

  beforeEach(async () => {
    mount(
      `<lt-connection-status ${attr(connectionStatus())}></lt-connection-status>`,
    )
    await customElements.whenDefined("lt-connection-status")
    await waitForPaint()
  })

  it("asks the server to leave the content alone", () => {
    // The server cannot tell you it is unreachable, so the component creates
    // everything inside. Without this the next patch tears the bar away.
    const vert = document.querySelector("lt-connection-status") as HTMLElement
    expect(vert.hasAttribute("data-ignore-morph")).toBe(true)
  })

  it("shows nothing while everything works", () => {
    expect(linje()).toBeNull()
  })

  it("speaks up when the app reports a failed request", async () => {
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus

    // navigator.onLine only says the machine has a network, not that the
    // server answers. So the app reports it itself.
    status.reportFailure()
    await waitForPaint()

    const bar = linje() as HTMLElement
    expect(bar.dataset.state).toBe("offline")
    expect(bar.getAttribute("role")).toBe("status")
    expect(bar.textContent).toContain("No connection")
  })

  it("confirms when the connection is back", async () => {
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus

    status.reportFailure()
    await waitForPaint()
    status.reportSuccess()
    await waitForPaint()

    const bar = linje() as HTMLElement
    expect(bar.dataset.state).toBe("online")
    expect(bar.textContent).toContain("restored")
  })

  it("notifies the app both ways", async () => {
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus
    const meldinger: string[] = []
    for (const navn of ["connection-lost", "connection-restored"]) {
      status.addEventListener(navn, () => meldinger.push(navn))
    }

    status.reportFailure()
    status.reportSuccess()
    await waitForPaint()

    expect(meldinger).toEqual(["connection-lost", "connection-restored"])
    // The offline text is written in the next frame, and must not land on
    // top of the receipt when both came in the same frame.
    expect(linje()?.dataset.state).toBe("online")
    expect(linje()?.textContent).toContain("restored")
  })

  it("reacts to the network going away", async () => {
    window.dispatchEvent(new Event("offline"))
    await waitForPaint()

    expect(linje()?.dataset.state).toBe("offline")
  })

  it("lets a custom text override", async () => {
    mount(
      `<lt-connection-status ${attr(connectionStatus({ offlineText: "Sambandet er nede." }))}></lt-connection-status>`,
    )
    await waitForPaint()
    ;(
      document.querySelector("lt-connection-status") as LtConnectionStatus
    ).reportFailure()
    await waitForPaint()

    expect(linje()?.textContent).toBe("Sambandet er nede.")
  })

  it("has no accessibility violations when the bar is shown", async () => {
    ;(
      document.querySelector("lt-connection-status") as LtConnectionStatus
    ).reportFailure()
    await waitForPaint()

    await expectNoAccessibilityViolations()
  })
})

describe("lt-connection-status speaks up once and comes back", () => {
  beforeAll(() => {
    defineLtConnectionStatus()
  })

  async function monterLinje(attributter = attr(connectionStatus())) {
    mount(`<lt-connection-status ${attributter}></lt-connection-status>`)
    await customElements.whenDefined("lt-connection-status")
    await waitForPaint()
    return document.querySelector("lt-connection-status") as LtConnectionStatus
  }

  it("reports connection-lost once even when offline comes several times", async () => {
    // Browsers often fire several `offline` events in a row, and the app can
    // report a failure on top of a network that is already gone. Each one
    // gave a new event and a new announcement of the same bar.
    const status = await monterLinje()
    const hendelser: string[] = []
    status.addEventListener("connection-lost", () => hendelser.push("lost"))

    window.dispatchEvent(new Event("offline"))
    window.dispatchEvent(new Event("offline"))
    status.reportFailure()
    await waitForPaint()

    expect(hendelser).toEqual(["lost"])
    expect(linje()?.textContent).toContain("No connection")
  })

  it("removes the receipt after a while", async () => {
    const status = await monterLinje()
    status.reportFailure()
    await waitForPaint()

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      status.reportSuccess()
      expect(linje()?.dataset.state).toBe("online")
      await vi.advanceTimersByTimeAsync(4000)
      expect(linje()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("comes back online when the network does", async () => {
    await monterLinje()
    window.dispatchEvent(new Event("offline"))
    await waitForPaint()
    window.dispatchEvent(new Event("online"))
    await waitForPaint()

    expect(linje()?.dataset.state).toBe("online")
  })

  it("does not let the network override a failure the app reported", async () => {
    const status = await monterLinje()
    status.reportFailure()
    await waitForPaint()
    window.dispatchEvent(new Event("online"))
    await waitForPaint()

    expect(linje()?.dataset.state, "the network overrode the app").toBe(
      "offline",
    )

    status.reportSuccess()
    await waitForPaint()
    expect(linje()?.dataset.state).toBe("online")
  })

  it("lets online-text override, also as a property", async () => {
    const status = await monterLinje(
      attr(connectionStatus({ onlineText: "Tilbake." })),
    )
    status.reportFailure()
    await waitForPaint()
    status.reportSuccess()
    await waitForPaint()
    expect(linje()?.textContent).toBe("Tilbake.")

    status.offlineText = "Borte."
    status.onlineText = "Her igjen."
    expect(status.getAttribute("offline-text")).toBe("Borte.")
    expect(status.onlineText).toBe("Her igjen.")
  })
})

/*
 * A tag name registered late. `lt-connection-status` has already taken the
 * constructor, so `defineLtConnectionStatus("lt-connection-status-sen")`
 * registers a subclass of it.
 */
describe("reportFailure() and reportSuccess() wait for the registration", () => {
  it("makes the calls in order once the element is upgraded", async () => {
    mount(
      `<lt-connection-status-sen class="lt-connection-status"></lt-connection-status-sen>`,
    )
    const element = document.querySelector(
      "lt-connection-status-sen",
    ) as Element

    let ferdig = false
    const løfte = reportFailure(element).then(() => {
      ferdig = true
    })
    await waitForPaint()
    expect(ferdig).toBe(false)
    expect(linje()).toBeNull()

    defineLtConnectionStatus("lt-connection-status-sen")

    await løfte
    expect(linje()?.dataset.state).toBe("offline")

    await reportSuccess(element)
    expect(linje()?.dataset.state).toBe("online")
  })
})

describe("lt-connection-status out of the document and back in", () => {
  beforeAll(() => {
    defineLtConnectionStatus()
  })

  async function monterNy() {
    const flate = mount("<lt-connection-status></lt-connection-status>")
    await customElements.whenDefined("lt-connection-status")
    await waitForPaint()
    return {
      flate,
      status: document.querySelector(
        "lt-connection-status",
      ) as LtConnectionStatus,
    }
  }

  it("removes the receipt even if the element was out when the time ran out", async () => {
    const { flate, status } = await monterNy()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      window.dispatchEvent(new Event("offline"))
      window.dispatchEvent(new Event("online"))
      expect(linje()?.dataset.state).toBe("online")

      status.remove()
      await vi.advanceTimersByTimeAsync(5000)
      flate.append(status)
      await vi.advanceTimersByTimeAsync(4000)

      expect(linje()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not say offline when the network came back while the element was out", async () => {
    const { flate, status } = await monterNy()
    window.dispatchEvent(new Event("offline"))
    expect(linje()?.dataset.state).toBe("offline")

    status.remove()
    window.dispatchEvent(new Event("online"))
    flate.append(status)

    expect(navigator.onLine).toBe(true)
    expect(linje()?.dataset.state).toBe("online")
  })

  it("keeps the failure the app reported through a move", async () => {
    const { flate, status } = await monterNy()
    status.reportFailure()

    status.remove()
    flate.append(status)

    expect(linje()?.dataset.state).toBe("offline")
  })
})

describe("lt-connection-status when the text changes while the bar is showing", () => {
  beforeAll(() => {
    defineLtConnectionStatus()
  })

  it("shows the new text", async () => {
    mount("<lt-connection-status></lt-connection-status>")
    await customElements.whenDefined("lt-connection-status")
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus
    status.reportFailure()
    await waitForPaint()

    status.setAttribute("offline-text", "Ingen kontakt med serveren.")

    expect(linje()?.textContent).toBe("Ingen kontakt med serveren.")
  })
})
