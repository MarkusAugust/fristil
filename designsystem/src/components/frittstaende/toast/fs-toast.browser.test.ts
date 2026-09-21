/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsToast, type FsToast } from "./fs-toast"

import "../../../tokens/tokens.css"
import "./toast.css"

async function tegn() {
  const toast = document.querySelector("fs-toast") as FsToast
  await customElements.whenDefined("fs-toast")
  await ventPaTegning()
  return toast
}

describe("fs-toast", () => {
  beforeAll(() => {
    defineFsToast()
  })

  beforeEach(async () => {
    monter(`<fs-toast label="Meldinger"></fs-toast>`)
    await tegn()
  })

  it("er en høflig region, ikke en varsling som avbryter", async () => {
    const toast = await tegn()

    // En melding i hjørnet skal ikke avbryte det skjermleseren holder på med.
    expect(toast.getAttribute("role")).toBe("status")
    expect(toast.getAttribute("aria-live")).toBe("polite")
    expect(toast.getAttribute("aria-label")).toBe("Meldinger")
  })

  it("viser en melding med lukkeknapp", async () => {
    const toast = await tegn()
    const melding = toast.show("Søknaden er sendt", { color: "success" })

    expect(melding.textContent).toContain("Søknaden er sendt")
    expect(melding.dataset.color).toBe("success")

    const lukk = melding.querySelector(".fs-toast__close") as HTMLElement
    // Lukkeknappen er alltid der. En melding som bare forsvinner av seg selv
    // rekker ikke den som leser sakte.
    expect(lukk.getAttribute("aria-label")).toBe("Lukk melding")
  })

  it("fjerner meldingen når lukkeknappen trykkes", async () => {
    const toast = await tegn()
    const melding = toast.show("Vedlegget er lastet opp")
    const lukk = melding.querySelector(".fs-toast__close") as HTMLElement

    lukk.click()

    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(0)
  })

  it("lar en melding bli stående når levetiden er null", async () => {
    const toast = await tegn()
    toast.show("Blir stående", { duration: 0 })

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(1)
  })

  it("fjerner meldingen når levetiden er ute", async () => {
    const toast = await tegn()
    toast.show("Forsvinner", { duration: 40 })

    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(0)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    const toast = await tegn()
    toast.show("Søknaden er sendt", { color: "success", duration: 0 })

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})
