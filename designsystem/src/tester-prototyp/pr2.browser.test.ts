/// <reference path="../types/css.d.ts" />
// Testerens reproduksjoner for PR 2 i fikseplanen. Ikke en del av repoet.
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { farge } from "../testing/farge"
import { contrastRatio } from "../tokens/color"
import "../tokens/tokens.css"
import "../components/css/paragraph/paragraph.css"
import "../components/css/card/card.css"
import "../components/css/button/button.css"
import "../components/css/toggle-group/toggle-group.css"
import "../components/css/progress/progress.css"

function rgb(s: string) {
  const m = s.match(/[\d.]+/g)?.map(Number) ?? []
  return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }
}
const k = (a: string, b: string) =>
  Math.round(contrastRatio(rgb(a), rgb(b)) * 100) / 100

/** Første ugjennomsiktige bakgrunn oppover. */
function bak(el: Element | null): string {
  while (el) {
    const c = getComputedStyle(el).backgroundColor
    if (rgb(c).a > 0) return c
    el = el.parentElement
  }
  return "rgb(255, 255, 255)"
}

function lysSide(html: string) {
  // Som en vanlig konsument: kom-i-gang sine linjer på body, ikke monter().
  document.body.removeAttribute("style")
  document.body.style.background = "var(--fs-color-neutral-canvas)"
  document.body.style.color = "var(--fs-color-neutral-text)"
  document.body.innerHTML = html
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("2.1 nøstet tema", () => {
  it("<div data-theme=dark> på lys side har mørk bakgrunn og lesbar tekst", () => {
    lysSide(
      `<div data-theme="dark" id="m"><p class="fs-paragraph" id="p">Tekst</p>Bar tekst</div>`,
    )
    const p = document.getElementById("p") as HTMLElement
    const m = document.getElementById("m") as HTMLElement
    const resultat = {
      divBakgrunn: getComputedStyle(m).backgroundColor,
      kontrastAvsnitt: k(getComputedStyle(p).color, bak(p)),
      kontrastBarTekst: k(getComputedStyle(m).color, bak(m)),
    }
    expect(resultat).toEqual({
      divBakgrunn: farge("--fs-color-neutral-canvas", "dark"),
      kontrastAvsnitt: expect.toSatisfy((x: number) => x >= 4.5),
      kontrastBarTekst: expect.toSatisfy((x: number) => x >= 4.5),
    })
  })

  it("<div data-theme=dark class=fs-card data-variant=filled> beholder kortets bakgrunn", () => {
    lysSide(
      `<div data-theme="dark" class="fs-card" data-variant="filled" id="c">x</div>`,
    )
    const c = document.getElementById("c") as HTMLElement
    expect(getComputedStyle(c).backgroundColor).toBe(
      farge("--fs-color-neutral-surface", "dark"),
    )
  })
})

describe("2.2 fokusring og avslått i nøstet tema", () => {
  it("fokusringen i <div data-theme=dark> på lys side er den mørke", async () => {
    lysSide(
      `<div data-theme="dark"><button class="fs-button" id="b">Knapp</button><button class="fs-button" id="d" disabled>Av</button></div>`,
    )
    const b = document.getElementById("b") as HTMLElement
    await userEvent.tab()
    expect(document.activeElement).toBe(b)
    const ut = {
      outline: getComputedStyle(b).outlineColor,
      avslått: getComputedStyle(document.getElementById("d") as HTMLElement)
        .backgroundColor,
    }
    expect(ut).toEqual({
      outline: farge("--fs-color-accent-border-strong", "dark"),
      avslått: farge("--fs-color-neutral-raised", "dark"),
    })
  })

  it("omvendt: <div data-theme=light> på mørk side", async () => {
    document.documentElement.setAttribute("data-theme", "dark")
    try {
      lysSide(
        `<div data-theme="light"><button class="fs-button" id="b">Knapp</button></div>`,
      )
      const b = document.getElementById("b") as HTMLElement
      await userEvent.tab()
      expect(getComputedStyle(b).outlineColor).toBe(
        farge("--fs-color-accent-border-strong", "light"),
      )
    } finally {
      document.documentElement.removeAttribute("data-theme")
    }
  })
})

describe("2.2 med generert tema", () => {
  it("ringen følger et tema i fristil-tema-laget nøstet i siden", async () => {
    const stil = document.createElement("style")
    stil.textContent = `@layer fristil, fristil-tema; @layer fristil-tema { [data-theme="dark"] { --fs-color-accent-border-strong: #ff0000; } }`
    document.head.append(stil)
    try {
      lysSide(
        `<div data-theme="dark"><button class="fs-button" id="b">Knapp</button></div>`,
      )
      await userEvent.tab()
      expect(
        getComputedStyle(document.getElementById("b") as HTMLElement)
          .outlineColor,
      ).toBe("rgb(255, 0, 0)")
    } finally {
      stil.remove()
    }
  })
})

describe("2.3 toggle group-ring på valgt", () => {
  for (const tema of ["light", "dark"] as const) {
    it(`kontrast ring mot valgt flate ≥ 3:1 (${tema})`, async () => {
      lysSide(`<div data-theme="${tema}" style="padding:8px">
        <fieldset class="fs-toggle-group">
          <label class="fs-toggle-group__option"><input type="radio" name="v" value="a" checked id="a">A</label>
          <label class="fs-toggle-group__option"><input type="radio" name="v" value="b">B</label>
        </fieldset></div>`)
      const a = document.getElementById("a") as HTMLInputElement
      a.focus()
      await userEvent.keyboard("{ArrowRight}")
      await userEvent.keyboard("{ArrowLeft}")
      expect(document.activeElement).toBe(a)
      const opt = a.closest("label") as HTMLElement
      const s = getComputedStyle(opt)
      expect(s.outlineStyle).toBe("solid")
      expect(k(s.outlineColor, s.backgroundColor)).toBeGreaterThanOrEqual(3)
    })
  }
})

describe("2.5 Progress-sporet", () => {
  for (const tema of ["light", "dark"] as const) {
    it(`spor/kant mot canvas ≥ 3:1 (${tema})`, () => {
      lysSide(
        `<div data-theme="${tema}" style="background: var(--fs-color-neutral-canvas); padding: 8px"><progress class="fs-progress" id="p" value="30" max="100"></progress></div>`,
      )
      const p = document.getElementById("p") as HTMLElement
      const s = getComputedStyle(p)
      const canvas = farge("--fs-color-neutral-canvas", tema)
      const ut = {
        spor: k(s.backgroundColor, canvas),
        kant: s.borderTopWidth === "0px" ? 0 : k(s.borderTopColor, canvas),
        fyllMotSpor: k(s.color, s.backgroundColor),
      }
      // Uendret: spor 1,12 (lyst) og 1,21 (mørkt). Med fiksen: kant 4,37 og 5,27.
      expect(ut.kant).toBeGreaterThanOrEqual(3)
    })
  }
})
