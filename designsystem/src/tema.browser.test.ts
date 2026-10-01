/// <reference path="./types/css.d.ts" />
/// Uten denne er Vitests `CDPSession` et tomt grensesnitt. Det er leverandøren
/// som fyller det, og her er det Playwright som gir oss `send`.
/// <reference types="@vitest/browser-playwright" />

import { afterEach, describe, expect, it } from "vitest"
import { cdp, server } from "vitest/browser"
import { ventPaTegning } from "./testing/a11y"
import tokenKilde from "./tokens/tokens.css?inline"

import "./tokens/tokens.css"

/**
 * At `data-theme` er en temagrense, og at Fristil ikke rører verten.
 *
 * Begge deler kom fra en komponent som legges inn i en vertsside den ikke
 * eier. Den setter `data-theme="light"` på sitt eget rotelement og forventer
 * lyse farger uansett hva maskinen står på.
 *
 * To ting sviktet. `[data-theme="light"]` deklarerte bare `color-scheme`,
 * mens `[data-theme="dark"]` deklarerte alle 90 tokenene, så lyst tema virket
 * bare på `<html>`: et barn kan ikke overstyre en variabel det arver uten å
 * deklarere den på nytt. Og `color-scheme: light dark` sto på `:root`, så
 * hele vertssiden fikk mørke rullefelt og skjemakontroller i mørk modus.
 *
 * Fila er delt i to. Det som bare handler om attributtene kjører i alle tre
 * motorene, siden det er der reglene bor. Det som må vite hva maskinen står
 * på, må emulere `prefers-color-scheme`, og det går over CDP, som bare
 * Chromium har herfra.
 */

const LYS = "#0d4e8c"
const MORK = "#99c8ff"
const TOKEN = "--fs-color-accent-text"

/** Verdien et element faktisk ser, arv medregnet. */
function token(el: Element): string {
  return getComputedStyle(el).getPropertyValue(TOKEN).trim()
}

function hent(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`fant ikke #${id}`)
  return el
}

function rydd() {
  document.documentElement.removeAttribute("data-theme")
  document.body.innerHTML = ""
}

describe("data-theme er en temagrense i alle motorer", () => {
  afterEach(rydd)

  it("gir lyse tokens i en div, uansett hva maskinen står på", () => {
    document.body.innerHTML = `<div data-theme="light"><p id="i">i</p></div>`
    expect(token(hent("i"))).toBe(LYS)
  })

  it("gir mørke tokens i en div, uansett hva maskinen står på", () => {
    document.body.innerHTML = `<div data-theme="dark"><p id="i">i</p></div>`
    expect(token(hent("i"))).toBe(MORK)
  })

  it("lar et tema ligge inne i et annet, begge veier", () => {
    document.body.innerHTML = `
      <div data-theme="dark">
        <p id="ytre">ytre</p>
        <div data-theme="light"><p id="indre">indre</p></div>
      </div>
    `
    expect(token(hent("ytre"))).toBe(MORK)
    expect(token(hent("indre"))).toBe(LYS)

    document.body.innerHTML = `
      <div data-theme="light">
        <p id="ytre">ytre</p>
        <div data-theme="dark"><p id="indre">indre</p></div>
      </div>
    `
    expect(token(hent("ytre"))).toBe(LYS)
    expect(token(hent("indre"))).toBe(MORK)
  })

  it("setter color-scheme der et tema er valgt, og bare der", () => {
    // Uten dette får et lyst felt en svart nedtrekksliste under seg. Men
    // egenskapen arves nedover, så en verdi på `:root` gjelder hele
    // dokumentet. Den skal derfor aldri stå der uten at noen har bedt om det.
    document.body.innerHTML = `
      <div id="lys" data-theme="light"></div>
      <div id="mork" data-theme="dark"></div>
    `
    expect(getComputedStyle(hent("lys")).colorScheme).toBe("light")
    expect(getComputedStyle(hent("mork")).colorScheme).toBe("dark")
    expect(getComputedStyle(document.documentElement).colorScheme).toBe(
      "normal",
    )
  })
})

/**
 * Leser én regelblokk ut av kilden, som navn til verdi.
 *
 * Kaster om selektoren ikke finnes. En `indexOf` som gir -1 ville ellers gitt
 * en tom streng, og en påstand om at noe *ikke* står der ville passert uten å
 * ha lest en eneste linje.
 */
