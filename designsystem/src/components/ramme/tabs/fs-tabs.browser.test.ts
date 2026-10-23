/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsTabs, type FsTabs } from "./fs-tabs"
import { tabs } from "./tabs"

import "../../../tokens/tokens.css"
import "./tabs.css"

const NOKLER = ["soknaden", "vedlegg", "meldinger"]
const TEKST = ["Søknaden", "Vedlegg", "Meldinger"]
const INNHOLD = [
  "Søknaden ble sendt 4. mars.",
  "Tre vedlegg.",
  "Ingen meldinger.",
]

/** Markupen `fs.tabs()` gir: lenker, id-er og klasser. Resten skriver komponenten. */
const FANER = tabs({
  id: "sak",
  keys: NOKLER,
  label: "Deler av saken",
})

/** Lenkene i raden og panelene, fra byggefunksjonen, hver for seg. */
function deler(
  faner: ReturnType<typeof tabs> = FANER,
  deaktivert: number[] = [],
) {
  const lenker = faner.tabs
    .map(
      (fane, i) =>
        `<li><a ${attr(fane)}${deaktivert.includes(i) ? ' aria-disabled="true"' : ""}>${TEKST[i]}</a></li>`,
    )
    .join("")
  const paneler = faner.panels.map(
    (panel, i) =>
      `<section ${attr(panel)}><h2 ${attr(faner.headings[i])}>${TEKST[i]}</h2><p>${INNHOLD[i]}</p></section>`,
  )
  return { lenker, paneler }
}

function fraByggefunksjonen(faner = FANER, vert = ""): string {
  const { lenker, paneler } = deler(faner)
  return `
    <fs-tabs${vert}>
      <ul ${attr(faner.list)}>${lenker}</ul>
      ${paneler.join("")}
    </fs-tabs>`
}

const faner = () => [
  ...document.querySelectorAll<HTMLElement>("fs-tabs [role='tab']"),
]
const paneler = () => [
  ...document.querySelectorAll<HTMLElement>(".fs-tabs__panel"),
]
const valgt = () =>
  faner().map((f) => f.getAttribute("aria-selected") === "true")
// `hidden` i stedet for `.hidden`: egenskapen svarer «until-found» for den formen.
const skjult = () => paneler().map((p) => p.hasAttribute("hidden"))

function tast(element: Element, key: string) {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
}

async function tegn() {
  await customElements.whenDefined("fs-tabs")
  await ventPaTegning()
}

beforeEach(() => {
  // Komponenten leser adressen ved lasting, og adressen lever videre mellom
  // testene. Bare når noe står der: Safari kaster etter hundre kall på ti sekunder.
  if (location.hash) {
    history.replaceState(null, "", `${location.pathname}${location.search}`)
  }
})

describe("fs-tabs", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  beforeEach(async () => {
    monter(fraByggefunksjonen())
    await tegn()
  })

  it("setter rollene og koblingen på markup fra fs.tabs()", () => {
    const liste = document.querySelector(".fs-tabs__list") as HTMLElement
    const [fane] = faner()
    const panel = document.getElementById("sak-soknaden") as HTMLElement

    expect(liste.getAttribute("role")).toBe("tablist")
    expect(liste.getAttribute("aria-label")).toBe("Deler av saken")
    expect(fane.getAttribute("role")).toBe("tab")
    expect(fane.getAttribute("aria-controls")).toBe("sak-soknaden")
    expect(panel.getAttribute("role")).toBe("tabpanel")
    expect(panel.getAttribute("aria-labelledby")).toBe("sak-soknaden-heading")
  })

  it("skriver ingen id på fanene", () => {
    // Datastar og idiomorph kjenner igjen et element på id. En id serveren
    // ikke sendte, gjør at elementet byttes ut ved neste oppdatering.
    expect(faner().map((f) => f.id)).toEqual(["", "", ""])
  })

  it("skjuler panelene som ikke er valgt med until-found", () => {
    // `fs.tabs()` skriver ikke `hidden`, så panelene vises uten JavaScript.
    // Komponenten skjuler dem, og med `until-found` finner søk i siden dem.
    expect(paneler().map((p) => p.getAttribute("hidden"))).toEqual([
      null,
      "until-found",
      "until-found",
    ])
  })

  it("gir bare den valgte fanen en tabbestopp", () => {
    // Ellers er det én tabbestopp per fane, og Tab kommer aldri inn i
    // panelet uten å gå gjennom hele raden.
    expect(faner().map((f) => f.tabIndex)).toEqual([0, -1, -1])
  })

  it("ber ikke malen frede noe", () => {
    // Fanevalget er brukerens, og komponenten setter det tilbake selv etter
    // en patch. Kommer `data-preserve-attr` tilbake her, har noen gjenopptatt
    // kontrakten malen måtte skrive av fra dokumentasjonen.
    expect(faner()[0].hasAttribute("data-preserve-attr")).toBe(false)
    expect(paneler()[0].hasAttribute("data-preserve-attr")).toBe(false)
  })

  it("flytter mellom fanene med piltastene", async () => {
    faner()[0].focus()
    tast(faner()[0], "ArrowRight")
    await tegn()

    expect(document.activeElement).toBe(faner()[1])
    expect(valgt()).toEqual([false, true, false])
  })

  it("går rundt fra siste til første", async () => {
    faner()[2].click()
    await tegn()
    tast(faner()[2], "ArrowRight")
    await tegn()

    expect(document.activeElement).toBe(faner()[0])
  })

  it("melder fra når en fane velges", async () => {
    const meldinger: number[] = []
    document
      .querySelector("fs-tabs")
      ?.addEventListener("tab-select", (hendelse) => {
        meldinger.push(hendelse.detail.index)
      })
    faner()[1].click()
    await tegn()

    expect(meldinger).toEqual([1])
  })

  it("har ingen tilgjengelighetsbrudd", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs.tabs() og nøklene", () => {
  it("lager lenker, panel-id-er og overskrifts-id-er av nøklene", () => {
    // Hele formen står i krav I5, i `fs-tabs-krav.browser.test.ts`.
    const f = tabs({ id: "sak", keys: ["a", "b"], label: "Saken" })

    expect(f.tabs.map((t) => t.href)).toEqual(["#sak-a", "#sak-b"])
    expect(f.panels.map((p) => p.id)).toEqual(["sak-a", "sak-b"])
    expect(f.headings.map((h) => h.id)).toEqual([
      "sak-a-heading",
      "sak-b-heading",
    ])
  })

  it("gir en tom rad for ingen nøkler", () => {
    const f = tabs({ id: "tom", keys: [], label: "Tom" })

    expect(f.tabs).toEqual([])
    expect(f.panels).toEqual([])
    expect(f.headings).toEqual([])
  })

  it("kaster på en nøkkel som ikke kan bli en id", () => {
    expect(() => tabs({ id: "x", keys: [""], label: "Faner" })).toThrow(/tom/)
    expect(() => tabs({ id: "x", keys: ["a b"], label: "Faner" })).toThrow(
      /mellomrom/,
    )
    expect(() => tabs({ id: "x", keys: ["a\tb"], label: "Faner" })).toThrow(
      /mellomrom/,
    )
    expect(() => tabs({ id: "x", keys: ["a\u00a0b"], label: "Faner" })).toThrow(
      /mellomrom/,
    )
    expect(() => tabs({ id: "x", keys: ["a", "a"], label: "Faner" })).toThrow(
      /to ganger/,
    )
    expect(() => tabs({ id: "x", keys: [1 as never], label: "Faner" })).toThrow(
      /ikke tekst/,
    )
    expect(() => tabs({ id: "x", label: "Faner" } as never)).toThrow(
      /keys mangler/,
    )
  })
})

