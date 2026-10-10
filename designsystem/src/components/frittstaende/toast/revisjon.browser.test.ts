/// <reference path="../../../types/css.d.ts" />
import { beforeAll, describe, expect, it } from "vitest"
// defineFsToast kalles i første describe
import { userEvent } from "vitest/browser"
import { monter } from "../../../testing/a11y"
import { defineFsToast, type FsToast } from "./fs-toast"
import "../../../tokens/tokens.css"
import "./toast.css"

function kanFokuseres(el: HTMLElement): boolean {
  el.focus()
  return document.activeElement === el
}
function treffes(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return hit === el || el.contains(hit)
}
async function klikkbar(el: HTMLElement): Promise<boolean> {
  let klikket = false
  el.addEventListener("click", () => (klikket = true), { once: true })
  try {
    await userEvent.click(el, { timeout: 1500 })
  } catch {
    return false
  }
  return klikket
}

describe("revisjon 4.3", () => {
  beforeAll(() => defineFsToast())

  it("toast under åpen modal", async () => {
    monter(
      `<fs-toast duration="0"></fs-toast><dialog id="d"><p>Modal</p><button>Ok</button></dialog>`,
    )
    const d = document.getElementById("d") as HTMLDialogElement
    d.showModal()
    const toast = document.querySelector("fs-toast") as FsToast
    const m = toast.show("Lagret")
    const close = m.querySelector("button") as HTMLButtonElement
    const r = {
      modal: d.matches(":modal"),
      fokus: kanFokuseres(close),
      treff: treffes(close),
      klikk: await klikkbar(close),
    }
    console.error("4.3 toast under modal", JSON.stringify(r))
    expect(r).toEqual({ modal: true, fokus: false, treff: false, klikk: false })
    d.close()
  })

  it("popover=manual vist ETTER showModal (utenfor dialogen)", async () => {
    monter(
      `<div id="p" popover="manual" style="inset:auto 0 0 auto;margin:0"><button id="pb">Lukk</button></div><dialog id="d"><p>Modal</p><button>Ok</button></dialog>`,
    )
    const d = document.getElementById("d") as HTMLDialogElement
    const p = document.getElementById("p") as HTMLElement
    d.showModal()
    p.showPopover()
    const pb = document.getElementById("pb") as HTMLButtonElement
    const r = {
      popoverOpen: p.matches(":popover-open"),
      fokus: kanFokuseres(pb),
      treff: treffes(pb),
      klikk: await klikkbar(pb),
    }
    console.error("4.3 popover etter modal", JSON.stringify(r))
    expect(r).toEqual({
      popoverOpen: true,
      fokus: false,
      treff: false,
      klikk: false,
    })
    d.close()
  })

  it("fs-toast inne i dialogen virker", async () => {
    monter(
      `<dialog id="d"><p>Modal</p><fs-toast duration="0"></fs-toast></dialog>`,
    )
    const d = document.getElementById("d") as HTMLDialogElement
    d.showModal()
    const toast = d.querySelector("fs-toast") as FsToast
    const close = toast
      .show("Lagret")
      .querySelector("button") as HTMLButtonElement
    const r = { fokus: kanFokuseres(close), klikk: await klikkbar(close) }
    console.error("4.3 toast i dialog", JSON.stringify(r))
    expect(r).toEqual({ fokus: true, klikk: true })
    d.close()
  })
})

describe("revisjon 4.9/4.10", () => {
  it("4.9: clear() sender fokus tilbake dit det kom fra", async () => {
    monter(`<button id="ute">Lagre</button><fs-toast duration="0"></fs-toast>`)
    const toast = document.querySelector("fs-toast") as FsToast
    const ute = document.getElementById("ute") as HTMLButtonElement
    const m = toast.show("Lagret")
    ute.focus()
    ;(m.querySelector("button") as HTMLButtonElement).focus()
    toast.clear()
    expect(document.activeElement).toBe(ute)
  })

  it("4.9: dismiss() av siste melding sender fokus tilbake", async () => {
    monter(`<button id="ute">Lagre</button><fs-toast duration="0"></fs-toast>`)
    const toast = document.querySelector("fs-toast") as FsToast
    const ute = document.getElementById("ute") as HTMLButtonElement
    const m = toast.show("Lagret")
    ute.focus()
    const lukk = m.querySelector("button") as HTMLButtonElement
    lukk.focus()
    lukk.click()
    expect(document.activeElement).toBe(ute)
  })

  it("4.10: fjernet label gir standardnavn, ikke det gamle", async () => {
    monter(`<fs-toast label="Meldinger"></fs-toast>`)
    const toast = document.querySelector("fs-toast") as FsToast
    expect(toast.getAttribute("aria-label")).toBe("Meldinger")
    toast.removeAttribute("label")
    expect(toast.getAttribute("aria-label")).not.toBe("Meldinger")
    expect(toast.getAttribute("aria-label")).toBeTruthy()
  })

  it("4.10: aria-label fra forfatteren overlever label-endring?", async () => {
    monter(`<fs-toast aria-label="Forfatter"></fs-toast>`)
    const toast = document.querySelector("fs-toast") as FsToast
    toast.setAttribute("label", "X")
    toast.removeAttribute("label")
    expect(toast.getAttribute("aria-label")).toBe("Forfatter")
  })
})
