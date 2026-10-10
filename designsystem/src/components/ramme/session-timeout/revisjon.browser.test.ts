/// <reference path="../../../types/css.d.ts" />
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { monter } from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsSessionTimeout } from "./fs-session-timeout"
import { sessionTimeout } from "./session-timeout"
import "../../../tokens/tokens.css"
import "./session-timeout.css"

function varsel(warnAt: number, expiresAt: number, extra = ""): string {
  const okt = sessionTimeout({ titleId: "t", warnAt, expiresAt })
  return `<div lang="nb"><fs-session-timeout ${attr(okt.host)}>
    <dialog ${attr(okt.dialog)}>
      <h2 ${attr(okt.title)}>Tittel</h2>
      <p ${attr(okt.text)}>Om <span ${attr(okt.count)}></span>.</p>
      <span ${attr(okt.live)}></span>
      <form ${attr(okt.actions)}><button ${attr(okt.extend)}>Bli</button><button ${attr(okt.logout)}>Ut</button></form>
    </dialog></fs-session-timeout>${extra}</div>`
}
const dlg = () => document.querySelector("dialog") as HTMLDialogElement
const live = () => dlg().querySelector("[role=status]")?.textContent ?? ""

describe("revisjon 4.1/4.2", () => {
  beforeAll(() => defineFsSessionTimeout())
  afterEach(() => vi.useRealTimers())

  it("4.1: rulling fra kode teller som aktivitet (funnet)", async () => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "Date",
        "setTimeout",
        "clearTimeout",
      ],
    })
    monter(
      varsel(
        3,
        13,
        `<div id="b" style="overflow:auto;height:20px"><div style="height:500px"></div></div>`,
      ),
    )
    await vi.advanceTimersByTimeAsync(2000)
    const b = document.getElementById("b") as HTMLElement
    b.scrollTop = 100 // ingen bruker
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    )
    await vi.advanceTimersByTimeAsync(2000)
    // Uten scroll-aktivitet hadde dialogen vært åpen etter 4 s
    console.log("4.1 dialog åpen etter programmatisk rulling:", dlg().open)
    expect(dlg().open).toBe(false)
  })

  it("4.1: ingen hendelse ved aktivitet (funnet)", async () => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "Date",
        "setTimeout",
        "clearTimeout",
      ],
    })
    monter(varsel(3, 13))
    const sett: string[] = []
    const vert = document.querySelector("fs-session-timeout") as HTMLElement
    for (const n of ["session-activity", "session-extend"])
      vert.addEventListener(n, () => sett.push(n))
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
    document.body.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(sett).toEqual(["session-activity"])
  })

  it("4.1: wheel teller (etter fiks)", async () => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "Date",
        "setTimeout",
        "clearTimeout",
      ],
    })
    monter(varsel(3, 13))
    await vi.advanceTimersByTimeAsync(2000)
    document.body.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))
    await vi.advanceTimersByTimeAsync(2000)
    expect(dlg().open).toBe(false)
  })

  it("4.2: et hoppet sekund (61 -> 59) gir ingen opplesning", async () => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "Date",
        "setTimeout",
        "clearTimeout",
      ],
    })
    monter(varsel(1, 70))
    // Kom til left = 61
    await vi.advanceTimersByTimeAsync(9000)
    console.log("4.2 før hopp:", JSON.stringify(live()), dlg().open)
    // Klokka hopper to sekunder mellom to tikk (struping, tung hovedtråd)
    vi.setSystemTime(Date.now() + 1000)
    await vi.advanceTimersByTimeAsync(1000)
    const tall = dlg().querySelector(".fs-session-timeout__count")?.textContent
    console.log("4.2 etter hopp: tall", tall, "opplest", JSON.stringify(live()))
    expect(tall).toBe("0:59")
    expect(live()).toContain("59 sekunder")
  })

  it("4.1-fiks: forkant-struping, siste aktivitet når aldri serveren", async () => {
    vi.useFakeTimers({
      toFake: [
        "setInterval",
        "clearInterval",
        "Date",
        "setTimeout",
        "clearTimeout",
      ],
    })
    monter(varsel(100, 130))
    const vert = document.querySelector("fs-session-timeout") as HTMLElement
    const tider: number[] = []
    const t0 = Date.now()
    vert.addEventListener("session-activity", () => tider.push(Date.now() - t0))
    for (let i = 0; i < 6; i++) {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true }),
      )
      await vi.advanceTimersByTimeAsync(10_000)
    }
    // Aktivitet ved 0,10,...,50 s. Serveren hører bare om 0 s.
    expect(tider).toEqual([0])
  })
})
