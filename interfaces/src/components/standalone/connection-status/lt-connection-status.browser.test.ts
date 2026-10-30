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

function findBar(): HTMLElement | null {
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
    const host = document.querySelector("lt-connection-status") as HTMLElement
    expect(host.hasAttribute("data-ignore-morph")).toBe(true)
  })

  it("shows nothing while everything works", () => {
    expect(findBar()).toBeNull()
  })

  it("speaks up when the app reports a failed request", async () => {
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus

    // navigator.onLine only says the machine has a network, not that the
    // server answers. So the app reports it itself.
    status.reportFailure()
    await waitForPaint()

    const bar = findBar() as HTMLElement
    expect(bar.dataset.state).toBe("offline")
    // The host is the live region, from the moment it is connected, so the
    // region exists before the bar; the bar is not a region of its own. That
    // the text is announced is checked through AT-SPI in
    // check-accessibility-tree.ts.
    expect(status.getAttribute("role")).toBe("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(bar.hasAttribute("role")).toBe(false)
    expect(bar.textContent).toContain("No connection")
  })

  it("is the live region before anything is reported, and keeps a role the server wrote", async () => {
    const fresh = document.createElement("lt-connection-status")
    document.body.append(fresh)
    expect(fresh.getAttribute("role")).toBe("status")
    expect(fresh.getAttribute("aria-live")).toBe("polite")
    expect(fresh.childElementCount).toBe(0)
    fresh.remove()

    const written = document.createElement("lt-connection-status")
    written.setAttribute("role", "alert")
    written.setAttribute("aria-live", "assertive")
    document.body.append(written)
    expect(written.getAttribute("role")).toBe("alert")
    expect(written.getAttribute("aria-live")).toBe("assertive")
    written.remove()
  })

  it("leaves the politeness of a role the server wrote alone", async () => {
    // role="alert" is assertive by itself; an aria-live="polite" next to it
    // would make "No connection" wait instead of interrupting.
    const alert = document.createElement("lt-connection-status")
    alert.setAttribute("role", "alert")
    document.body.append(alert)
    await waitForPaint()
    expect(alert.hasAttribute("aria-live")).toBe(false)
    alert.remove()
  })

  it("puts the region back when a morph takes it off", async () => {
    const fresh = document.createElement("lt-connection-status")
    document.body.append(fresh)
    // The way a morph that only knows the server's markup does it.
    fresh.removeAttribute("role")
    fresh.removeAttribute("aria-live")
    await waitForPaint()
    expect(fresh.getAttribute("role")).toBe("status")
    expect(fresh.getAttribute("aria-live")).toBe("polite")
    fresh.remove()
  })

  it("lt.connectionStatus() writes the region", () => {
    const built = connectionStatus()
    expect(built.role).toBe("status")
    expect(built["aria-live"]).toBe("polite")
  })

  it("confirms when the connection is back", async () => {
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus

    status.reportFailure()
    await waitForPaint()
    status.reportSuccess()
    await waitForPaint()

    const bar = findBar() as HTMLElement
    expect(bar.dataset.state).toBe("online")
    expect(bar.textContent).toContain("restored")
  })

  it("notifies the app both ways", async () => {
    const status = document.querySelector(
      "lt-connection-status",
    ) as LtConnectionStatus
    const messages: string[] = []
    for (const name of ["connection-lost", "connection-restored"]) {
      status.addEventListener(name, () => messages.push(name))
    }

    status.reportFailure()
    status.reportSuccess()
    await waitForPaint()

    expect(messages).toEqual(["connection-lost", "connection-restored"])
    // The offline text is written in the next frame, and must not land on
    // top of the receipt when both came in the same frame.
    expect(findBar()?.dataset.state).toBe("online")
    expect(findBar()?.textContent).toContain("restored")
  })

  it("reacts to the network going away", async () => {
    window.dispatchEvent(new Event("offline"))
    await waitForPaint()

    expect(findBar()?.dataset.state).toBe("offline")
  })

  it("lets a custom text override", async () => {
    mount(
      `<lt-connection-status ${attr(connectionStatus({ offlineText: "The line is down." }))}></lt-connection-status>`,
    )
    await waitForPaint()
    ;(
      document.querySelector("lt-connection-status") as LtConnectionStatus
    ).reportFailure()
    await waitForPaint()

    expect(findBar()?.textContent).toBe("The line is down.")
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

  async function mountBar(attributes = attr(connectionStatus())) {
    mount(`<lt-connection-status ${attributes}></lt-connection-status>`)
    await customElements.whenDefined("lt-connection-status")
    await waitForPaint()
    return document.querySelector("lt-connection-status") as LtConnectionStatus
  }

  it("reports connection-lost once even when offline comes several times", async () => {
    // Browsers often fire several `offline` events in a row, and the app can
    // report a failure on top of a network that is already gone. Each one
    // gave a new event and a new announcement of the same bar.
    const status = await mountBar()
    const events: string[] = []
    status.addEventListener("connection-lost", () => events.push("lost"))

    window.dispatchEvent(new Event("offline"))
    window.dispatchEvent(new Event("offline"))
    status.reportFailure()
    await waitForPaint()

    expect(events).toEqual(["lost"])
    expect(findBar()?.textContent).toContain("No connection")
  })

  it("removes the receipt after a while", async () => {
    const status = await mountBar()
    status.reportFailure()
    await waitForPaint()

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      status.reportSuccess()
      expect(findBar()?.dataset.state).toBe("online")
      await vi.advanceTimersByTimeAsync(4000)
      expect(findBar()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("comes back online when the network does", async () => {
    await mountBar()
    window.dispatchEvent(new Event("offline"))
    await waitForPaint()
    window.dispatchEvent(new Event("online"))
    await waitForPaint()

    expect(findBar()?.dataset.state).toBe("online")
  })

  it("does not let the network override a failure the app reported", async () => {
    const status = await mountBar()
    status.reportFailure()
    await waitForPaint()
    window.dispatchEvent(new Event("online"))
    await waitForPaint()

    expect(findBar()?.dataset.state, "the network overrode the app").toBe(
      "offline",
    )

    status.reportSuccess()
    await waitForPaint()
    expect(findBar()?.dataset.state).toBe("online")
  })

  it("lets online-text override, also as a property", async () => {
    const status = await mountBar(
      attr(connectionStatus({ onlineText: "Back." })),
    )
    status.reportFailure()
    await waitForPaint()
    status.reportSuccess()
    await waitForPaint()
    expect(findBar()?.textContent).toBe("Back.")

    status.offlineText = "Gone."
    status.onlineText = "Here again."
    expect(status.getAttribute("offline-text")).toBe("Gone.")
    expect(status.onlineText).toBe("Here again.")
  })
})

/*
 * A tag name registered late. `lt-connection-status` has already taken the
 * constructor, so `defineLtConnectionStatus("lt-connection-status-late")`
 * registers a subclass of it.
 */
describe("reportFailure() and reportSuccess() wait for the registration", () => {
  it("makes the calls in order once the element is upgraded", async () => {
    mount(
      `<lt-connection-status-late class="lt-connection-status"></lt-connection-status-late>`,
    )
    const element = document.querySelector(
      "lt-connection-status-late",
    ) as Element

    let done = false
    const promise = reportFailure(element).then(() => {
      done = true
    })
    await waitForPaint()
    expect(done).toBe(false)
    expect(findBar()).toBeNull()

    defineLtConnectionStatus("lt-connection-status-late")

    await promise
    expect(findBar()?.dataset.state).toBe("offline")

    await reportSuccess(element)
    expect(findBar()?.dataset.state).toBe("online")
  })
})

describe("lt-connection-status out of the document and back in", () => {
  beforeAll(() => {
    defineLtConnectionStatus()
  })

  async function mountFresh() {
    const surface = mount("<lt-connection-status></lt-connection-status>")
    await customElements.whenDefined("lt-connection-status")
    await waitForPaint()
    return {
      surface,
      status: document.querySelector(
        "lt-connection-status",
      ) as LtConnectionStatus,
    }
  }

  it("removes the receipt even if the element was out when the time ran out", async () => {
    const { surface, status } = await mountFresh()
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    try {
      window.dispatchEvent(new Event("offline"))
      window.dispatchEvent(new Event("online"))
      expect(findBar()?.dataset.state).toBe("online")

      status.remove()
      await vi.advanceTimersByTimeAsync(5000)
      surface.append(status)
      await vi.advanceTimersByTimeAsync(4000)

      expect(findBar()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not say offline when the network came back while the element was out", async () => {
    const { surface, status } = await mountFresh()
    window.dispatchEvent(new Event("offline"))
    expect(findBar()?.dataset.state).toBe("offline")

    status.remove()
    window.dispatchEvent(new Event("online"))
    surface.append(status)

    expect(navigator.onLine).toBe(true)
    expect(findBar()?.dataset.state).toBe("online")
  })

  it("keeps the failure the app reported through a move", async () => {
    const { surface, status } = await mountFresh()
    status.reportFailure()

    status.remove()
    surface.append(status)

    expect(findBar()?.dataset.state).toBe("offline")
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

    status.setAttribute("offline-text", "No contact with the server.")

    expect(findBar()?.textContent).toBe("No contact with the server.")
  })
})
