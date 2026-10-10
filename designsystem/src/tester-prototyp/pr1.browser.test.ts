/// <reference path="../types/css.d.ts" />
// Testerens reproduksjoner for PR 1 i fikseplanen. Ikke en del av repoet.
import { beforeAll, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { dialog } from "../components/ramme/dialog/dialog"
import { defineFsDialog } from "../components/ramme/dialog/fs-dialog"
import { defineFsPopover } from "../components/ramme/popover/fs-popover"
import { popover } from "../components/ramme/popover/popover"
import { monter, ventPaTegning } from "../testing/a11y"
import { attr } from "../testing/markup"
import "../tokens/tokens.css"
import "../components/ramme/dialog/dialog.css"
import "../components/ramme/popover/popover.css"

type Toggle = { open: boolean; returnValue: string }

async function monterDialog(ekstraVert = "") {
  const boks = dialog({ titleId: "t", open: false })
  monter(`
    <div id="a"><fs-dialog ${ekstraVert} ${attr(boks.host)}>
      <dialog ${attr(boks.dialog)}>
        <h2 ${attr(boks.title)}>Slette?</h2>
        <form method="dialog" ${attr(boks.footer)}>
          <button id="slett" value="slett">Slett</button>
        </form>
      </dialog>
    </fs-dialog></div><div id="b"></div>`)
  await customElements.whenDefined("fs-dialog")
  await ventPaTegning()
  const vert = document.querySelector("fs-dialog") as HTMLElement
  const d = document.querySelector("dialog") as HTMLDialogElement
  const meldinger: Toggle[] = []
  vert.addEventListener("dialog-toggle", (e) =>
    meldinger.push((e as CustomEvent<Toggle>).detail),
  )
  return { vert, d, meldinger }
}

describe("1.1 returnValue", () => {
  beforeAll(() => defineFsDialog())

  it("Escape etter en tidligere «slett» melder tom verdi", async () => {
    const { vert, d, meldinger } = await monterDialog()
    vert.setAttribute("open", "")
    await ventPaTegning()
    ;(document.getElementById("slett") as HTMLButtonElement).click()
    await ventPaTegning()
    expect(d.open).toBe(false)
    vert.setAttribute("open", "")
    await ventPaTegning()
    expect(d.matches(":modal")).toBe(true)
    // Funn: Chromium 141 nullstiller selv returnValue ved Escape.
    await userEvent.keyboard("{Escape}")
    await ventPaTegning()
    expect(d.open).toBe(false)
    expect(meldinger[meldinger.length - 1]).toEqual({
      open: false,
      returnValue: "",
    })
  })

  it("lukking fra serveren etter en tidligere «slett» melder tom verdi", async () => {
    const { vert, d, meldinger } = await monterDialog()
    vert.setAttribute("open", "")
    await ventPaTegning()
    ;(document.getElementById("slett") as HTMLButtonElement).click()
    await ventPaTegning()
    vert.setAttribute("open", "")
    await ventPaTegning()
    vert.removeAttribute("open")
    await ventPaTegning()
    expect(d.open).toBe(false)
    expect(meldinger[meldinger.length - 1]).toEqual({
      open: false,
      returnValue: "",
    })
  })

  it("dialogen flyttes i DOM etter en lukking og åpnes fortsatt av serveren", async () => {
    const { vert, d } = await monterDialog()
    vert.setAttribute("open", "")
    await ventPaTegning()
    ;(document.getElementById("slett") as HTMLButtonElement).click()
    await ventPaTegning()
    // Serverens patch: verten flyttes og får open igjen.
    vert.remove()
    vert.setAttribute("open", "")
    document.getElementById("b")?.append(vert)
    await ventPaTegning()
    expect(d.matches(":modal"), "serveren fikk ikke åpnet").toBe(true)
  })
})

describe("1.5 fjerning av åpen dialog", () => {
  beforeAll(() => defineFsDialog())

  it("fjerning sender open:false (på elementet)", async () => {
    const { vert, d, meldinger } = await monterDialog()
    vert.setAttribute("open", "")
    await ventPaTegning()
    expect(d.matches(":modal")).toBe(true)
    meldinger.length = 0
    vert.remove()
    await ventPaTegning()
    expect(meldinger.map((m) => m.open)).toEqual([false])
  })

  it("flytting av åpen dialog i samme oppgave sender ingen hendelser", async () => {
    const { vert, d, meldinger } = await monterDialog()
    vert.setAttribute("open", "")
    await ventPaTegning()
    meldinger.length = 0
    document.getElementById("b")?.append(vert)
    await ventPaTegning()
    expect(d.matches(":modal")).toBe(true)
    expect(meldinger.map((m) => m.open)).toEqual([])
  })
})

describe("1.2 og 1.3 popover", () => {
  beforeAll(() => defineFsPopover())
  const BOKS = popover({ id: "panel" })

  async function monterPopover(innhold = "") {
    monter(`
      <form id="skjema">
        <fs-popover ${attr(BOKS.host)}>
          <button id="knapp" ${attr(BOKS.trigger)}>Hjelp</button>
          <div ${attr(BOKS.panel)}><p>Tekst</p><input id="inni"></div>
        </fs-popover>
        <input id="utenfor">
      </form>${innhold}`)
    await customElements.whenDefined("fs-popover")
    await ventPaTegning()
    return document.querySelector("fs-popover") as HTMLElement & {
      open: boolean
    }
  }

  it("1.2 utløseren sender ikke inn skjemaet", async () => {
    await monterPopover()
    let sendt = 0
    document.getElementById("skjema")?.addEventListener("submit", (e) => {
      sendt++
      e.preventDefault()
    })
    ;(document.getElementById("knapp") as HTMLButtonElement).click()
    await ventPaTegning()
    expect(sendt).toBe(0)
  })

  it("1.2 heller ikke etter at en morfing fjernet type", async () => {
    await monterPopover()
    let sendt = 0
    document.getElementById("skjema")?.addEventListener("submit", (e) => {
      sendt++
      e.preventDefault()
    })
    document.getElementById("knapp")?.removeAttribute("type")
    await ventPaTegning()
    ;(document.getElementById("knapp") as HTMLButtonElement).click()
    await ventPaTegning()
    expect(sendt).toBe(0)
  })

  it("1.3 Escape i et felt utenfor panelet lukker ikke og flytter ikke fokus", async () => {
    const vert = await monterPopover()
    vert.open = true
    await ventPaTegning()
    const utenfor = document.getElementById("utenfor") as HTMLInputElement
    utenfor.focus()
    await userEvent.keyboard("{Escape}")
    await ventPaTegning()
    expect(vert.open).toBe(true)
    expect(document.activeElement).toBe(utenfor)
  })

  it("1.3 Escape i en modal dialog over lukker den ikke og flytter ikke fokus", async () => {
    const vert = await monterPopover(
      `<dialog id="over"><button id="iDialog">Ok</button></dialog>`,
    )
    vert.open = true
    await ventPaTegning()
    const over = document.getElementById("over") as HTMLDialogElement
    over.showModal()
    const iDialog = document.getElementById("iDialog") as HTMLButtonElement
    iDialog.focus()
    await userEvent.keyboard("{Escape}")
    await ventPaTegning()
    expect(vert.open, "popoveren lukket").toBe(true)
    expect(over.open, "dialogen ble ikke lukket av Escape").toBe(false)
  })

  it("1.3 Escape i panelet lukker og gir fokus til knappen (eksisterende)", async () => {
    const vert = await monterPopover()
    vert.open = true
    await ventPaTegning()
    ;(document.getElementById("inni") as HTMLInputElement).focus()
    await userEvent.keyboard("{Escape}")
    await ventPaTegning()
    expect(vert.open).toBe(false)
    expect(document.activeElement?.id).toBe("knapp")
  })
})

describe("1.4 dialog data-color=neutral", () => {
  it("neutral gir samme luft som uten data-color", async () => {
    monter(`
      <dialog class="fs-dialog" id="u" aria-labelledby="h1"><div class="fs-dialog__header"><h2 id="h1" class="fs-dialog__title">A</h2></div><div class="fs-dialog__body">x</div></dialog>
      <dialog class="fs-dialog" data-color="neutral" id="n" aria-labelledby="h2"><div class="fs-dialog__header"><h2 id="h2" class="fs-dialog__title">A</h2></div><div class="fs-dialog__body">x</div></dialog>`)
    ;(document.getElementById("u") as HTMLDialogElement).show()
    ;(document.getElementById("n") as HTMLDialogElement).show()
    const p = (id: string, sel: string) =>
      getComputedStyle(
        document.querySelector(`#${id} ${sel}`) as Element,
      ).getPropertyValue("padding-block-end")
    const q = (id: string, sel: string) =>
      getComputedStyle(
        document.querySelector(`#${id} ${sel}`) as Element,
      ).getPropertyValue("padding-block-start")
    expect(p("n", ".fs-dialog__header")).toBe(p("u", ".fs-dialog__header"))
    expect(q("n", ".fs-dialog__body")).toBe(q("u", ".fs-dialog__body"))
  })
})
