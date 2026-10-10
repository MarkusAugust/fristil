/// <reference path="../types/css.d.ts" />
/// <reference types="@vitest/browser-playwright" />
// Testerens reproduksjoner for PR 3 i fikseplanen. Ikke en del av repoet.
import { afterEach, describe, expect, it } from "vitest"
import { cdp, page, userEvent } from "vitest/browser"
import { monter, ventPaTegning } from "../testing/a11y"
import "../tokens/tokens.css"
import "../components/css/link/link.css"
import "../components/css/pagination/pagination.css"
import "../components/css/progress/progress.css"
import "../components/css/breadcrumbs/breadcrumbs.css"
import "../components/css/tooltip/tooltip.css"
import "../components/css/button/button.css"
import "../components/css/accordion/accordion.css"
import "../components/css/select/select.css"
import "../components/css/input/input.css"
import "../components/css/badge/badge.css"

async function hoeykontrast(på: boolean) {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: på ? [{ name: "forced-colors", value: "active" }] : [],
  })
  await ventPaTegning()
}

afterEach(async () => {
  await hoeykontrast(false)
  await page.viewport(414, 896)
})

describe("3.2 avslått lenke", () => {
  it("Enter på <a aria-disabled href> følger lenken", async () => {
    monter(
      `<a class="fs-link" id="l" aria-disabled="true" href="#fulgt">Se årsoppgave</a>`,
    )
    location.hash = ""
    const l = document.getElementById("l") as HTMLAnchorElement
    l.focus()
    expect(document.activeElement).toBe(l)
    await userEvent.keyboard("{Enter}")
    await ventPaTegning()
    // Funnet: den følges.
    expect(location.hash).toBe("#fulgt")
    location.hash = ""
  })
})

describe("3.3 pagination i høykontrast med hover", () => {
  it("gjeldende side under musa har lesbar tekst", async () => {
    monter(
      `<nav><ul class="fs-pagination"><li><a href="#1">1</a></li><li><a id="c" href="#2" aria-current="page">2</a></li></ul></nav>`,
    )
    await hoeykontrast(true)
    const c = document.getElementById("c") as HTMLElement
    const før = getComputedStyle(c)
    const utenHover = { color: før.color, bg: før.backgroundColor }
    await userEvent.hover(c)
    await ventPaTegning()
    const s = getComputedStyle(c)
    const medHover = { color: s.color, bg: s.backgroundColor }
    expect({
      utenHover,
      medHover,
      lik: medHover.color === medHover.bg,
    }).toEqual({ utenHover, medHover, lik: false })
  })
})

describe("3.4 ubestemt progress i høykontrast", () => {
  it("har noe synlig", async () => {
    monter(`<progress class="fs-progress" id="p"></progress>`)
    await hoeykontrast(true)
    const s = getComputedStyle(document.getElementById("p") as HTMLElement)
    const info = {
      bg: s.backgroundColor,
      img: s.backgroundImage.slice(0, 60),
      fca: s.forcedColorAdjust,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
    }
    expect(info.img).not.toBe("none")
  })
})

describe("3.5 breadcrumbs", () => {
  it("skilletegnet står i tilgjengelighetstreet", async () => {
    monter(
      `<nav aria-label="Brødsmuler" id="bc"><ol class="fs-breadcrumbs"><li><a href="#a">Hjem</a></li><li><a href="#b">Saker</a></li><li><a href="#c" aria-current="page">Sak 12</a></li></ol></nav>`,
    )
    await ventPaTegning()
    const li = document.querySelector("#bc li + li") as HTMLElement
    const content = getComputedStyle(li, "::before").content
    type Ramme = { frame: { id: string; url: string }; childFrames?: Ramme[] }
    const { frameTree } = (await cdp().send("Page.getFrameTree")) as {
      frameTree: Ramme
    }
    const alle: Ramme[] = []
    const gå = (r: Ramme) => {
      alle.push(r)
      for (const b of r.childFrames ?? []) gå(b)
    }
    gå(frameTree)
    const min =
      alle.find((r) => r.frame.url === location.href) ?? alle[alle.length - 1]
    const { nodes } = (await cdp().send("Accessibility.getFullAXTree", {
      frameId: min?.frame.id,
    })) as {
      nodes: Array<{ role?: { value: string }; name?: { value: string } }>
    }
    const tekster = nodes
      .filter((n) => n.role?.value === "StaticText")
      .map((n) => n.name?.value)
    expect({
      content,
      skråstreker: tekster.filter((t) => t?.trim() === "/").length,
      hjem: tekster.filter((t) => t === "Hjem").length,
      supports: CSS.supports('content: "x" / ""'),
      supportsAt: CSS.supports('(content: "x" / "")'),
    }).toEqual({
      content,
      skråstreker: 0,
      hjem: 1,
      supports: true,
      supportsAt: true,
    })
  })
})