describe("fs-tabs finner panelet gjennom href og hopper over det som ikke kan velges", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  const liste = (lenker: string) =>
    `<ul class="fs-tabs__list" role="tablist">${lenker}</ul>`

  it("hopper over en deaktivert fane med piltastene, Home og End", async () => {
    // Uten dette valgte piltasten den deaktiverte fanen, og raden sto uten
    // en eneste fane som kunne få fokus. Tastaturbrukeren var låst ute.
    const første = deler(FANER, [1])
    monter(
      `<fs-tabs>${liste(første.lenker)}${første.paneler.join("")}</fs-tabs>`,
    )
    await tegn()
    faner()[0].focus()

    tast(faner()[0], "ArrowRight")
    await tegn()
    expect(document.activeElement).toBe(faner()[2])
    expect(valgt()).toEqual([false, false, true])

    tast(faner()[2], "ArrowLeft")
    await tegn()
    expect(document.activeElement).toBe(faner()[0])

    const andre = deler(FANER, [2])
    monter(`<fs-tabs>${liste(andre.lenker)}${andre.paneler.join("")}</fs-tabs>`)
    await tegn()
    faner()[0].focus()
    tast(faner()[0], "End")
    await tegn()
    expect(document.activeElement).toBe(faner()[1])

    ;(document.querySelector("fs-tabs") as FsTabs).select(2)
    await tegn()
    expect(valgt()).toEqual([false, true, false])
  })

  it("går til første og siste fane med Home og End", async () => {
    const { lenker, paneler: p } = deler()
    monter(`<fs-tabs>${liste(lenker)}${p.join("")}</fs-tabs>`)
    await tegn()
    faner()[1].click()
    await tegn()

    tast(faner()[1], "End")
    await tegn()
    expect(document.activeElement).toBe(faner()[2])
    expect(valgt()).toEqual([false, false, true])

    tast(faner()[2], "Home")
    await tegn()
    expect(document.activeElement).toBe(faner()[0])
    expect(valgt()).toEqual([true, false, false])
  })

  it("lar faner i faner være hver sin rad", async () => {
    // `querySelectorAll` over hele undertreet gjorde en indre fanerad til en
    // del av den ytre: et klikk på en indre fane skjulte det ytre panelet
    // den sto i.
    const ytre = tabs({ id: "ytre", keys: ["a", "b"], label: "Ytre" })
    const indre = tabs({ id: "indre", keys: ["a", "b"], label: "Indre" })
    const rad = (f: typeof ytre, navn: string) =>
      f.tabs.map((t, i) => `<li><a ${attr(t)}>${navn} ${i}</a></li>`).join("")
    monter(`
      <fs-tabs>
        <ul ${attr(ytre.list)}>${rad(ytre, "Ytre")}</ul>
        <section ${attr(ytre.panels[0])}>
          <h2 ${attr(ytre.headings[0])}>Ytre 0</h2>
          <fs-tabs>
            <ul ${attr(indre.list)}>${rad(indre, "Indre")}</ul>
            <section ${attr(indre.panels[0])}><h3 ${attr(indre.headings[0])}>A</h3></section>
            <section ${attr(indre.panels[1])}><h3 ${attr(indre.headings[1])}>B</h3></section>
          </fs-tabs>
        </section>
        <section ${attr(ytre.panels[1])}><h2 ${attr(ytre.headings[1])}>Ytre 1</h2></section>
      </fs-tabs>
    `)
    await tegn()
    ;(
      document.querySelectorAll(
        "fs-tabs fs-tabs [role='tab']",
      )[1] as HTMLElement
    ).click()
    await tegn()

    const skjultId = (id: string) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden")
    expect(skjultId("ytre-a")).toBe(false)
    expect(skjultId("ytre-b")).toBe(true)
    expect(skjultId("indre-a")).toBe(true)
    expect(skjultId("indre-b")).toBe(false)
    expect(
      document
        .querySelector("a[href='#ytre-a']")
        ?.getAttribute("aria-selected"),
    ).toBe("true")
  })

  it("finner panelet gjennom href, ikke gjennom rekkefølgen", async () => {
    // Koblingen står i markupen, og skal leses derfra. Med panelene i en
    // annen rekkefølge viste et klikk på fane 1 panelet til en annen fane.
    const { lenker, paneler: p } = deler()
    const [forste, ...resten] = p
    monter(`<fs-tabs>${liste(lenker)}${[...resten, forste].join("")}</fs-tabs>`)
    await tegn()
    faner()[1].click()
    await tegn()

    const skjultId = (id: string) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden")
    expect(skjultId("sak-soknaden")).toBe(true)
    expect(skjultId("sak-vedlegg")).toBe(false)
    expect(skjultId("sak-meldinger")).toBe(true)
  })

  it("finner et panel som står utenfor verten", async () => {
    const { lenker, paneler: p } = deler()
    monter(`
      <fs-tabs>${liste(lenker)}${p[0]}</fs-tabs>
      ${p[1]}
      ${p[2]}
    `)
    await tegn()
    faner()[1].click()
    await tegn()

    const skjultId = (id: string) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden")
    expect(skjultId("sak-soknaden")).toBe(true)
    expect(skjultId("sak-vedlegg")).toBe(false)
  })

  it("sier fra om en lenke som peker på ingenting, uten å fryse", async () => {
    // Fant ikke komponenten panelet, kunne to faner få det samme og skrive
    // motsatt `hidden` på det i hver runde, og siden frøs.
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const { lenker, paneler: p } = deler()
      monter(`
        <fs-tabs>${liste(
          lenker
            .replace('href="#sak-vedlegg"', 'href="#sak-vedleggx"')
            .replace(
              'aria-controls="sak-vedlegg"',
              'aria-controls="sak-vedleggx"',
            ),
        )}${p.join("")}</fs-tabs>
      `)
      await tegn()
      faner()[2].click()
      await tegn()
      faner()[0].click()
      await tegn()
      await tegn()

      const skjultId = (id: string) =>
        (document.getElementById(id) as HTMLElement).hasAttribute("hidden")
      expect(skjultId("sak-soknaden")).toBe(false)
      expect(skjultId("sak-meldinger")).toBe(true)
      expect(
        advarsel.mock.calls.some((k) =>
          String(k[0]).includes("har faner uten et panel"),
        ),
      ).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it("viser et panel to faner deler når en av dem er valgt", async () => {
    // En feil i markupen, men et galt svar i stillhet er verre enn å vise
    // panelet: skrev bare den første fanen, sto panelet skjult mens den
    // andre var valgt.
    const { lenker, paneler: p } = deler()
    monter(`
      <fs-tabs>${liste(
        lenker
          .replace('href="#sak-meldinger"', 'href="#sak-soknaden"')
          .replace(
            'aria-controls="sak-meldinger"',
            'aria-controls="sak-soknaden"',
          ),
      )}${p.join("")}</fs-tabs>
    `)
    await tegn()
    faner()[2].click()
    await tegn()

    const skjultId = (id: string) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden")
    expect(valgt()).toEqual([false, false, true])
    expect(skjultId("sak-soknaden")).toBe(false)
    expect(skjultId("sak-vedlegg")).toBe(true)
  })

  it("flytter tabbestoppet når den valgte fanen deaktiveres av en patch", async () => {
    const { lenker, paneler: p } = deler()
    monter(`<fs-tabs>${liste(lenker)}${p.join("")}</fs-tabs>`)
    await tegn()
    faner()[1].click()
    await tegn()
    faner()[1].setAttribute("aria-disabled", "true")
    await tegn()

    // Valget står, men tabbestoppet er en fane som kan få fokus.
    expect(valgt()).toEqual([false, true, false])
    expect(faner().map((f) => f.tabIndex)).toEqual([-1, -1, 0])
  })

  it("lar selected settes som egenskap", async () => {
    // React 19 skriver egenskapen når den finnes, og dokumentasjonen viser
    // `faner.selected` som API. En getter alene kastet ved tilordning.
    const { lenker, paneler: p } = deler()
    monter(`<fs-tabs>${liste(lenker)}${p.join("")}</fs-tabs>`)
    await tegn()

    const meldinger: number[] = []
    const vert = document.querySelector("fs-tabs") as FsTabs
    vert.addEventListener("tab-select", (h) => {
      meldinger.push(h.detail.index)
    })
    vert.selected = 2
    await tegn()

    expect(vert.selected).toBe(2)
    expect(valgt()).toEqual([false, false, true])
    expect(meldinger).toEqual([2])
  })

  it("snur venstre og høyre pil i høyre-til-venstre", async () => {
    // I en side som leses fra høyre står neste fane til venstre. Uten dette
    // flyttet høyrepil fokus visuelt bakover.
    const { lenker, paneler: p } = deler()
    monter(`
      <div dir="rtl">
        <fs-tabs>${liste(lenker)}${p.join("")}</fs-tabs>
      </div>
    `)
    await tegn()
    faner()[1].click()
    await tegn()

    tast(faner()[1], "ArrowRight")
    await tegn()
    expect(document.activeElement).toBe(faner()[0])

    tast(faner()[0], "ArrowLeft")
    await tegn()
    expect(document.activeElement).toBe(faner()[1])
  })
})

/*
 * Markup skrevet uten JavaScript: en liste med lenker og ett panel per lenke,
 * uten roller, kobling eller `hidden`. Det malen må skrive er id på panelene,
 * og den krever lenkene uansett. Komponenten fyller inn resten.
 */
const BAR = `
  <fs-tabs>
    <ul class="fs-tabs__list" aria-label="Deler av saken">
      <li><a href="#soknaden">Søknaden</a></li>
      <li><a href="#vedlegg">Vedlegg</a></li>
      <li><a href="#meldinger">Meldinger</a></li>
    </ul>
    <section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2><p>Søknaden ble sendt 4. mars.</p></section>
    <section class="fs-tabs__panel" id="vedlegg"><h2>Vedlegg</h2><p>Tre vedlegg.</p></section>
    <section class="fs-tabs__panel" id="meldinger"><h2>Meldinger</h2><p>Ingen meldinger.</p></section>
  </fs-tabs>`

describe("fs-tabs kobler fra bar struktur", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  function barDeler() {
    return {
      liste: document.querySelector(".fs-tabs__list") as HTMLElement,
      punkter: [...document.querySelectorAll<HTMLElement>(".fs-tabs__list li")],
      lenker: [
        ...document.querySelectorAll<HTMLAnchorElement>(".fs-tabs__list a"),
      ],
      paneler: [...document.querySelectorAll<HTMLElement>(".fs-tabs__panel")],
    }
  }

  it("setter roller, kobling og tabbestopp", async () => {
    monter(BAR)
    await tegn()
    const { liste, punkter, lenker, paneler: p } = barDeler()

    expect(liste.getAttribute("role")).toBe("tablist")
    // Uten rollen leser skjermleseren «liste, 3 punkter» før hver fane.
    expect(punkter.map((li) => li.getAttribute("role"))).toEqual([
      "presentation",
      "presentation",
      "presentation",
    ])
    expect(lenker.map((l) => l.getAttribute("role"))).toEqual([
      "tab",
      "tab",
      "tab",
    ])
    expect(p.map((x) => x.getAttribute("role"))).toEqual([
      "tabpanel",
      "tabpanel",
      "tabpanel",
    ])
    lenker.forEach((lenke, i) => {
      expect(lenke.getAttribute("aria-controls")).toBe(p[i].id)
    })
    // Bare det valgte panelet er en tabbestopp. Et skjult panel som kan få
    // fokus, er et usynlig stopp for tastaturet.
    expect(p.map((x) => x.getAttribute("tabindex"))).toEqual(["0", null, null])

    expect(lenker.map((l) => l.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ])
    expect(lenker.map((l) => l.tabIndex)).toEqual([0, -1, -1])
    // Uten `until-found` finner ikke søk i siden et skjult panel.
    expect(p.map((x) => x.getAttribute("hidden"))).toEqual([
      null,
      "until-found",
      "until-found",
    ])

    await forventIngenTilgjengelighetsbrudd()
  })

  it("skriver ingen id på lenker, listepunkter, raden eller panelene", async () => {
    monter(BAR)
    await tegn()
    const { liste, punkter, lenker, paneler: p } = barDeler()

    expect([liste, ...punkter, ...lenker].map((e) => e.id)).toEqual([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ])
    // Panelenes id kommer fra serveren, og er den samme som før.
    expect(p.map((x) => x.id)).toEqual(["soknaden", "vedlegg", "meldinger"])
  })

  it("gir panelet navn fra overskriften i det", async () => {
    monter(BAR)
    await tegn()
    const { paneler: p } = barDeler()

    for (const panel of p) {
      const overskrift = panel.querySelector("h2") as HTMLElement
      expect(overskrift.id).not.toBe("")
      expect(panel.getAttribute("aria-labelledby")).toBe(overskrift.id)
      expect(panel.hasAttribute("aria-label")).toBe(false)
    }
  })

  it("bruker teksten på fanen som navn når panelet ikke har overskrift", async () => {
    monter(BAR.replaceAll(/<h2>[^<]*<\/h2>/g, ""))
    await tegn()
    const { paneler: p } = barDeler()

    expect(p.map((x) => x.getAttribute("aria-label"))).toEqual([
      "Søknaden",
      "Vedlegg",
      "Meldinger",
    ])
    expect(p.some((x) => x.hasAttribute("aria-labelledby"))).toBe(false)
  })

  it("bruker teksten på fanen som navn når aria-labelledby peker på ingenting", async () => {
    // En `aria-labelledby` uten gyldig id regnes ikke med ved utregningen av
    // navnet, og da tar `aria-label` over.
    monter(
      BAR.replaceAll(/<h2>[^<]*<\/h2>/g, "").replace(
        'id="vedlegg"',
        'id="vedlegg" aria-labelledby="finnes-ikke"',
      ),
    )
    await tegn()
    const { paneler: p } = barDeler()

    expect(p[1].getAttribute("aria-label")).toBe("Vedlegg")
    expect(p[1].getAttribute("aria-labelledby")).toBe("finnes-ikke")
  })

  it("lar et navn serveren skrev stå, og tar bort reserven når det kommer", async () => {
    monter(
      BAR.replaceAll(/<h2>[^<]*<\/h2>/g, "").replace(
        'id="vedlegg"',
        'id="vedlegg" aria-labelledby="eget-navn"',
      ),
    )
    await tegn()
    const { paneler: p } = barDeler()
    expect(p[1].getAttribute("aria-label")).toBe("Vedlegg")

    p[1].insertAdjacentHTML("afterend", '<p id="eget-navn">Mine vedlegg</p>')
    await tegn()

    expect(p[1].getAttribute("aria-labelledby")).toBe("eget-navn")
    expect(p[1].hasAttribute("aria-label")).toBe(false)
  })

  it("lar en aria-label serveren skrev stå", async () => {
    monter(
      BAR.replace('id="vedlegg"', 'id="vedlegg" aria-label="Alle vedlegg"'),
    )
    await tegn()
    const { paneler: p } = barDeler()

    expect(p[1].getAttribute("aria-label")).toBe("Alle vedlegg")
    expect(p[1].hasAttribute("aria-labelledby")).toBe(false)
  })

  it("leser valget fra hidden når ingen fane er markert", async () => {
    monter(
      BAR.replace('id="soknaden"', 'id="soknaden" hidden').replace(
        'id="meldinger"',
        'id="meldinger" hidden',
      ),
    )
    await tegn()
    const { lenker, paneler: p } = barDeler()

    expect(lenker.map((l) => l.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ])
    expect(lenker.map((l) => l.tabIndex)).toEqual([-1, 0, -1])
    expect(p.map((x) => x.hasAttribute("hidden"))).toEqual([true, false, true])
    // Formen serveren brukte, også på panelet den ikke hadde skjult.
    expect(p[0].getAttribute("hidden")).toBe("")
  })

  it("lar det serveren skrev stå", async () => {
    // Verdier komponenten aldri ville skrevet selv, så testen skiller «lot
    // stå» fra «skrev det samme».
    monter(BAR.replace('id="vedlegg"', 'id="vedlegg" tabindex="-1"'))
    await tegn()
    const { paneler: p } = barDeler()

    expect(p[1].tabIndex).toBe(-1)
  })

  it("skriver aria-controls fra href, også når serveren skrev en annen", async () => {
    // De to er den samme opplysningen, og `href` er den som virker uten
    // JavaScript.
    monter(
      BAR.replace(
        '<a href="#vedlegg">',
        '<a href="#vedlegg" aria-controls="feil">',
      ),
    )
    await tegn()
    const { lenker } = barDeler()

    expect(lenker[1].getAttribute("aria-controls")).toBe("vedlegg")
  })

  it("setter koblingen tilbake med den samme overskriftsid-en etter en patch", async () => {
    monter(BAR)
    await tegn()
    const { lenker, paneler: p } = barDeler()
    const overskrift = p[1].querySelector("h2") as HTMLElement
    const id = overskrift.id

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    for (const navn of ["role", "aria-controls", "aria-selected", "tabindex"]) {
      lenker[1].removeAttribute(navn)
    }
    for (const navn of ["role", "aria-labelledby", "tabindex", "hidden"]) {
      p[1].removeAttribute(navn)
    }
    overskrift.removeAttribute("id")
    await ventPaTegning()

    expect(overskrift.id).toBe(id)
    expect(p[1].getAttribute("aria-labelledby")).toBe(id)
    expect(lenker[1].getAttribute("aria-controls")).toBe("vedlegg")
    expect(lenker[1].getAttribute("role")).toBe("tab")
    expect(lenker[1].getAttribute("aria-selected")).toBe("false")
    expect(p[1].getAttribute("hidden")).toBe("until-found")
  })

  it("lar serveren bytte fane med bare hidden under server-controlled", async () => {
    /*
     * Den idiomatiske Datastar-måten: `data-attr:hidden` på hvert panel, og
     * ingenting på fanene. Komponenten hadde selv skrevet
     * `aria-selected="true"` på den første, og leste den tilbake som
     * serverens ord, så panelet serveren nettopp viste ble skjult igjen.
     */
    monter(BAR.replace("<fs-tabs>", "<fs-tabs server-controlled>"))
    await tegn()
    const { lenker, paneler: p } = barDeler()
    expect(lenker[0].getAttribute("aria-selected")).toBe("true")

    p[0].setAttribute("hidden", "")
    p[1].removeAttribute("hidden")
    await ventPaTegning()

    expect(p.map((x) => x.hasAttribute("hidden"))).toEqual([true, false, true])
    expect(lenker.map((l) => l.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ])
    expect(lenker.map((l) => l.tabIndex)).toEqual([-1, 0, -1])
  })

  it("lar en lenke uten rolle være i fred når serveren skrev rollene", async () => {
    // Har serveren skrevet rollene selv, er en lenke uten rolle i raden noe
    // annet enn en fane.
    monter(`
      <fs-tabs>
        <ul class="fs-tabs__list" role="tablist" aria-label="Deler av saken">
          <li role="presentation"><a href="#soknaden" role="tab">Søknaden</a></li>
          <li role="presentation"><a href="#vedlegg" role="tab">Vedlegg</a></li>
          <li><a href="#annet" class="til-toppen">Til toppen</a></li>
        </ul>
        <section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>
        <section class="fs-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>
      </fs-tabs>
    `)
    await tegn()
    const annen = document.querySelector(".til-toppen") as HTMLElement

    expect(annen.hasAttribute("role")).toBe(false)
    expect(annen.hasAttribute("aria-selected")).toBe(false)
    expect(annen.tabIndex).toBe(0)
  })

  it("tar imot en ny lenke i en bar rad som en fane", async () => {
    monter(BAR)
    await tegn()
    const { liste, paneler: p } = barDeler()

    const punkt = document.createElement("li")
    punkt.innerHTML = '<a href="#historikk">Historikk</a>'
    liste.append(punkt)
    const panel = document.createElement("section")
    panel.className = "fs-tabs__panel"
    panel.id = "historikk"
    panel.innerHTML = "<h2>Historikk</h2>"
    p[2].after(panel)
    await ventPaTegning()
    const ny = punkt.querySelector("a") as HTMLElement

    expect(punkt.getAttribute("role")).toBe("presentation")
    expect(ny.getAttribute("role")).toBe("tab")
    expect(ny.getAttribute("aria-controls")).toBe("historikk")
    expect(panel.getAttribute("hidden")).toBe("until-found")
  })

  it("holder brukerens valg gjennom en patch som tar alt komponenten skrev", async () => {
    monter(BAR)
    await tegn()
    const { lenker, paneler: p } = barDeler()

    lenker[2].click()
    await ventPaTegning()
    expect(p[2].hasAttribute("hidden")).toBe(false)

    for (const lenke of lenker) {
      for (const navn of ["aria-selected", "tabindex", "aria-controls"]) {
        lenke.removeAttribute(navn)
      }
    }
    for (const panel of p) panel.removeAttribute("hidden")
    await ventPaTegning()

    expect(lenker.map((l) => l.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
    ])
    expect(p.map((x) => x.hasAttribute("hidden"))).toEqual([true, true, false])
  })
})

