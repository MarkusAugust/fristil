/// <reference path="./types/css.d.ts" />

/*
 * Hver hover som bytter bakgrunn må holde kontrasten.
 *
 * Dette er den ene feilklassen enhetstestene ikke så. `.fs-button:hover` leste
 * et token som ikke finnes, og pagineringens hover vant på spesifisitet over
 * `[aria-current="page"]`, så sidetallet brukeren sto på forsvant. I begge
 * tilfellene var hviletilstanden riktig, og hver annen vaktpost grønn.
 *
 * Nettleseren er den eneste ærlige dommeren her: hvilken farge som gjelder
 * under musa avgjøres av kaskaden, og det var nettopp spesifisiteten som gikk
 * galt. Derfor hoveres det med musa framfor å regne på stilarket.
 */

import { beforeEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { contrastRatio } from "./tokens/color.js"

import "./tokens/tokens.css"
import "./components/css/accordion/accordion.css"
import "./components/css/button/button.css"
import "./components/css/pagination/pagination.css"
import "./components/css/table/table.css"
import "./components/ramme/tabs/tabs.css"
import "./components/css/toggle-group/toggle-group.css"
import "./components/ramme/suggestion/suggestion.css"
import "./components/frittstaende/toast/toast.css"

type Tilfelle = {
  /** Regelen tilfellet dekker, normalisert som i sjekken nederst. */
  regel: string
  /** Markupen som gir elementet en flate å ligge på. */
  markup: string
  /** Elementet musa skal over. */
  velger: string
}

const TILFELLER: Tilfelle[] = [
  {
    regel: ".fs-accordion summary:hover",
    markup: `<details class="fs-accordion"><summary>Vilkår</summary><div class="fs-accordion__content">Tekst</div></details>`,
    velger: ".fs-accordion summary",
  },
  {
    regel: ".fs-button:hover",
    markup: `<button class="fs-button">Send søknaden</button>`,
    velger: ".fs-button",
  },
  {
    regel: '.fs-button[data-variant="secondary"]:hover',
    markup: `<button class="fs-button" data-variant="secondary">Avbryt</button>`,
    velger: ".fs-button",
  },
  {
    regel: '.fs-button[data-variant="ghost"]:hover',
    markup: `<button class="fs-button" data-variant="ghost">Lukk</button>`,
    velger: ".fs-button",
  },
  {
    regel: '.fs-button[data-variant="danger"]:hover',
    markup: `<button class="fs-button" data-variant="danger">Slett</button>`,
    velger: ".fs-button",
  },
  {
    regel:
      '.fs-pagination a:not([aria-current="page"]):hover, .fs-pagination button:hover:not(:disabled):not([aria-current="page"])',
    markup: `<ul class="fs-pagination"><li><a href="#">1</a></li></ul>`,
    velger: ".fs-pagination a",
  },
  {
    regel: '.fs-pagination [aria-current="page"]:hover',
    markup: `<ul class="fs-pagination"><li><a href="#" aria-current="page">2</a></li></ul>`,
    velger: ".fs-pagination a",
  },
  {
    regel: ".fs-table[data-hoverable] tbody tr:hover",
    markup: `<table class="fs-table" data-hoverable><tbody><tr><td>Rad</td></tr></tbody></table>`,
    velger: ".fs-table td",
  },
  {
    regel: ".fs-toggle-group__option:hover",
    markup: `<fieldset class="fs-toggle-group"><label class="fs-toggle-group__option"><input type="radio" name="v" /> Kart</label></fieldset>`,
    velger: ".fs-toggle-group__option",
  },
  {
    regel: ".fs-tabs__list button:hover",
    markup: `<div class="fs-tabs__list"><button type="button">Oversikt</button></div><div class="fs-tabs__panel">Oversikt</div>`,
    velger: ".fs-tabs__list button",
  },
  {
    regel: ".fs-suggestion__option:hover",
    markup: `<div class="fs-suggestion__field"><input class="fs-input" /><ul class="fs-suggestion__list"><li class="fs-suggestion__option">Bergen</li></ul></div>`,
    velger: ".fs-suggestion__option",
  },
  {
    regel: ".fs-toast__close:hover",
    markup: `<div class="fs-toast"><p>Lagret</p><button class="fs-toast__close" type="button">Lukk</button></div>`,
    velger: ".fs-toast__close",
  },
]

/*
 * To regler kan ikke hoveres av en test, og står her for at
 * fullstendighetsleddet nederst skal vite om dem.
 *
 * `::file-selector-button` er et pseudoelement: `querySelector` finner det
 * ikke, og `userEvent.hover` tar et element. `option` i den stylede
 * nedtrekkslista står i en `@supports (appearance: base-select)` Firefox 150
 * ikke har, og i de to andre motorene er den ikke rendret før velgeren er
 * åpnet.
 *
 * De ble en gang kontrollert på et tokenpar skrevet inn her. Det er fjernet:
 * paret var skrevet av for hånd, så det sa ingenting om hva CSS-en faktisk
 * gjorde, og det ene av de to var ordrett løftet «text mot egen surface» som
 * kontrakten alt kontrollerer for hver familie. En påstand som gjentar en
 * strengere vaktpost ser ut som dekning og er støy.
 */
const UTEN_MUS = [
  ".fs-file-upload::file-selector-button:hover",
  '.fs-select[data-picker="styled"] option:hover',
]

/**
 * Fargen som `rgb`, eller en feil.
 *
 * Alt annet enn `rgb()` og `rgba()` med alfa 1 avvises framfor å bli tolket.
 * Første utgave leste de tre første tallene i strengen, og ville lest
 * `color(srgb 0.13 0.43 0.73)` som 0, 0 og 0 uten et ord, altså gitt et galt
 * forhold som så riktig ut. Ingen komponent bruker slike verdier i dag, og da
 * er dette stedet å si fra hvis en gjør det.
 */
function tilRgb(verdi: string) {
  const treff = verdi.match(
    /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/,
  )
  if (!treff) throw new Error(`Ikke en rgb-farge: ${verdi}`)
  if (treff[4] !== undefined && Number(treff[4]) !== 1) {
    throw new Error(
      `Halvgjennomsiktig farge, som testen ikke regner på: ${verdi}`,
    )
  }
  return { r: Number(treff[1]), g: Number(treff[2]), b: Number(treff[3]) }
}

/**
 * Bakgrunnen som faktisk synes: den nærmeste flaten som ikke er gjennomsiktig.
 *
 * Finnes ingen, kastes det. En reserve på hvitt sto her, og den var feil i
 * mørkt tema. Verre: den var det eneste som gjorde noen av tilfellene
 * følsomme for om musa hadde slått inn, så et galt svar holdt testen i live.
 * Flata rundt settes i `monter()` og er alltid ugjennomsiktig.
 */
function synligBakgrunn(element: Element): string {
  let node: Element | null = element
  while (node) {
    const verdi = getComputedStyle(node).backgroundColor
    if (!/^rgba\(.*,\s*0\)$/.test(verdi)) return verdi
    node = node.parentElement
  }
  throw new Error("Ingen ugjennomsiktig flate under elementet")
}

/**
 * Markupen to ganger: én å hovere, én å la stå.
 *
 * Tilstanden uten mus må leses av et element som aldri har hatt musa over
 * seg. Å lese før og etter i samme element er ikke til å stole på, siden musa
 * kan stå der markupen settes inn, og en `mouseleave` som ikke kom ville gjort
 * de to avlesningene like uten at noe var galt.
 */
function monter(markup: string) {
  /*
   * `position: relative` på hver kopi er ikke pynt: et absolutt posisjonert
   * barn, som forslagslista, ville ellers regnet fra det samme utgangspunktet
   * i begge kopiene og lagt seg oppå den andre.
   */
  document.body.innerHTML = `
    <div id="flate" style="background: var(--fs-color-neutral-canvas)">
      <div id="under-musa" style="position: relative">${markup}</div>
      <div id="i-ro" style="position: relative">${markup}</div>
    </div>`

  const finn = (id: string, velger: string) => {
    const element = document.querySelector(`#${id} ${velger}`)
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Fant ikke ${velger} i #${id}`)
    }
    return element
  }

  return finn
}

