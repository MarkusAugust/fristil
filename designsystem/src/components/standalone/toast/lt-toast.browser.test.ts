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

  it("is a polite region, not an alert that interrupts", async () => {
    const toast = await tegn()

    // A message in the corner should not interrupt what the screen reader is doing.
    expect(toast.getAttribute("role")).toBe("status")
    expect(toast.getAttribute("aria-live")).toBe("polite")
    expect(toast.getAttribute("aria-label")).toBe("Meldinger")
  })

  it("shows a message with a close button", async () => {
    const toast = await tegn()
    const melding = toast.show("Søknaden er sendt", { color: "success" })

    expect(melding.textContent).toContain("Søknaden er sendt")
    expect(melding.dataset.color).toBe("success")

    const lukk = melding.querySelector(".lt-toast__close") as HTMLElement
    // The close button is always there. A message that only disappears by
    // itself is gone before a slow reader gets to it.
    expect(lukk.getAttribute("aria-label")).toBe("Close message")
  })

  it("removes the message when the close button is pressed", async () => {
    const toast = await tegn()
    const melding = toast.show("Vedlegget er lastet opp")
    const lukk = melding.querySelector(".lt-toast__close") as HTMLElement

    lukk.click()

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })

  it("keeps a message when the duration is zero", async () => {
    const toast = await tegn()
    toast.show("Blir stående", { duration: 0 })

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(1)
  })

  it("removes the message when the duration has passed", async () => {
    const toast = await tegn()
    toast.show("Forsvinner", { duration: 40 })

    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })

  it("has no accessibility violations", async () => {
    const toast = await tegn()
    toast.show("Søknaden er sendt", { color: "success", duration: 0 })

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("lt-toast keeps the pause and focus", () => {
  beforeAll(() => {
    defineLtToast()
  })

  it("keeps the pause until both the mouse and focus have left the message", async () => {
    // The pause was two independent pairs: the mouse leaving restarted the
    // clock while focus was in the message, and the message disappeared from
    // under the user.
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
      "disappeared with focus in it",
    ).toHaveLength(1)
    ;(document.getElementById("annet") as HTMLElement).focus()
    await new Promise((r) => setTimeout(r, 120))
    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })

  it("moves focus to the neighbouring message when the one with focus is closed", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    const eldste = toast.show("Første", { duration: 0 })
    const midten = toast.show("Andre", { duration: 0 })
    toast.show("Tredje", { duration: 0 })
    const lukk = midten.querySelector("button") as HTMLElement

    lukk.focus()
    lukk.click()

    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(2)
    // The one below, that is the older one, not the newest at the top.
    expect(document.activeElement).toBe(eldste.querySelector("button"))
  })

  it("treats duration=0 on the element as keeping the messages", async () => {
    monter(`<lt-toast duration="0"></lt-toast>`)
    const toast = await tegn()
    toast.show("Blir stående")
    await new Promise((r) => setTimeout(r, 50))
    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(1)
  })

  it("treats an empty duration as the default", async () => {
    // `Number("")` is 0, and `<lt-toast duration>` kept the messages.
    monter(`<lt-toast duration></lt-toast>`)
    const toast = await tegn()
    expect(toast.duration).toBe(6000)
  })

  it("is not atomic, so only the new message is announced", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    expect(toast.getAttribute("aria-atomic")).toBe("false")
    expect(ltToast().host["aria-atomic"]).toBe("false")
  })

  it("is named Notifications in both the builder function and the component", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    expect(toast.getAttribute("aria-label")).toBe("Notifications")
    expect(ltToast().host["aria-label"]).toBe("Notifications")
  })

  it("gives an unknown colour no border", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    const melding = toast.show("Rar", {
      color: "lilla" as unknown as "success",
      duration: 0,
    })
    expect(melding.hasAttribute("data-color")).toBe(false)
  })

  it("removes all of them with clear()", async () => {
    monter(`<lt-toast></lt-toast>`)
    const toast = await tegn()
    toast.show("En", { duration: 0 })
    toast.show("To", { duration: 0 })
    toast.clear()
    expect(toast.querySelectorAll(".lt-toast__message")).toHaveLength(0)
  })
})

/*
 * A tag name registered late. `lt-toast` has already taken the constructor,
 * so `defineLtToast("lt-toast-sen")` registers a subclass of it.
 */
describe("showToast() waits for the registration", () => {
  it("shows the message only once the element is upgraded", async () => {
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

describe("lt-toast under another tag name", () => {
  it("is still fixed in the corner", async () => {
    /*
     * The position was on the element name, so a region registered as
     * anything other than `lt-toast` ended up in normal flow. It is now on
     * the class, which the component sets itself.
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

  it("gives the host the class from the builder function", () => {
    expect(ltToast().host.class).toBe("lt-toast")
    expect(ltToast().message.class).toBe("lt-toast__message")
  })
})

describe("lt-toast, focus and name", () => {
  beforeAll(() => {
    defineLtToast()
  })

  it("sends focus back where it came from when all messages are removed", () => {
    // Before, focus fell to `body`, and the next Tab started at the top of the page.
    monter(`<button id="ute">Lagre</button><lt-toast duration="0"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast
    const ute = document.getElementById("ute") as HTMLButtonElement
    const melding = region.show("Lagret")
    ute.focus()
    ;(melding.querySelector("button") as HTMLButtonElement).focus()

    region.clear()

    expect(document.activeElement).toBe(ute)
  })

  it("sends focus back when the last message is closed", () => {
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

  it("forgets where focus came from when it leaves the region", () => {
    // Before, focus later came back to an element the user left long ago,
    // and the page scrolled there.
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

  it("gives the region the default name when label is removed", () => {
    monter(`<lt-toast label="Meldinger"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast
    expect(region.getAttribute("aria-label")).toBe("Meldinger")

    region.removeAttribute("label")

    expect(region.getAttribute("aria-label")).toBe("Notifications")
  })

  it("leaves an aria-label the author set", () => {
    // Before, `label` overwrote it.
    monter(`<lt-toast aria-label="Forfatter"></lt-toast>`)
    const region = document.querySelector("lt-toast") as LtToast

    region.setAttribute("label", "Annet")
    expect(region.getAttribute("aria-label")).toBe("Forfatter")
    region.removeAttribute("label")
    expect(region.getAttribute("aria-label")).toBe("Forfatter")
  })
})

/*
 * The region in a shadow root, as in every preview in the documentation.
 * `document.activeElement` then points to the shadow host, not the close
 * button, and the component believed no message had focus: focus fell to
 * `body` instead of to the neighbouring message or where it came from.
 */
describe("lt-toast in a shadow root", () => {
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

  it("moves focus to the neighbouring message", () => {
    const { rot, region } = monterISkygge()
    const eldste = region.show("Første")
    const nyeste = region.show("Andre")
    const lukk = nyeste.querySelector("button") as HTMLButtonElement

    lukk.focus()
    lukk.click()

    expect(rot.activeElement).toBe(eldste.querySelector("button"))
  })

  it("sends focus back when the last message is closed", () => {
    const { region, ute } = monterISkygge()
    const melding = region.show("Lagret")
    const lukk = melding.querySelector("button") as HTMLButtonElement
    ute.focus()
    lukk.focus()

    lukk.click()

    expect(document.activeElement).toBe(ute)
  })

  it("sends focus back when all messages are removed", () => {
    const { region, ute } = monterISkygge()
    const melding = region.show("Lagret")
    ute.focus()
    ;(melding.querySelector("button") as HTMLButtonElement).focus()

    region.clear()

    expect(document.activeElement).toBe(ute)
  })
})