describe("3.6 tooltip", () => {
  it("boblen blir stående når musa krysser gapet", async () => {
    monter(`<div style="padding: 80px 40px">
      <span class="fs-tooltip" id="t"><button class="fs-button" aria-describedby="h" id="k">Arkiver</button>
      <span class="fs-tooltip__bubble" role="tooltip" id="h">Flyttes til arkivet</span></span></div>`)
    const k = document.getElementById("k") as HTMLElement
    const h = document.getElementById("h") as HTMLElement
    await userEvent.hover(k)
    await ventPaTegning()
    const synligPåKnapp = getComputedStyle(h).visibility
    const kr = k.getBoundingClientRect()
    const br = h.getBoundingClientRect()
    // Et punkt midt i gapet mellom knappen og boblen.
    const y = (kr.top + br.bottom) / 2
    const x = (kr.left + kr.right) / 2
    const flate = document.getElementById("fs-testflate") as HTMLElement
    await userEvent.hover(flate, {
      position: {
        x: x - flate.getBoundingClientRect().left,
        y: y - flate.getBoundingClientRect().top,
      },
    })
    await ventPaTegning()
    const iGapet = getComputedStyle(h).visibility
    expect({ synligPåKnapp, iGapet, gap: kr.top - br.bottom }).toEqual({
      synligPåKnapp: "visible",
      iGapet: "visible",
      gap: kr.top - br.bottom,
    })
  })

  it("aria-describedby gir beskrivelse også når boblen er display:none", async () => {
    monter(`<span class="fs-tooltip"><button class="fs-button" aria-describedby="h3" id="k3">Arkiver</button>
      <span class="fs-tooltip__bubble" role="tooltip" id="h3">Flyttes til arkivet</span></span>`)
    await ventPaTegning()
    const display = getComputedStyle(
      document.getElementById("h3") as HTMLElement,
    ).display
    type Ramme = { frame: { id: string; url: string }; childFrames?: Ramme[] }
    const { frameTree } = (await cdp().send("Page.getFrameTree")) as {
      frameTree: Ramme
    }
    const alle: Ramme[] = []
    const gå = (r: Ramme) => {
      alle.push(r)
      for (const b of r.childFrames ?? []) gå(b)
    }
    gå(frameTree)
    const min = alle.find((r) => r.frame.url === location.href)
    const { nodes } = (await cdp().send("Accessibility.getFullAXTree", {
      frameId: min?.frame.id,
    })) as {
      nodes: Array<{
        role?: { value: string }
        name?: { value: string }
        description?: { value: string }
      }>
    }
    const knapp = nodes.find(
      (n) => n.role?.value === "button" && n.name?.value === "Arkiver",
    )
    expect({ display, beskrivelse: knapp?.description?.value }).toEqual({
      display,
      beskrivelse: "Flyttes til arkivet",
    })
  })

  it("skjult boble ved høyre kant gir ikke overløp", async () => {
    await page.viewport(360, 640)
    document.body.style.margin = "0"
    monter(`<div style="display:flex; justify-content:flex-end">
      <span class="fs-tooltip"><button class="fs-button" aria-describedby="h2">X</button>
      <span class="fs-tooltip__bubble" role="tooltip" id="h2">En ganske lang hjelpetekst som går langt ut over kanten av skjermen</span></span></div>`)
    await ventPaTegning()
    const d = document.scrollingElement as HTMLElement
    expect({ sw: d.scrollWidth, cw: d.clientWidth }).toEqual({
      sw: d.clientWidth,
      cw: d.clientWidth,
    })
  })
})

describe("3.7 accordion-pila i RTL", () => {
  it("transform i RTL er speilet av LTR", async () => {
    monter(`
      <div dir="ltr"><details class="fs-accordion" id="l"><summary>A</summary><div class="fs-accordion__content">x</div></details>
      <details class="fs-accordion" id="lo" open><summary>A</summary><div class="fs-accordion__content">x</div></details></div>
      <div dir="rtl"><details class="fs-accordion" id="r"><summary>A</summary><div class="fs-accordion__content">x</div></details>
      <details class="fs-accordion" id="ro" open><summary>A</summary><div class="fs-accordion__content">x</div></details></div>`)
    const m = (id: string) =>
      new DOMMatrix(
        getComputedStyle(
          document.querySelector(`#${id} summary`) as Element,
          "::after",
        ).transform,
      )
    const speil = (a: DOMMatrix) =>
      [a.a, -a.b, -a.c, a.d, -a.e, a.f].map(
        (v) => Math.round(v * 100) / 100 + 0,
      )
    const tall = (a: DOMMatrix) =>
      [a.a, a.b, a.c, a.d, a.e, a.f].map((v) => Math.round(v * 100) / 100 + 0)
    expect({ lukket: tall(m("r")), åpen: tall(m("ro")) }).toEqual({
      lukket: speil(m("l")),
      åpen: speil(m("lo")),
    })
  })
})

