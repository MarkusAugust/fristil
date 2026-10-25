/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { defineLtToast, type LtToast, showToast } from "./lt-toast"
import { toast as ltToast } from "./toast"

import "../../../tokens/tokens.css"
import "./toast.css"

async function tegn() {
  const toast = document.querySelector("lt-toast") as LtToast
  await customElements.whenDefined("lt-toast")
  await ventPaTegning()
  return toast
}

describe("lt-toast", () => {
  beforeAll(() => {
    defineLtToast()
  })

  beforeEach(async () => {
    monter(`<lt-toast label="Meldinger"></lt-toast>`)
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

    const lukk = melding.querySelector(".lt-toast__close") as HTMLElement
    // Lukkeknappen er alltid der. En melding som bare forsvinner av seg selv
    // rekker ikke den som leser sakte.
    expect(lukk.getAttribute("aria-label")).toBe("Lukk melding")
  })

  it("fjerner meldingen når lukkeknappen trykkes", async () => {
    const toast = await tegn()
    const melding = toast.show("Vedlegget er lastet opp")
    const lukk = melding.querySelector(".lt-toast__close") as HTMLElement

    lukk.click()

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })

  it("lar en melding bli stående når levetiden er null", async () => {
    const toast = await tegn()
    toast.show("Blir stående", { duration: 0 })

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(1)
  })

  it("fjerner meldingen når levetiden er ute", async () => {
    const toast = await tegn()
    toast.show("Forsvinner", { duration: 40 })

    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    const toast = await tegn()
    toast.show("Søknaden er sendt", { color: "success", duration: 0 })

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("lt-toast holder pausen og fokus", () => {
  beforeAll(() => {
    defineLtToast()
  })

  it("holder pausen til både musa og fokus har forlatt meldingen", async () => {
    // Pausen var to uavhengige par: musa som gikk ut startet klokka igjen
    // mens fokus sto i meldingen, og meldingen forsvant under brukeren.
    monter(`<lt-toast></lt-toast><button id="annet">Annet</button>`)
    const toast = await tegn()
    const melding = toast.show("Lagret", { duration: 40 })
    const lukk = melding.querySelector("button") as HTMLElement

    lukk.focus()
    melding.dispatchEvent(new MouseEvent("mouseenter"))
    melding.dispatchEvent(new MouseEvent("mouseleave"))
    await new Promise((r) => setTimeout(r, 120))
    expect(
      toast.querySelectorAll(".lt-toast__message"),
      "forsvant med fokus i",
    ).toHaveLength(1)
    ;(document.getElementById("annet") as HTMLElement).focus()
    await new Promise((r) => setTimeout(r, 120))
    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })

  it("flytter fokus til meldingen ved siden av når den som hadde fokus lukkes", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    const eldste = toast.show("Første", { duration: 0 })
    const midten = toast.show("Andre", { duration: 0 })
    toast.show("Tredje", { duration: 0 })
    const lukk = midten.querySelector("button") as HTMLElement

    lukk.focus()
    lukk.click()

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(2)
    // Den under, altså den eldre, ikke den nyeste øverst.
    expect(document.activeElement).toBe(eldste.querySelector("button"))
  })

  it("lar duration=0 på elementet bety at meldingene blir stående", async () => {
    monter(`<lt-toast duration="0"></lt-toast>`)
    const toast = await tegn()
    toast.show("Blir stående")
    await new Promise((r) => setTimeout(r, 50))
    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(1)
  })

  it("lar et tomt duration bety standardverdien", async () => {
    // `Number("")` er 0, og `<lt-toast duration>` lot meldingene stå.
    monter(`<lt-toast duration></lt-toast>`)
    const toast = await tegn()
    expect(toast.duration).toBe(6000)
  })

  it("er ikke atomisk, så bare den nye meldingen leses opp", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    expect(toast.getAttribute("aria-atomic")).toBe("false")
    expect(ltToast().host["aria-atomic"]).toBe("false")
  })

  it("heter Varsler både i byggefunksjonen og i komponenten", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    expect(toast.getAttribute("aria-label")).toBe("Varsler")
    expect(ltToast().host["aria-label"]).toBe("Varsler")
  })

  it("gir en ukjent farge ingen kant", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    const melding = toast.show("Rar", {
      color: "lilla" as unknown as "success",
      duration: 0,
    })
    expect(melding.hasAttribute("data-color")).toBe(false)
  })

  it("fjerner alle med clear()", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    toast.show("En", { duration: 0 })
    toast.show("To", { duration: 0 })
    toast.clear()
    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })
})

/*
 * Et sent registrert tagnavn. `lt-toast` har alt tatt konstruktøren, så
 * `defineLtToast("lt-toast-sen")` registrerer en underklasse av den.
 */
describe("showToast() venter på registreringen", () => {
  it("viser meldingen først når elementet er oppgradert", async () => {
    monter(`<lt-toast-sen role="status" aria-live="polite"></lt-toast-sen>`)
    const element = document.querySelector("lt-toast-sen") as Element

    let ferdig = false
    const løfte = showToast(element, "Søknaden er lagret", {
      color: "success",
    }).then((melding) => {
      ferdig = true
      return melding
    })
    await ventPaTegning()
    expect(ferdig).toBe(false)
    expect(element.querySelector(".lt-toast__message")).toBeNull()

    defineLtToast("lt-toast-sen")

    const melding = await løfte
    expect(element.contains(melding)).toBe(true)
    expect(melding.getAttribute("data-color")).toBe("success")
    expect(melding.textContent).toContain("Søknaden er lagret")
  })
})