for (const utseende of ["light", "dark"] as const) {
  describe(`hover i ${utseende} tema`, () => {
    beforeEach(() => {
      document.documentElement.dataset.theme = utseende
    })

    it.each(
      TILFELLER.map((t) => [t.regel, t] as const),
    )("%s holder kontrasten under musa", async (_navn, tilfelle) => {
      const finn = monter(tilfelle.markup)
      const element = finn("under-musa", tilfelle.velger)
      const iRo = finn("i-ro", tilfelle.velger)

      /*
       * Begge leses etter at musa er flyttet. Leste vi den i ro først, sto
       * pekeren der forrige test forlot den, og falt det punktet inni
       * `#i-ro`, leste vi en hovertilstand som «i ro».
       */
      await userEvent.hover(element)

      const flate = synligBakgrunn(element)
      const flateIRo = synligBakgrunn(iRo)

      /*
       * Uten dette leddet består hvert tilfelle på tilstanden uten mus. I lyst
       * tema holdt alle tolv kontrasten i hvile, og nettopp tilfellet fila ble
       * skrevet for, gjeldende side i pagineringen, holdt i begge temaer. Da
       * ville en `userEvent.hover` som sluttet å treffe gjort vakten grønn i
       * stillhet, som er verre enn ingen vakt.
       */
      expect(flate, "musa endret ikke flaten").not.toBe(flateIRo)

      const tekst = tilRgb(getComputedStyle(element).color)
      expect(contrastRatio(tekst, tilRgb(flate))).toBeGreaterThanOrEqual(4.5)
    })
  })
}

/*
 * Lista over må dekke hver hover-regel som bytter bakgrunn.
 *
 * Uten dette leddet er lista en samling tilfeller noen husket, og en ny
 * hover-regel ville kommet inn uten et tilfelle som dekker den. Regelen leses
 * ut av stilarkene, så det er kilden som bestemmer hva som må stå her.
 */
const stilark = import.meta.glob("./components/**/*.css", {
  query: "?inline",
  import: "default",
  eager: true,
}) as Record<string, string>

describe("lista er komplett", () => {
  it("har et tilfelle for hvert stilark med en hover som bytter bakgrunn", () => {
    const medHover = new Set<string>()

    for (const css of Object.values(stilark)) {
      const utenKommentarer = css.replace(/\/\*[\s\S]*?\*\//g, " ")
      for (const treff of utenKommentarer.matchAll(
        /([^{}]*:hover[^{}]*)\{([^}]*)\}/g,
      )) {
        if (/\bbackground(-color)?\s*:/.test(treff[2]))
          medHover.add(treff[1].split(/\s+/).join(" ").trim())
      }
    }

    const dekket = new Set([...TILFELLER.map((t) => t.regel), ...UTEN_MUS])
    expect([...medHover].filter((r) => !dekket.has(r)).sort()).toEqual([])
    expect([...dekket].filter((r) => !medHover.has(r)).sort()).toEqual([])
  })
})
