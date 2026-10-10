import { beforeAll, describe, expect, it } from "vitest"
import { monter, ventPaTegning } from "../../../testing/a11y"
import { defineFsErrorSummary } from "./fs-error-summary"

const LISTE = `<h2>Skjemaet har én feil</h2><ul class="fs-list"><li><a href="#e">Skriv e-post</a></li></ul>`

describe("revisjon 4.4/4.5/4.8", () => {
  beforeAll(() => defineFsErrorSummary())

  it("4.4: andre feilede innsending med synlig boks flytter ikke fokus", async () => {
    monter(
      `<fs-error-summary id="feil" hidden><h2></h2><ul class="fs-list"></ul></fs-error-summary><input id="e">`,
    )
    await ventPaTegning()
    const boks = document.getElementById("feil") as HTMLElement
    // Patch 1: feil
    boks.innerHTML = LISTE
    boks.hidden = false
    await ventPaTegning()
    expect(document.activeElement).toBe(boks)
    // Brukeren går til feltet og sender inn igjen, fortsatt feil.
    ;(document.getElementById("e") as HTMLElement).focus()
    boks.innerHTML = LISTE // serveren sender hele boksen på nytt (morfing beholder elementet)
    boks.hidden = false
    await ventPaTegning()
    expect(document.activeElement?.id).toBe("e") // funnet: oppskriften (:175) holder ikke
    // Oppskriften i planen: to patcher, hidden av og på.
    boks.hidden = true
    boks.hidden = false
    await ventPaTegning()
    expect(document.activeElement).toBe(boks)
  })

  it("4.5: likt innhold via innerHTML gir likevel mutasjoner i role=alert", async () => {
    monter(
      `<fs-error-summary id="feil">${LISTE}</fs-error-summary><input id="e">`,
    )
    await ventPaTegning()
    const ul = document.querySelector("ul") as HTMLElement
    const poster: MutationRecord[] = []
    const mo = new MutationObserver((r) => poster.push(...r))
    mo.observe(ul, { childList: true, subtree: true })
    const html = ul.innerHTML
    ul.innerHTML = html
    await ventPaTegning()
    mo.disconnect()
    expect(poster.length).toBeGreaterThan(0)
  })

  it("4.8: byttede lenker holdes fast i mengden", async () => {
    monter(
      `<fs-error-summary id="feil">${LISTE}</fs-error-summary><input id="e">`,
    )
    await ventPaTegning()
    const boks = document.getElementById("feil") as HTMLElement
    for (let i = 0; i < 5; i++) {
      boks.innerHTML = LISTE
      await ventPaTegning()
    }
    const links = (boks as unknown as { links?: Set<Element> }).links
    const losrevne = links ? [...links].filter((l) => !l.isConnected).length : 0
    console.error("4.8 error-summary løsrevne lenker:", losrevne)
    expect(losrevne).toBeGreaterThan(0)
  })
})
