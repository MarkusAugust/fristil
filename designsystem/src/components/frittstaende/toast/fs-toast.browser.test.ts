/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineFsToast, type FsToast } from "./fs-toast"
import { toast as fsToast } from "./toast"

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

describe("fs-toast holder pausen og fokus", () => {
  beforeAll(() => {
    defineFsToast()
  })

  it("holder pausen til både musa og fokus har forlatt meldingen", async () => {
    // Pausen var to uavhengige par: musa som gikk ut startet klokka igjen
    // mens fokus sto i meldingen, og meldingen forsvant under brukeren.
    monter(`<fs-toast></fs-toast><button id="annet">Annet</button>`)
    const toast = await tegn()
    const melding = toast.show("Lagret", { duration: 40 })
    const lukk = melding.querySelector("button") as HTMLElement

    lukk.focus()
    melding.dispatchEvent(new MouseEvent("mouseenter"))
    melding.dispatchEvent(new MouseEvent("mouseleave"))
    await new Promise((r) => setTimeout(r, 120))
    expect(
      toast.querySelectorAll(".fs-toast"),
      "forsvant med fokus i",
    ).toHaveLength(1)
    ;(document.getElementById("annet") as HTMLElement).focus()
    await new Promise((r) => setTimeout(r, 120))
    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(0)
  })

  it("flytter fokus til neste melding når den som hadde fokus lukkes", async () => {
    monter(`<fs-toast></fs-toast>`)
    const toast = await tegn()
    const eldste = toast.show("Første", { duration: 0 })
    toast.show("Andre", { duration: 0 })
    const lukk = eldste.querySelector("button") as HTMLElement

    lukk.focus()
    lukk.click()

    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(1)
    expect(document.activeElement).toBe(toast.querySelector(".fs-toast__close"))
  })

  it("lar duration=0 på elementet bety at meldingene blir stående", async () => {
    monter(`<fs-toast duration="0"></fs-toast>`)
    const toast = await tegn()
    toast.show("Blir stående")
    await new Promise((r) => setTimeout(r, 50))
    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(1)
  })

  it("lar et tomt duration bety standardverdien", async () => {
    // `Number("")` er 0, og `<fs-toast duration>` lot meldingene stå.
    monter(`<fs-toast duration></fs-toast>`)
    const toast = await tegn()
    expect(toast.duration).toBe(6000)
  })

  it("er ikke atomisk, så bare den nye meldingen leses opp", async () => {
    monter(`<fs-toast></fs-toast>`)
    const toast = await tegn()
    expect(toast.getAttribute("aria-atomic")).toBe("false")
    expect(fsToast().host["aria-atomic"]).toBe("false")
  })

  it("heter Varsler både i byggefunksjonen og i komponenten", async () => {
    monter(`<fs-toast></fs-toast>`)
    const toast = await tegn()
    expect(toast.getAttribute("aria-label")).toBe("Varsler")
    expect(fsToast().host["aria-label"]).toBe("Varsler")
  })

  it("gir en ukjent farge ingen kant", async () => {
    monter(`<fs-toast></fs-toast>`)
    const toast = await tegn()
    const melding = toast.show("Rar", {
      color: "lilla" as unknown as "success",
      duration: 0,
    })
    expect(melding.hasAttribute("data-color")).toBe(false)
  })

  it("fjerner alle med clear()", async () => {
    monter(`<fs-toast></fs-toast>`)
    const toast = await tegn()
    toast.show("En", { duration: 0 })
    toast.show("To", { duration: 0 })
    toast.clear()
    expect(toast.querySelectorAll(".fs-toast")).toHaveLength(0)
  })
})
