/// <reference path="./types/css.d.ts" />

import preflightKilde from "tailwindcss/preflight.css?inline"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import knappeKilde from "./components/css/button/button.css?inline"
import listeKilde from "./components/css/list/list.css?inline"
import tokenKilde from "./tokens/tokens.css?inline"

import "./tokens/tokens.css"
import "./components/css/button/button.css"
import "./components/css/input/input.css"

/**
 * At en konsument faktisk får lov til å tilpasse systemet.
 *
 * Dette er et løfte til dem som bruker pakken, og det er lett å bryte uten å
 * merke det: legger noen inn en mer spesifikk selektor, eller tar en verdi ut
 * av en variabel, forsvinner muligheten stille. Testen holder de tre veiene
 * åpne.
 */

/** Legger inn CSS som om den kom fra konsumentens eget stilark. */
function apply(css: string): void {
  const style = document.createElement("style")
  style.dataset.consumer = ""
  style.textContent = css
  document.head.append(style)
}

describe("en konsument kan tilpasse systemet", () => {
  beforeEach(() => {
    // Stilarkene havner i <head> og overlever ellers til neste test
    for (const style of document.querySelectorAll("style[data-consumer]")) {
      style.remove()
    }
    document.documentElement.removeAttribute("data-theme")
    document.body.innerHTML = `
      <button class="lt-button">Knapp</button>
      <input class="lt-input" />
    `
  })

  it("kan sette en komponentvariabel uten noen selektor", () => {
    apply(":root { --lt-button-radius: 9999px; }")

    const button = document.querySelector(".lt-button") as HTMLElement
    expect(getComputedStyle(button).borderRadius).toBe("9999px")

    // Variabelen er komponentens egen: input skal ikke påvirkes
    const input = document.querySelector(".lt-input") as HTMLElement
    expect(getComputedStyle(input).borderRadius).not.toBe("9999px")
  })

  it("faller tilbake til tokenverdien når variabelen ikke er satt", () => {
    // Standardverdien skal følge --lt-spacing-skalaen, ikke være bakt inn.
    // Det er grunnen til at @property ikke brukes her: en registrert
    // initial-value gjør var()-fallbacken uoppnåelig.
    apply(":root { --lt-spacing-1: 20px; }")

    const button = document.querySelector(".lt-button") as HTMLElement
    expect(getComputedStyle(button).borderRadius).toBe("20px")
  })

  it("kan overstyre en regel systemet ikke har eksponert, med lav spesifisitet", () => {
    document.body.innerHTML = '<button class="lt-button" disabled>Av</button>'

    // Systemets regel er .lt-button:disabled, altså 0,2,0. Konsumentens er
    // 0,1,0 og ville tapt uten @layer, uansett rekkefølge. Det er nettopp
    // dette layeret er til for.
    apply(".lt-button { background: rgb(1, 2, 3); }")

    const button = document.querySelector(".lt-button") as HTMLElement
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("kan overstyre en token, også i mørkt tema via systemvalget", () => {
    apply(":root { --lt-color-accent-fill: rgb(124, 58, 237); }")
    document.documentElement.setAttribute("data-theme", "dark")

    const button = document.querySelector(".lt-button") as HTMLElement
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(124, 58, 237)")
  })
})

/**
 * At LO-TEK og Tailwind kan ligge i samme app uten å slåss.
 *
 * Lagene teller i den rekkefølgen de først blir nevnt, og det siste laget
 * vinner uansett spesifisitet. Tailwinds Preflight ligger i `base`, og
 * nullstiller blant annet bakgrunnen på `button` og punktene på `ul` og
 * `ol`. Havner `base` etter `lotek`, forsvinner knappefargen vår, uten at
 * noe sier fra.
 *
 * Rekkefølgen kan ikke endres etter at et lag er nevnt, så hver variant måles
 * i sitt eget dokument.
 */
async function medStilark(
  css: string,
  markup = '<button class="lt-button" id="knapp">Send søknad</button>',
): Promise<Document> {
  const ramme = document.createElement("iframe")
  ramme.style.width = "400px"
  ramme.style.height = "200px"
  document.body.append(ramme)

  const dok = ramme.contentDocument as Document
  dok.open()
  dok.write(`<!doctype html><html><head><style>${css}</style></head>
    <body>${markup}</body></html>`)
  dok.close()

  await new Promise((resolve) => requestAnimationFrame(resolve))
  return dok
}

/** Den stilen et element i dokumentet faktisk får. */
function stil(dok: Document, id: string): CSSStyleDeclaration {
  const element = dok.getElementById(id) as HTMLElement
  return (dok.defaultView as Window).getComputedStyle(element)
}

/**
 * Tailwinds egen Preflight, i laget `@import "tailwindcss"` legger den i.
 *
 * Testen hadde en håndskrevet utgave med bare knappereglene, og da så den
 * aldri at Preflight også setter `list-style: none` på hver liste, som tok
 * punktene fra `.lt-list`. Hele fila, så det som nullstilles er det
 * konsumenten får.
 */
const PREFLIGHT = `@layer base { ${preflightKilde} }`

/** Rekkefølgen dokumentasjonen ber konsumenten sette på første linje. */
const LAGLINJE =
  "@layer theme, base, lotek, lotek-theme, components, utilities;"

/**
 * Et utdrag av det `lotek tema` skriver: en farge, skriften og formen, i
 * `:root` i temaets eget lag. Fargen er med fordi tokens.css setter den i
 * `:root` i `lotek`; bare et token som finnes der kan vise at temaet
 * slår det. Temaet erklærer bare sitt eget lag etter `lotek`, og kan ikke
 * vite hvilke lag appen har erklært fra før.
 */
const TEMA = `
  @layer lotek, lotek-theme;
  @layer lotek-theme {
    :root {
      --lt-color-accent-fill: rgb(0, 100, 0);
      --lt-font-family-base: Georgia, serif;
      --lt-button-radius: 2.75rem;
    }
    :root {
      font-family: var(--lt-font-family-base);
    }
  }`

/**
 * Det Tailwind lager av `p-4` med temaet vårt: `--spacing` er
 * `--lt-spacing-1`, og `check-tailwind.ts` kontrollerer med en ekte Tailwind
 * at klassen inneholder nettopp dette regnestykket.
 */
const P4 =
  "@layer utilities { .p-4 { padding: calc(var(--lt-spacing-1) * 4); } }"

describe("sammen med Tailwind", () => {
  afterEach(() => {
    // Rammene må bort. Blir de stående, kan fokus havne i dem, og testene
    // som måler fokus lenger ned i suiten måler feil dokument.
    for (const ramme of document.querySelectorAll("iframe")) ramme.remove()
  })

  it("beholder knappefargen når lotek står etter base", async () => {
    const dok = await medStilark(`
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      ${PREFLIGHT}
    `)

    expect(stil(dok, "knapp").backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
  })

  it("mister knappefargen uten rekkefølgen, og det er derfor linja står i dokumentasjonen", async () => {
    const dok = await medStilark(`
      ${tokenKilde}
      ${knappeKilde}
      ${PREFLIGHT}
    `)

    // `base` nevnes her etter `lotek`, og vinner derfor.
    expect(stil(dok, "knapp").backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("beholder punktene og tallene i lista når Preflight står i base", async () => {
    // Preflight setter `list-style: none` på hver liste. Standardvarianten
    // sa ingenting om punktene og lente seg på nettleseren, så Preflight
    // vant selv om `base` sto foran `lotek`, og lista mistet punktene og
    // nummereringen. Variantene uten punkter skal fortsatt være uten.
    const dok = await medStilark(
      `
      ${LAGLINJE}
      ${tokenKilde}
      ${listeKilde}
      ${PREFLIGHT}
    `,
      `<ul class="lt-list" id="punkter"><li>Fødselsattest</li></ul>
       <ol class="lt-list" id="tall"><li>Fyll ut skjemaet</li></ol>
       <ul class="lt-list" data-variant="plain" id="ren"><li>Sendt</li></ul>`,
    )

    expect(stil(dok, "punkter").listStyleType).toBe("disc")
    expect(stil(dok, "tall").listStyleType).toBe("decimal")
    expect(stil(dok, "ren").listStyleType).toBe("none")
  })

  it("lar en Tailwind-utility slå komponentens egen verdi", async () => {
    const dok = await medStilark(`
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      @layer utilities { .p-6 { padding: 1.5rem; } }
    `)

    const knapp = dok.getElementById("knapp") as HTMLElement
    knapp.classList.add("p-6")

    expect(stil(dok, "knapp").padding).toBe("24px")
  })

  it("lar komponenten slå utility-klassen når lotek står etter utilities, og det er derfor linja står i dokumentasjonen", async () => {
    const dok = await medStilark(`
      @layer utilities { .p-6 { padding: 1.5rem; } }
      ${tokenKilde}
      ${knappeKilde}
    `)

    const knapp = dok.getElementById("knapp") as HTMLElement
    knapp.classList.add("p-6")

    // `utilities` nevnes her før `lotek`, så komponentens egen padding
    // vinner, og klassen gjør ingenting.
    expect(stil(dok, "knapp").padding).toBe("8px 16px")
  })

  it("lar et generert tema vinne over tokens.css, og en utility vinne over temaet", async () => {
    const dok = await medStilark(`
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      ${TEMA}
      @layer utilities { .font-mono { font-family: monospace; } }
    `)
    dok.documentElement.classList.add("font-mono")

    // Temaet står etter `lotek` og slår fargen tokens.css setter i
    // `:root`. Formen er ingen prøve på det: tokens.css setter ingen
    // `--lt-button-radius`, så den hadde vunnet uansett rekkefølge.
    expect(stil(dok, "knapp").backgroundColor).toBe("rgb(0, 100, 0)")
    // `lotek-theme` står foran `utilities`, så klassen slår temaets regel.
    expect(
      dok.defaultView?.getComputedStyle(dok.documentElement).fontFamily,
    ).toBe("monospace")
  })

  it("lar temaet slå utility-klassene når tema-laget mangler i linja, og det er derfor det står der", async () => {
    const dok = await medStilark(`
      @layer theme, base, lotek, components, utilities;
      ${tokenKilde}
      ${knappeKilde}
      ${TEMA}
      @layer utilities { .font-mono { font-family: monospace; } }
    `)
    dok.documentElement.classList.add("font-mono")

    // Temaets `@layer lotek, lotek-theme;` oppretter bare lag som ikke
    // finnes, så `lotek-theme` havner sist, etter `utilities`.
    expect(
      dok.defaultView?.getComputedStyle(dok.documentElement).fontFamily,
    ).toBe("Georgia, serif")
  })

  it("gir p-4 den samme avstanden som --lt-spacing-4 når hele skalaen skrives om", async () => {
    const markup = `
      <div class="p-4" id="klasse"></div>
      <div style="padding: var(--lt-spacing-4)" id="trinn"></div>
      <button class="lt-button" id="knapp">Send søknad</button>`

    // Hele skalaen, slik dokumentasjonen viser det: hvert trinn skrives om,
    // for trinnene er egne verdier og regnes ikke av enheten.
    const hele = await medStilark(
      `
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      ${P4}
      :root {
        --lt-spacing-0-5: 0.15rem;
        --lt-spacing-1: 0.3rem;
        --lt-spacing-2: 0.6rem;
        --lt-spacing-3: 0.9rem;
        --lt-spacing-4: 1.2rem;
        --lt-spacing-5: 1.5rem;
        --lt-spacing-6: 1.8rem;
        --lt-spacing-7: 2.1rem;
        --lt-spacing-8: 2.4rem;
        --lt-spacing-10: 3rem;
        --lt-spacing-12: 3.6rem;
        --lt-spacing-16: 4.8rem;
      }
    `,
      markup,
    )
    // Tallene, ikke strengene: WebKit regner `calc(0.3rem * 4)` i enkel
    // presisjon og svarer «19.200001px» der de andre svarer «19.2px».
    const padding = (dok: Document, id: string, ...ventet: number[]) => {
      const tall = stil(dok, id).padding.split(" ").map(Number.parseFloat)
      expect(tall).toHaveLength(ventet.length)
      for (const [i, verdi] of tall.entries()) {
        expect(verdi).toBeCloseTo(ventet[i], 3)
      }
    }
    padding(hele, "klasse", 19.2)
    padding(hele, "trinn", 19.2)
    padding(hele, "knapp", 9.6, 19.2)

    // Skrives bare enheten om, følger klassene med, men ikke trinnene, og
    // dermed ikke komponentene. Det er derfor dokumentasjonen ber om hele
    // skalaen.
    const bare = await medStilark(
      `
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      ${P4}
      :root { --lt-spacing-1: 0.3rem; }
    `,
      markup,
    )
    padding(bare, "klasse", 19.2)
    padding(bare, "trinn", 16)
    padding(bare, "knapp", 8, 16)
  })
})
