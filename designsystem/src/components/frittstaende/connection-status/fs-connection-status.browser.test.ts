/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { connectionStatus } from "./connection-status"
import {
  defineFsConnectionStatus,
  FsConnectionStatus,
  reportFailure,
  reportSuccess,
} from "./fs-connection-status"

import "../../../tokens/tokens.css"
import "./connection-status.css"

function linje(): HTMLElement | null {
  return document.querySelector(".fs-connection-status__bar")
}

describe("fs-connection-status", () => {
  beforeAll(() => {
    defineFsConnectionStatus()
  })

  beforeEach(async () => {
    monter(
      `<fs-connection-status ${attr(connectionStatus())}></fs-connection-status>`,
    )
    await customElements.whenDefined("fs-connection-status")
    await ventPaTegning()
  })

  it("ber serveren la innholdet være i fred", () => {
    // Serveren kan ikke fortelle deg at den er utilgjengelig, så komponenten
    // eier alt inni. Uten dette river neste patch linja bort.
    const vert = document.querySelector("fs-connection-status") as HTMLElement
    expect(vert.hasAttribute("data-ignore-morph")).toBe(true)
  })

  it("viser ingenting så lenge alt virker", () => {
    expect(linje()).toBeNull()
  })

  it("sier fra når appen melder at et kall feilet", async () => {
    const status = document.querySelector(
      "fs-connection-status",
    ) as FsConnectionStatus

    // navigator.onLine sier bare at maskinen har et nettverk, ikke at
    // serveren svarer. Derfor melder appen selv fra.
    status.reportFailure()
    await ventPaTegning()

    const bar = linje() as HTMLElement
    expect(bar.dataset.state).toBe("offline")
    expect(bar.getAttribute("role")).toBe("status")
    expect(bar.textContent).toContain("Ingen forbindelse")
  })

  it("kvitterer når forbindelsen er tilbake", async () => {
    const status = document.querySelector(
      "fs-connection-status",
    ) as FsConnectionStatus

    status.reportFailure()
    await ventPaTegning()
    status.reportSuccess()
    await ventPaTegning()

    const bar = linje() as HTMLElement
    expect(bar.dataset.state).toBe("online")
    expect(bar.textContent).toContain("tilbake")
  })

  it("melder fra til appen begge veier", async () => {
    const status = document.querySelector(
      "fs-connection-status",
    ) as FsConnectionStatus
    const meldinger: string[] = []
    for (const navn of ["connection-lost", "connection-restored"]) {
      status.addEventListener(navn, () => meldinger.push(navn))
    }

    status.reportFailure()
    status.reportSuccess()
    await ventPaTegning()

    expect(meldinger).toEqual(["connection-lost", "connection-restored"])
    // Offline-teksten skrives i neste tegning, og skal ikke lande oppå
    // kvitteringen når begge kom i samme tegning.
    expect(linje()?.dataset.state).toBe("online")
    expect(linje()?.textContent).toContain("tilbake")
  })

  it("reagerer på at nettverket forsvinner", async () => {
    window.dispatchEvent(new Event("offline"))
    await ventPaTegning()

    expect(linje()?.dataset.state).toBe("offline")
  })

  it("lar egen tekst overstyre", async () => {
    monter(
      `<fs-connection-status ${attr(connectionStatus({ offlineText: "Sambandet er nede." }))}></fs-connection-status>`,
    )
    await ventPaTegning()
    ;(
      document.querySelector("fs-connection-status") as FsConnectionStatus
    ).reportFailure()
    await ventPaTegning()

    expect(linje()?.textContent).toBe("Sambandet er nede.")
  })

  it("har ingen tilgjengelighetsbrudd når linja vises", async () => {
    ;(
      document.querySelector("fs-connection-status") as FsConnectionStatus
    ).reportFailure()
    await ventPaTegning()

    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-connection-status sier fra én gang og kommer tilbake", () => {
  beforeAll(() => {
    defineFsConnectionStatus()
  })

  async function monterLinje(attributter = attr(connectionStatus())) {
    monter(`<fs-connection-status ${attributter}></fs-connection-status>`)
    await customElements.whenDefined("fs-connection-status")
    await ventPaTegning()
    return document.querySelector("fs-connection-status") as FsConnectionStatus
  }

  it("melder connection-lost én gang selv om offline kommer flere ganger", async () => {
    // Nettlesere fyrer gjerne flere `offline` på rad, og appen kan melde en
    // feil oppå et nettverk som alt er borte. Hver ga en ny hendelse og en
    // ny opplesning av den samme linja.
    const status = await monterLinje()
    const hendelser: string[] = []
    status.addEventListener("connection-lost", () => hendelser.push("lost"))

    window.dispatchEvent(new Event("offline"))
    window.dispatchEvent(new Event("offline"))
    status.reportFailure()
    await ventPaTegning()

    expect(hendelser).toEqual(["lost"])
    expect(linje()?.textContent).toContain("Ingen forbindelse")
  })

  it("fjerner kvitteringen etter en stund", async () => {
    const status = await monterLinje()
    status.reportFailure()
    await ventPaTegning()

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

  it("kommer tilbake på nett når nettverket gjør det", async () => {
    await monterLinje()
    window.dispatchEvent(new Event("offline"))
    await ventPaTegning()
    window.dispatchEvent(new Event("online"))
    await ventPaTegning()

    expect(linje()?.dataset.state).toBe("online")
  })

  it("lar ikke nettverket overstyre en feil appen har meldt", async () => {
    const status = await monterLinje()
    status.reportFailure()
    await ventPaTegning()
    window.dispatchEvent(new Event("online"))
    await ventPaTegning()

    expect(linje()?.dataset.state, "nettverket overstyrte appen").toBe(
      "offline",
    )

    status.reportSuccess()
    await ventPaTegning()
    expect(linje()?.dataset.state).toBe("online")
  })

  it("lar online-text overstyre, også som egenskap", async () => {
    const status = await monterLinje(
      attr(connectionStatus({ onlineText: "Tilbake." })),
    )
    status.reportFailure()
    await ventPaTegning()
    status.reportSuccess()
    await ventPaTegning()
    expect(linje()?.textContent).toBe("Tilbake.")

    status.offlineText = "Borte."
    status.onlineText = "Her igjen."
    expect(status.getAttribute("offline-text")).toBe("Borte.")
    expect(status.onlineText).toBe("Her igjen.")
  })
})

/*
 * Et sent registrert tagnavn, som en underklasse: konstruktøren til
 * `fs-connection-status` kan ikke registreres én gang til.
 */
describe("reportFailure() og reportSuccess() venter på registreringen", () => {
  it("gjør kallene i rekkefølge når elementet er oppgradert", async () => {
    monter(
      `<fs-connection-status-sen class="fs-connection-status"></fs-connection-status-sen>`,
    )
    const element = document.querySelector(
      "fs-connection-status-sen",
    ) as Element

    let ferdig = false
    const løfte = reportFailure(element).then(() => {
      ferdig = true
    })
    await ventPaTegning()
    expect(ferdig).toBe(false)
    expect(linje()).toBeNull()

    customElements.define(
      "fs-connection-status-sen",
      class extends FsConnectionStatus {},
    )

    await løfte
    expect(linje()?.dataset.state).toBe("offline")

    await reportSuccess(element)
    expect(linje()?.dataset.state).toBe("online")
  })
})

describe("fs-connection-status ute av dokumentet og inn igjen", () => {
  beforeAll(() => {
    defineFsConnectionStatus()
  })

  async function monterNy() {
    const flate = monter("<fs-connection-status></fs-connection-status>")
    await customElements.whenDefined("fs-connection-status")
    await ventPaTegning()
    return {
      flate,
      status: document.querySelector(
        "fs-connection-status",
      ) as FsConnectionStatus,
    }
  }

  it("fjerner kvitteringen selv om elementet var ute da tiden gikk", async () => {
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

  it("sier ikke offline når nettet kom tilbake mens elementet var ute", async () => {
    const { flate, status } = await monterNy()
    window.dispatchEvent(new Event("offline"))
    expect(linje()?.dataset.state).toBe("offline")

    status.remove()
    window.dispatchEvent(new Event("online"))
    flate.append(status)

    expect(navigator.onLine).toBe(true)
    expect(linje()?.dataset.state).toBe("online")
  })

  it("lar appens egen feilmelding stå gjennom en flytting", async () => {
    const { flate, status } = await monterNy()
    status.reportFailure()

    status.remove()
    flate.append(status)

    expect(linje()?.dataset.state).toBe("offline")
  })
})