function blokk(velger: string): Map<string, string> {
  const start = tokenKilde.indexOf(`${velger} {`)
  if (start < 0) throw new Error(`fant ikke ${velger} i tokens.css`)
  const slutt = tokenKilde.indexOf("\n  }", start)
  if (slutt < 0) throw new Error(`fant ingen slutt på ${velger}`)
  return new Map(
    [...tokenKilde.slice(start, slutt).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
      (m) => [m[1], m[2].trim()],
    ),
  )
}

describe("de to temablokkene er symmetriske", () => {
  it("deklarerer nøyaktig de samme tokenene", () => {
    const lys = blokk('[data-theme="light"]')
    const mork = blokk('[data-theme="dark"]')

    // Asymmetrien var hele feilen: lys hadde null tokens, mørk hadde 90.
    expect(lys.size).toBeGreaterThan(0)
    expect([...mork.keys()].filter((t) => !lys.has(t))).toEqual([])
    expect([...lys.keys()].filter((t) => !mork.has(t))).toEqual([])
  })

  it("gir lysblokka nøyaktig verdiene fra :root", () => {
    // Navnene alene holder ikke. Hentet `lightLines` fra feil kilde, eller
    // fikk `--fs-icon-*` de mørke strekfargene sine, ville navnene fortsatt
    // stemt mens fargene var gale.
    const rot = blokk("  :root")
    const avvik = [...blokk('[data-theme="light"]')].filter(
      ([navn, verdi]) => rot.get(navn) !== verdi,
    )
    expect(avvik).toEqual([])
  })

  it("gir mørkblokka nøyaktig verdiene fra mediespørringen", () => {
    const media = blokk('    :root:not([data-theme="light"])')
    const avvik = [...blokk('[data-theme="dark"]')].filter(
      ([navn, verdi]) => media.get(navn) !== verdi,
    )
    expect(avvik).toEqual([])
  })

  it("setter ikke color-scheme på bar :root", () => {
    // `blokk` kaster om selektoren mangler, så denne kan ikke passere tomt.
    expect([...blokk("  :root").keys()]).not.toContain("color-scheme")
    expect(tokenKilde.slice(0, tokenKilde.indexOf("\n  }"))).not.toContain(
      "color-scheme",
    )
  })
})

/*
 * Emuleringen går over CDP og finnes bare i Chromium. Reglene er ren CSS uten
 * skript, så de to andre motorene dekkes av blokken over.
 */
describe.skipIf(server.browser !== "chromium")(
  "mot det maskinen står på",
  () => {
    async function settSystemtema(skjema: "light" | "dark") {
      await cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: skjema }],
      })
      await ventPaTegning()
    }

    afterEach(async () => {
      // Emuleringen gjelder hele siden og ville ellers fulgt med inn i
      // testene som kjører etter denne fila.
      await cdp().send("Emulation.setEmulatedMedia", { features: [] })
      rydd()
    })

    it("følger systemet når ingen har valgt tema", async () => {
      document.body.innerHTML = `<p id="ute">ute</p>`
      await settSystemtema("light")
      expect(token(hent("ute"))).toBe(LYS)

      await settSystemtema("dark")
      expect(token(hent("ute"))).toBe(MORK)
    })

    it("holder en lys komponent lys på en mørk maskin", async () => {
      // Dette var feilen: før rettelsen arvet div-en den mørke
      // verdien fra `:root`, fordi blokken ikke deklarerte tokenene på nytt.
      document.body.innerHTML = `
        <p id="ute">ute</p>
        <div data-theme="light"><p id="inne">inne</p></div>
      `
      await settSystemtema("dark")
      expect(token(hent("inne"))).toBe(LYS)
      expect(token(hent("ute"))).toBe(MORK)
    })

    it("lar en app tvinge lyst tema på hele dokumentet", async () => {
      document.body.innerHTML = `<p id="ute">ute</p>`
      document.documentElement.setAttribute("data-theme", "light")
      await settSystemtema("dark")
      expect(token(hent("ute"))).toBe(LYS)
    })

    it("lar color-scheme på html stå urørt i begge modi", async () => {
      for (const skjema of ["light", "dark"] as const) {
        await settSystemtema(skjema)
        expect(getComputedStyle(document.documentElement).colorScheme).toBe(
          "normal",
        )
      }
    })
  },
)