describe("3.8 select-pila i RTL", () => {
  it("pila står like langt fra kanten i begge retninger", async () => {
    monter(`
      <div dir="ltr"><select class="fs-select" id="sl" style="inline-size: 200px"><option>Valg</option></select></div>
      <div dir="rtl"><select class="fs-select" id="sr" style="inline-size: 200px"><option>Valg</option></select></div>`)
    const px = (id: string) =>
      getComputedStyle(document.getElementById(id) as HTMLElement)
        .backgroundPositionX.split(",")
        .map((s) => s.trim())
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    )
    const size = 0.35 * rem
    const W = (
      document.getElementById("sl") as HTMLElement
    ).getBoundingClientRect().width
    // Løs calc(100% - X) mot (W - size) for LTR: ytterste kant av pila.
    const ltr = px("sl")
    const rtl = px("sr")
    const evalPos = (v: string) => {
      const el = document.createElement("div")
      el.style.inlineSize = `${W - size}px`
      el.style.position = "absolute"
      document.body.append(el)
      el.style.marginInlineStart = v.replace(/^calc/, "calc")
      const r = Number.parseFloat(getComputedStyle(el).marginLeft)
      el.remove()
      return r
    }
    // Margin-prosent regnes mot forelderens bredde, så bruk en forelder.
    const ltrPx = ltr.map((v) => {
      const holder = document.createElement("div")
      holder.style.inlineSize = `${W - size}px`
      const el = document.createElement("div")
      el.style.marginLeft = v
      holder.append(el)
      document.body.append(holder)
      const r = Number.parseFloat(getComputedStyle(el).marginLeft)
      holder.remove()
      return r
    })
    const rtlPx = rtl.map((v) => evalPos(v))
    const ltrAvstand = W - (Math.max(...ltrPx) + size)
    const rtlAvstand = Math.min(...rtlPx)
    expect({
      ltr,
      rtl,
      ltrAvstand: Math.round(ltrAvstand),
      rtlAvstand: Math.round(rtlAvstand),
    }).toEqual({
      ltr,
      rtl,
      ltrAvstand: Math.round(ltrAvstand),
      rtlAvstand: Math.round(ltrAvstand),
    })
  })
})

describe("3.10 overskrift i summary", () => {
  it("<summary><h3> har ingen marg og arver skrift", async () => {
    monter(
      `<details class="fs-accordion" id="a"><summary><h3 id="h">Tittel</h3></summary><div class="fs-accordion__content">x</div></details>`,
    )
    const s = getComputedStyle(document.getElementById("h") as HTMLElement)
    const sum = getComputedStyle(
      document.querySelector("#a summary") as HTMLElement,
    )
    expect({ m: s.marginTop, fs: s.fontSize }).toEqual({
      m: "0px",
      fs: sum.fontSize,
    })
  })
})

describe("3.11 avslått og ugyldig", () => {
  it("avslått vinner over ugyldig i input", async () => {
    monter(
      `<input class="fs-input" id="i" disabled data-state="invalid" value="x"><input class="fs-input" id="d" disabled value="x">`,
    )
    const i = getComputedStyle(document.getElementById("i") as HTMLElement)
    const d = getComputedStyle(document.getElementById("d") as HTMLElement)
    expect(i.borderTopColor).toBe(d.borderTopColor)
  })
})

describe("3.15 badge på smal skjerm", () => {
  it("lang badge i 320px gir ikke overløp", async () => {
    await page.viewport(320, 640)
    document.body.style.margin = "0"
    monter(
      `<span class="fs-badge">Venter på dokumentasjon fra arbeidsgiver, lege og NAV-kontoret ditt/span>`,
    )
    await ventPaTegning()
    const d = document.scrollingElement as HTMLElement
    expect({ sw: d.scrollWidth, cw: d.clientWidth }).toEqual({
      sw: d.clientWidth,
      cw: d.clientWidth,
    })
  })
})
