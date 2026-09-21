/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { connectionStatus } from "./connection-status"
import {
  defineFsConnectionStatus,
  type FsConnectionStatus,
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