describe("lt-toast under et annet tagnavn", () => {
  it("ligger fortsatt fast i hjørnet", async () => {
    /*
     * Plasseringen sto på elementnavnet, så en region registrert som noe
     * annet enn `lt-toast` havnet i vanlig flyt. Den står nå på klassen, som
     * komponenten setter selv.
     */
    defineLtToast("annen-toast")
    monter("<annen-toast></annen-toast>")
    await customElements.whenDefined("annen-toast")
    const region = document.querySelector("annen-toast") as LtToast

    region.show("Lagret")

    expect(region.classList.contains("lt-toast")).toBe(true)
    expect(getComputedStyle(region).position).toBe("fixed")
    expect(region.querySelectorAll(".lt-toast__message")).toHaveLength(1)
  })

  it("gir verten klassen fra byggefunksjonen", () => {
    expect(ltToast().host.class).toBe("lt-toast")
    expect(ltToast().message.class).toBe("lt-toast__message")
  })
})

describe("lt-toast og fokus og navn", () => {
  beforeAll(() => {
    defineLtToast()
  })

  it("sender fokus tilbake dit det kom fra når alle meldingene fjernes", () => {
    // Før falt fokus til `body`, og neste Tab startet på toppen av siden.
    monter(`<button id="ute">Lagre</button><lt-toast duration="0"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast
    const ute = document.getElementById("ute") as HTMLButtonElement
    const melding = region.show("Lagret")
    ute.focus()
    ;(melding.querySelector("button") as HTMLButtonElement).focus()

    region.clear()

    expect(document.activeElement).toBe(ute)
  })

  it("sender fokus tilbake når den siste meldingen lukkes", () => {
    monter(`<button id="ute">Lagre</button><lt-toast duration="0"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast
    const ute = document.getElementById("ute") as HTMLButtonElement
    const melding = region.show("Lagret")
    ute.focus()
    const lukk = melding.querySelector("button") as HTMLButtonElement
    lukk.focus()

    lukk.click()

    expect(document.activeElement).toBe(ute)
  })

  it("glemmer hvor fokus kom fra når det går ut av regionen", () => {
    // Før kom fokus senere tilbake til et element brukeren forlot for lenge
    // siden, og siden rullet dit.
    monter(`
      <button id="a">A</button><button id="b">B</button>
      <lt-toast duration="0"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast
    const a = document.getElementById("a") as HTMLButtonElement
    const b = document.getElementById("b") as HTMLButtonElement
    const melding = region.show("Lagret")
    const lukk = melding.querySelector("button") as HTMLButtonElement
    a.focus()
    lukk.focus()
    b.focus()
    ;(document.activeElement as HTMLElement).blur()

    lukk.focus()
    lukk.click()

    expect(document.activeElement).not.toBe(a)
  })

  it("gir regionen standardnavnet når label fjernes", () => {
    monter(`<lt-toast label="Meldinger"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast
    expect(region.getAttribute("aria-label")).toBe("Meldinger")

    region.removeAttribute("label")

    expect(region.getAttribute("aria-label")).toBe("Varsler")
  })

  it("lar en aria-label forfatteren har satt stå", () => {
    // Før skrev `label` over den.
    monter(`<lt-toast aria-label="Forfatter"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast

    region.setAttribute("label", "Annet")
    expect(region.getAttribute("aria-label")).toBe("Forfatter")
    region.removeAttribute("label")
    expect(region.getAttribute("aria-label")).toBe("Forfatter")
  })
})

/*
 * Regionen i en skyggerot, som hver forhåndsvisning i dokumentasjonen.
 * `document.activeElement` peker da på skyggeverten, ikke på lukkeknappen,
 * og komponenten trodde ingen melding hadde fokus: fokus falt til `body`
 * i stedet for til nabomeldingen eller dit det kom fra.
 */
describe("lt-toast i en skyggerot", () => {
  beforeAll(() => {
    defineLtToast()
  })

  function monterISkygge() {
    monter(`<button id="ute">Lagre</button><div id="vert"></div>`)
    const vert = document.getElementById("vert") as HTMLElement
    const rot = vert.attachShadow({ mode: "open" })
    rot.innerHTML = `<lt-toast duration="0"></lt-toast>`
    const region = rot.querySelector("lt-toast") as LtToast
    const ute = document.getElementById("ute") as HTMLButtonElement
    return { rot, region, ute }
  }

  it("flytter fokus til meldingen ved siden av", () => {
    const { rot, region } = monterISkygge()
    const eldste = region.show("Første")
    const nyeste = region.show("Andre")
    const lukk = nyeste.querySelector("button") as HTMLButtonElement

    lukk.focus()
    lukk.click()

    expect(rot.activeElement).toBe(eldste.querySelector("button"))
  })

  it("sender fokus tilbake når den siste meldingen lukkes", () => {
    const { region, ute } = monterISkygge()
    const melding = region.show("Lagret")
    const lukk = melding.querySelector("button") as HTMLButtonElement
    ute.focus()
    lukk.focus()

    lukk.click()

    expect(document.activeElement).toBe(ute)
  })

  it("sender fokus tilbake når alle meldingene fjernes", () => {
    const { region, ute } = monterISkygge()
    const melding = region.show("Lagret")
    ute.focus()
    ;(melding.querySelector("button") as HTMLButtonElement).focus()

    region.clear()

    expect(document.activeElement).toBe(ute)
  })
})
