import { beforeAll, describe, expect, it } from "vitest"
import { monter, ventPaTegning } from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsTabs } from "./fs-tabs"
import { tabs } from "./tabs"
import "../../../tokens/tokens.css"
import "./tabs.css"

const F = tabs({ id: "s", count: 3, selected: 0, label: "Saken" })
const liste = () =>
  `${F.tabs.map((t, i) => `<button ${attr(t)}>Fane ${i}</button>`).join("")}`

describe("revisjon 4.8/4.11", () => {
  beforeAll(() => defineFsTabs())

  it("4.8: byttede faner holdes fast i mengden (lekkasje)", async () => {
    monter(
      `<fs-tabs><div ${attr(F.list)}>${liste()}</div>${F.panels
        .map((p, i) => `<div ${attr(p)}>P${i}</div>`)
        .join("")}</fs-tabs>`,
    )
    await customElements.whenDefined("fs-tabs")
    await ventPaTegning()
    const vert = document.querySelector("fs-tabs") as HTMLElement
    const list = vert.querySelector(".fs-tabs__list") as HTMLElement
    for (let i = 0; i < 10; i++) {
      list.innerHTML = liste() // slik en morfing som bytter nodene gjør
      await ventPaTegning()
    }
    const bound = (vert as unknown as { bound?: Set<Element> }).bound
    const losrevne = bound ? [...bound].filter((b) => !b.isConnected).length : 0
    // Etter fiksen finnes ingen mengde.
    expect(losrevne).toBe(0)
    // Klikk og piltast virker fortsatt etter byttene.
    ;(document.getElementById("s-tab-2") as HTMLElement).click()
    await ventPaTegning()
    expect(document.getElementById("s-panel-2")?.hidden).toBe(false)
    const t2 = document.getElementById("s-tab-2") as HTMLElement
    t2.focus()
    t2.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    await ventPaTegning()
    expect(document.activeElement?.id).toBe("s-tab-0")
  })

  it("4.11: pil ned i vannrett liste flytter ikke", async () => {
    monter(
      `<fs-tabs><div ${attr(F.list)}>${liste()}</div>${F.panels
        .map((p, i) => `<div ${attr(p)}>P${i}</div>`)
        .join("")}</fs-tabs>`,
    )
    await customElements.whenDefined("fs-tabs")
    await ventPaTegning()
    const t0 = document.getElementById("s-tab-0") as HTMLElement
    t0.focus()
    const e = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
    t0.dispatchEvent(e)
    await ventPaTegning()
    expect(document.activeElement?.id).toBe("s-tab-0")
    expect(e.defaultPrevented).toBe(false)
  })
})