describe("fs-tabs under server-controlled", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  /** Oppskriften fra Datastar-fanen på komponentsiden, bar struktur. */
  const FIRE = `
    <fs-tabs server-controlled>
      <ul class="fs-tabs__list" aria-label="Deler av saken">
        <li><a href="#soknaden">Søknaden</a></li>
        <li><a href="#vedlegg">Vedlegg</a></li>
      </ul>
      <section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>
      <section class="fs-tabs__panel" id="vedlegg" hidden><h2>Vedlegg</h2></section>
    </fs-tabs>`

  function tilstand() {
    return {
      valgt: [...document.querySelectorAll("fs-tabs a")].map((l) =>
        l.getAttribute("aria-selected"),
      ),
      skjult: paneler().map((p) => p.hasAttribute("hidden")),
    }
  }

  it("lar et klikk stå etter at observatøren har kjørt", async () => {
    /*
     * Klikket ble angret i neste mikrotask: `repair()` leste serverens gamle
     * ord fra minnet. En test som leser rett etter klikket ser det ikke, så
     * denne venter på tegningen først.
     */
    monter(FIRE)
    await tegn()

    document.querySelectorAll<HTMLElement>("fs-tabs a")[1].click()
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "true"],
      skjult: [true, false],
    })
  })

  it("lar serveren flytte valget etter klikket", async () => {
    monter(FIRE)
    await tegn()
    const p = paneler()

    document.querySelectorAll<HTMLElement>("fs-tabs a")[1].click()
    await ventPaTegning()

    // Serveren sender den første fanen igjen, og rører bare panelene.
    p[0].removeAttribute("hidden")
    p[1].setAttribute("hidden", "")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["true", "false"],
      skjult: [false, true],
    })
  })

  /** Tre faner: med to er «tilbake til den første» også det gale svaret. */
  const TRE = `
    <fs-tabs server-controlled>
      <ul class="fs-tabs__list" aria-label="Deler av saken">
        <li><a href="#soknaden">Søknaden</a></li>
        <li><a href="#vedlegg">Vedlegg</a></li>
        <li><a href="#meldinger">Meldinger</a></li>
      </ul>
      <section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>
      <section class="fs-tabs__panel" id="vedlegg" hidden><h2>Vedlegg</h2></section>
      <section class="fs-tabs__panel" id="meldinger" hidden><h2>Meldinger</h2></section>
    </fs-tabs>`

  async function klikkAndre() {
    monter(TRE)
    await tegn()
    document.querySelectorAll<HTMLElement>("fs-tabs a")[1].click()
    await ventPaTegning()
    return {
      lenker: [...document.querySelectorAll<HTMLElement>("fs-tabs a")],
      paneler: paneler(),
    }
  }

  it("følger serveren til en tredje fane, ikke tilbake til den første", async () => {
    const { paneler: p } = await klikkAndre()

    // Serveren svarer med den tredje, og rører bare panelene.
    p[1].setAttribute("hidden", "")
    p[2].removeAttribute("hidden")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "false", "true"],
      skjult: [true, true, false],
    })
  })

  it("følger serveren når den flytter aria-selected til en tredje fane", async () => {
    const { lenker } = await klikkAndre()

    lenker[1].setAttribute("aria-selected", "false")
    lenker[2].setAttribute("aria-selected", "true")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "false", "true"],
      skjult: [true, true, false],
    })
  })

  it("følger serveren også etter at en fane kom til mens klikket ventet", async () => {
    const { paneler: p } = await klikkAndre()
    const vert = document.querySelector("fs-tabs") as HTMLElement

    // En patch legger til en fjerde fane. Den har ikke sagt noe om valget.
    vert
      .querySelector(".fs-tabs__list")
      ?.insertAdjacentHTML(
        "beforeend",
        '<li><a href="#historikk">Historikk</a></li>',
      )
    vert.insertAdjacentHTML(
      "beforeend",
      '<section class="fs-tabs__panel" id="historikk" hidden><h2>Historikk</h2></section>',
    )
    await ventPaTegning()
    expect(tilstand().valgt).toEqual(["false", "true", "false", "false"])

    // Så flytter serveren til den tredje, med bare `hidden`.
    p[1].setAttribute("hidden", "")
    p[2].removeAttribute("hidden")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "false", "true", "false"],
      skjult: [true, true, false, true],
    })
  })

  it("står på den klikkede fanen når serveren bekrefter den med bar markup", async () => {
    /*
     * Morfingen river `aria-selected` av fanene, siden serverens markup ikke
     * har den, og lar panelene stå: de er alt slik serveren sendte dem.
     * Serverens gamle ord om panelene vant da, og raden hoppet tilbake.
     */
    const { lenker } = await klikkAndre()

    for (const lenke of lenker) lenke.removeAttribute("aria-selected")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "true", "false"],
      skjult: [true, false, true],
    })
  })

  it("lar adressen være, så serveren bestemmer", async () => {
    history.replaceState(null, "", "#meldinger")
    monter(TRE)
    await tegn()

    expect(tilstand().valgt).toEqual(["true", "false", "false"])
  })
})

