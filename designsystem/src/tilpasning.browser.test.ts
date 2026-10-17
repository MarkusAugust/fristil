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
      <button class="fs-button">Knapp</button>
      <input class="fs-input" />
    `
  })

  it("kan sette en komponentvariabel uten noen selektor", () => {
    apply(":root { --fs-button-radius: 9999px; }")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).borderRadius).toBe("9999px")

    // Variabelen er komponentens egen: input skal ikke påvirkes
    const input = document.querySelector(".fs-input") as HTMLElement
    expect(getComputedStyle(input).borderRadius).not.toBe("9999px")
  })

  it("faller tilbake til tokenverdien når variabelen ikke er satt", () => {
    // Standardverdien skal følge --fs-spacing-skalaen, ikke være bakt inn.
    // Det er grunnen til at @property ikke brukes her: en registrert
    // initial-value gjør var()-fallbacken uoppnåelig.
    apply(":root { --fs-spacing-1: 20px; }")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).borderRadius).toBe("20px")
  })

  it("kan overstyre en regel systemet ikke har eksponert, med lav spesifisitet", () => {
    document.body.innerHTML = '<button class="fs-button" disabled>Av</button>'

    // Systemets regel er .fs-button:disabled, altså 0,2,0. Konsumentens er
    // 0,1,0 og ville tapt uten @layer, uansett rekkefølge. Det er nettopp
    // dette layeret er til for.
    apply(".fs-button { background: rgb(1, 2, 3); }")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(1, 2, 3)")
  })

  it("kan overstyre en token, også i mørkt tema via systemvalget", () => {
    apply(":root { --fs-color-accent-fill: rgb(124, 58, 237); }")
    document.documentElement.setAttribute("data-theme", "dark")

    const button = document.querySelector(".fs-button") as HTMLElement
    expect(getComputedStyle(button).backgroundColor).toBe("rgb(124, 58, 237)")
  })
})

/**
 * At Fristil og Tailwind kan ligge i samme app uten å slåss.
 *
 * Lagene teller i den rekkefølgen de først blir nevnt, og det siste laget
 * vinner uansett spesifisitet. Tailwinds Preflight ligger i `base`, og
 * nullstiller blant annet bakgrunnen på `button` og punktene på `ul` og
 * `ol`. Havner `base` etter `fristil`, forsvinner knappefargen vår, uten at
 * noe sier fra.
 *
 * Rekkefølgen kan ikke endres etter at et lag er nevnt, så hver variant måles
 * i sitt eget dokument.
 */
async function medStilark(
  css: string,
  markup = '<button class="fs-button" id="knapp">Send søknad</button>',
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
 * punktene fra `.fs-list`. Hele fila, så det som nullstilles er det
 * konsumenten får.
 */
const PREFLIGHT = `@layer base { ${preflightKilde} }`

/** Rekkefølgen dokumentasjonen ber konsumenten sette på første linje. */
const LAGLINJE =
  "@layer theme, base, fristil, fristil-tema, components, utilities;"

/**
 * Et utdrag av det `fristil tema` skriver: en farge, skriften og formen, i
 * `:root` i temaets eget lag. Fargen er med fordi tokens.css setter den i
 * `:root` i `fristil`; bare et token som finnes der kan vise at temaet
 * slår det. Temaet erklærer bare sitt eget lag etter `fristil`, og kan ikke
 * vite hvilke lag appen har erklært fra før.
 */
const TEMA = `
  @layer fristil, fristil-tema;
  @layer fristil-tema {
    :root {
      --fs-color-accent-fill: rgb(0, 100, 0);
      --fs-font-family-base: Georgia, serif;
      --fs-button-radius: 2.75rem;
    }
    :root {
      font-family: var(--fs-font-family-base);
    }
  }`

/**
 * Det Tailwind lager av `p-4` med temaet vårt: `--spacing` er
 * `--fs-spacing-1`, og `sjekk-tailwind.ts` kontrollerer med en ekte Tailwind
 * at klassen inneholder nettopp dette regnestykket.
 */
const P4 =
  "@layer utilities { .p-4 { padding: calc(var(--fs-spacing-1) * 4); } }"

describe("sammen med Tailwind", () => {
  afterEach(() => {
    // Rammene må bort. Blir de stående, kan fokus havne i dem, og testene
    // som måler fokus lenger ned i suiten måler feil dokument.
    for (const ramme of document.querySelectorAll("iframe")) ramme.remove()
  })

  it("beholder knappefargen når fristil står etter base", async () => {
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

    // `base` nevnes her etter `fristil`, og vinner derfor.
    expect(stil(dok, "knapp").backgroundColor).toBe("rgba(0, 0, 0, 0)")
  })

  it("beholder punktene og tallene i lista når Preflight står i base", async () => {
    // Preflight setter `list-style: none` på hver liste. Standardvarianten
    // sa ingenting om punktene og lente seg på nettleseren, så Preflight
    // vant selv om `base` sto foran `fristil`, og lista mistet punktene og
    // nummereringen. Variantene uten punkter skal fortsatt være uten.
    const dok = await medStilark(
      `
      ${LAGLINJE}
      ${tokenKilde}
      ${listeKilde}
      ${PREFLIGHT}
    `,
      `<ul class="fs-list" id="punkter"><li>Fødselsattest</li></ul>
       <ol class="fs-list" id="tall"><li>Fyll ut skjemaet</li></ol>
       <ul class="fs-list" data-variant="plain" id="ren"><li>Sendt</li></ul>`,
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

  it("lar komponenten slå utility-klassen når fristil står etter utilities, og det er derfor linja står i dokumentasjonen", async () => {
    const dok = await medStilark(`
      @layer utilities { .p-6 { padding: 1.5rem; } }
      ${tokenKilde}
      ${knappeKilde}
    `)

    const knapp = dok.getElementById("knapp") as HTMLElement
    knapp.classList.add("p-6")

    // `utilities` nevnes her før `fristil`, så komponentens egen padding
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

    // Temaet står etter `fristil` og slår fargen tokens.css setter i
    // `:root`. Formen er ingen prøve på det: tokens.css setter ingen
    // `--fs-button-radius`, så den hadde vunnet uansett rekkefølge.
    expect(stil(dok, "knapp").backgroundColor).toBe("rgb(0, 100, 0)")
    // `fristil-tema` står foran `utilities`, så klassen slår temaets regel.
    expect(
      dok.defaultView?.getComputedStyle(dok.documentElement).fontFamily,
    ).toBe("monospace")
  })

  it("lar temaet slå utility-klassene når tema-laget mangler i linja, og det er derfor det står der", async () => {
    const dok = await medStilark(`
      @layer theme, base, fristil, components, utilities;
      ${tokenKilde}
      ${knappeKilde}
      ${TEMA}
      @layer utilities { .font-mono { font-family: monospace; } }
    `)
    dok.documentElement.classList.add("font-mono")

    // Temaets `@layer fristil, fristil-tema;` oppretter bare lag som ikke
    // finnes, så `fristil-tema` havner sist, etter `utilities`.
    expect(
      dok.defaultView?.getComputedStyle(dok.documentElement).fontFamily,
    ).toBe("Georgia, serif")
  })

  it("gir p-4 den samme avstanden som --fs-spacing-4 når hele skalaen skrives om", async () => {
    const markup = `
      <div class="p-4" id="klasse"></div>
      <div style="padding: var(--fs-spacing-4)" id="trinn"></div>
      <button class="fs-button" id="knapp">Send søknad</button>`

    // Hele skalaen, slik dokumentasjonen viser det: hvert trinn skrives om,
    // for trinnene er egne verdier og regnes ikke av enheten.
    const hele = await medStilark(
      `
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      ${P4}
      :root {
        --fs-spacing-0-5: 0.15rem;
        --fs-spacing-1: 0.3rem;
        --fs-spacing-2: 0.6rem;
        --fs-spacing-3: 0.9rem;
        --fs-spacing-4: 1.2rem;
        --fs-spacing-5: 1.5rem;
        --fs-spacing-6: 1.8rem;
        --fs-spacing-7: 2.1rem;
        --fs-spacing-8: 2.4rem;
        --fs-spacing-10: 3rem;
        --fs-spacing-12: 3.6rem;
        --fs-spacing-16: 4.8rem;
      }
    `,
      markup,
    )
    expect(stil(hele, "klasse").padding).toBe("19.2px")
    expect(stil(hele, "trinn").padding).toBe("19.2px")
    expect(stil(hele, "knapp").padding).toBe("9.6px 19.2px")

    // Skrives bare enheten om, følger klassene med, men ikke trinnene, og
    // dermed ikke komponentene. Det er derfor dokumentasjonen ber om hele
    // skalaen.
    const bare = await medStilark(
      `
      ${LAGLINJE}
      ${tokenKilde}
      ${knappeKilde}
      ${P4}
      :root { --fs-spacing-1: 0.3rem; }
    `,
      markup,
    )
    expect(stil(bare, "klasse").padding).toBe("19.2px")
    expect(stil(bare, "trinn").padding).toBe("16px")
    expect(stil(bare, "knapp").padding).toBe("8px 16px")
  })
})