describe("fs-tabs når en patch rører panelene og lenkene", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  it("gir et nytt panel med den samme id-en rollen, navnet og hidden", async () => {
    monter(BAR)
    await tegn()
    const gammelt = document.getElementById("vedlegg") as HTMLElement

    const nytt = document.createElement("section")
    nytt.className = "fs-tabs__panel"
    nytt.id = "vedlegg"
    nytt.innerHTML = "<h2>Nye vedlegg</h2>"
    gammelt.replaceWith(nytt)
    await ventPaTegning()

    expect(nytt.getAttribute("role")).toBe("tabpanel")
    expect(
      nytt.hasAttribute("hidden"),
      "panelet til en fane som ikke er valgt står synlig",
    ).toBe(true)
    // Overskriften sier noe annet enn fanen, så panelet heter det fanen heter.
    expect(nytt.getAttribute("aria-label")).toBe("Vedlegg")
  })

  it("følger markupen når patchen bytter ut lenkene", async () => {
    /*
     * Valget er knyttet til selve lenken og overlever bare en morfing som
     * beholder nodene. `innerHTML` og htmx' vanlige bytte lager nye noder, og
     * da gjelder det markupen sier, og ellers adressen.
     */
    const bar = BAR.slice(BAR.indexOf(">") + 1, BAR.lastIndexOf("<"))
    monter(BAR)
    await tegn()
    const vert = document.querySelector("fs-tabs") as FsTabs
    faner()[1].click()
    await ventPaTegning()
    expect(vert.selected).toBe(1)
    expect(location.hash).toBe("#vedlegg")

    // Ingen fane markert av serveren: adressen sier hvor brukeren var.
    vert.innerHTML = bar
    await ventPaTegning()
    expect(vert.selected).toBe(1)

    // Serveren markerer en fane selv, og den vinner over adressen.
    vert.innerHTML = bar
      .replace(
        '<a href="#soknaden">',
        '<a href="#soknaden" aria-selected="true">',
      )
      .replace('id="vedlegg"', 'id="vedlegg" hidden')
    await ventPaTegning()
    expect(vert.selected).toBe(0)

    // Ingenting i adressen heller: den første.
    history.replaceState(null, "", location.pathname + location.search)
    vert.innerHTML = bar
    await ventPaTegning()
    expect(vert.selected).toBe(0)
    expect(faner()[0].getAttribute("aria-selected")).toBe("true")
  })

  it("sier fra og lar de andre panelene være når ett er fjernet", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      monter(BAR)
      await tegn()
      const lenker = faner()
      const p = paneler()

      p[1].remove()
      await tegn()
      await tegn()

      expect(lenker[2].getAttribute("aria-controls")).toBe("meldinger")
      expect(p[2].getAttribute("role")).toBe("tabpanel")
      expect(
        advarsel.mock.calls.some((k) =>
          String(k[0]).includes("har faner uten et panel"),
        ),
      ).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it("lar nettleserens egne snarveier med Alt og Cmd være", async () => {
    monter(BAR)
    await tegn()
    faner()[0].focus()

    for (const modifikator of ["altKey", "metaKey", "ctrlKey"] as const) {
      const trykk = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        [modifikator]: true,
        bubbles: true,
        cancelable: true,
      })
      faner()[0].dispatchEvent(trykk)

      expect(trykk.defaultPrevented, modifikator).toBe(false)
      expect(faner()[0].getAttribute("aria-selected"), modifikator).toBe("true")
    }
  })
})

describe("fs-tabs som lenker", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  it("skriver valget i adressen uten å hoppe, og uten ny historikkoppføring", async () => {
    monter(fraByggefunksjonen())
    await tegn()
    const lengde = history.length

    const klikk = new MouseEvent("click", { bubbles: true, cancelable: true })
    faner()[1].dispatchEvent(klikk)
    await tegn()

    expect(klikk.defaultPrevented).toBe(true)
    expect(location.hash).toBe("#sak-vedlegg")
    expect(history.length).toBe(lengde)
    expect(valgt()).toEqual([false, true, false])
  })

  it("velger fanen selv om adressen ikke lar seg skrive", async () => {
    // Safari kaster etter hundre kall på ti sekunder. Kastet stoppet klikket
    // før fanen ble valgt.
    monter(fraByggefunksjonen())
    await tegn()
    const skriv = vi.spyOn(history, "replaceState").mockImplementation(() => {
      throw new DOMException("For mange kall", "SecurityError")
    })
    try {
      faner()[1].click()
      await tegn()

      expect(skriv).toHaveBeenCalled()
      expect(valgt()).toEqual([false, true, false])
    } finally {
      skriv.mockRestore()
    }
  })

  it("lar nettleseren åpne lenken når en modifikator er holdt nede", async () => {
    monter(fraByggefunksjonen())
    await tegn()
    const lenke = faner()[1]

    // Lytteren på lenken kommer etter komponentens, og hindrer at testen
    // faktisk navigerer.
    let forhindret: boolean | undefined
    lenke.addEventListener("click", (hendelse) => {
      forhindret = hendelse.defaultPrevented
      hendelse.preventDefault()
    })
    lenke.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    )
    await tegn()

    expect(forhindret).toBe(false)
    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("")
  })

  it("velger fanen adressen peker på ved lasting", async () => {
    history.replaceState(null, "", "#sak-vedlegg")
    monter(fraByggefunksjonen())
    await tegn()

    expect(valgt()).toEqual([false, true, false])
    expect(skjult()).toEqual([true, false, true])
  })

  it("velger fanen når adressen endrer seg", async () => {
    monter(fraByggefunksjonen())
    await tegn()

    history.replaceState(null, "", "#sak-meldinger")
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("velger fanen på beforematch", async () => {
    monter(BAR)
    await tegn()

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("lar et panel skjult med until-found ta ingen plass", async () => {
    // Et skjult panel beholder boksen sin, så luften rundt innholdet må
    // nulles, ellers står det et tomt felt under det valgte panelet.
    monter(BAR)
    await tegn()

    const høyder = paneler().map((p) => p.getBoundingClientRect().height)

    expect(høyder[0]).toBeGreaterThan(0)
    expect(høyder[1]).toBe(0)
    expect(høyder[2]).toBe(0)
  })

  it("skjuler panelene i den samme formen i hele raden", async () => {
    // Serveren skjuler med `hidden=""`. Det første panelet var aldri skjult av
    // serveren, men får samme form som de andre når det skjules.
    monter(
      BAR.replace('id="vedlegg"', 'id="vedlegg" hidden').replace(
        'id="meldinger"',
        'id="meldinger" hidden',
      ),
    )
    await tegn()

    faner()[1].click()
    await tegn()

    expect(paneler().map((p) => p.getAttribute("hidden"))).toEqual([
      "",
      null,
      "",
    ])
  })

  it("flytter bare fokus med piltastene ved manuell aktivering, og velger med mellomrom", async () => {
    monter(fraByggefunksjonen(FANER, ' activation="manual"'))
    await tegn()
    faner()[0].focus()

    tast(faner()[0], "ArrowRight")
    await tegn()
    expect(document.activeElement).toBe(faner()[1])
    expect(valgt()).toEqual([true, false, false])

    const mellomrom = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
    faner()[1].dispatchEvent(mellomrom)
    await tegn()

    expect(mellomrom.defaultPrevented).toBe(true)
    expect(valgt()).toEqual([false, true, false])
  })

  it("velger med en gang som standard", async () => {
    monter(fraByggefunksjonen())
    await tegn()
    faner()[0].focus()

    tast(faner()[0], "ArrowRight")
    await tegn()

    expect(valgt()).toEqual([false, true, false])
  })
})

describe("fs-tabs etter morfing og med piltaster", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  const FEM = tabs({
    id: "s",
    keys: ["a", "b", "c"],
    label: "Saken",
  })
  const lenker = () =>
    FEM.tabs
      .map((fane, i) => `<li><a ${attr(fane)}>Fane ${i}</a></li>`)
      .join("")

  async function monterFaner() {
    monter(`
      <fs-tabs>
        <ul ${attr(FEM.list)}>${lenker()}</ul>
        ${FEM.panels
          .map(
            (panel, i) =>
              `<section ${attr(panel)}><h2 ${attr(FEM.headings[i])}>Panel ${i}</h2></section>`,
          )
          .join("")}
      </fs-tabs>`)
    await tegn()
    return document.querySelector("fs-tabs") as HTMLElement
  }

  it("virker på faner en morfing har byttet ut", async () => {
    // Én lytter på verten. Før fikk hver ny fane sine egne lyttere, og de
    // gamle ble holdt fast i minnet.
    const vert = await monterFaner()
    const rad = vert.querySelector(".fs-tabs__list") as HTMLElement
    for (let gang = 0; gang < 3; gang++) {
      rad.innerHTML = lenker()
      await ventPaTegning()
    }

    faner()[2].click()
    await ventPaTegning()
    expect(
      (document.getElementById("s-c") as HTMLElement).hasAttribute("hidden"),
    ).toBe(false)

    faner()[2].focus()
    tast(faner()[2], "ArrowRight")
    await ventPaTegning()
    expect(document.activeElement).toBe(faner()[0])
  })

  it("virker selv om noe på raden stopper hendelsene", async () => {
    // Lytteren sitter på verten. Uten fangstfasen nådde ikke klikk og
    // piltaster fram når raden hadde en lytter som stoppet dem.
    const vert = await monterFaner()
    const rad = vert.querySelector(".fs-tabs__list") as HTMLElement
    rad.addEventListener("keydown", (event) => event.stopPropagation())
    rad.addEventListener("click", (event) => event.stopPropagation())

    faner()[0].focus()
    tast(faner()[0], "ArrowRight")
    await ventPaTegning()
    expect(document.activeElement).toBe(faner()[1])

    faner()[2].click()
    await ventPaTegning()
    expect(
      (document.getElementById("s-c") as HTMLElement).hasAttribute("hidden"),
    ).toBe(false)
  })

  it("lar pil ned være i en vannrett rad", async () => {
    // Før flyttet den fokus, og stjal siderullingen.
    await monterFaner()
    const forste = faner()[0]
    forste.focus()
    const trykk = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })

    forste.dispatchEvent(trykk)
    await ventPaTegning()

    expect(document.activeElement).toBe(forste)
    expect(trykk.defaultPrevented).toBe(false)
  })

  it("bruker pil ned i en loddrett rad", async () => {
    const vert = await monterFaner()
    vert
      .querySelector("[role='tablist']")
      ?.setAttribute("aria-orientation", "vertical")
    faner()[0].focus()

    tast(faner()[0], "ArrowDown")
    await ventPaTegning()

    expect(document.activeElement).toBe(faner()[1])
  })
})
