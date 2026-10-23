/// <reference path="../../../types/css.d.ts" />
/// <reference types="@vitest/browser-playwright" />

/**
 * Kravene til fanene, ett krav per test, med kravets nummer i navnet.
 *
 * Kravene står i `krav-faner.md` i utredningen, med kilde for hvert. Krav som
 * alt har en test som kan feile, står i `fs-tabs.browser.test.ts` og
 * `fs-tabs-morph.browser.test.ts`. Siden uten JavaScript prøves i
 * `scripts/sjekk-uten-javascript.ts`, siden Vitest selv er et skript.
 */

import axe from "axe-core"
import { createElement as h } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { cdp, server, userEvent } from "vitest/browser"

import { fs as fsReact } from "../../../react"
import { monter, ventPaTegning } from "../../../testing/a11y"
import { settAdresse } from "../../../testing/adresse"
import { rgb } from "../../../testing/farge"
import { attr } from "../../../testing/markup"
import { contrastRatio } from "../../../tokens/color"
import { defineFsTabs, FsTabs } from "./fs-tabs"
import { tabs } from "./tabs"

import "../../../tokens/tokens.css"
import "./tabs.css"

const NAVN = ["Søknaden", "Vedlegg", "Meldinger"]
const NOKLER = ["soknaden", "vedlegg", "meldinger"]

type Bar = {
  vert?: string
  liste?: string
  overskrift?: (i: number) => string | null
  lenke?: (i: number) => string
  panel?: (i: number) => string
  inni?: (i: number) => string
}

/** Fanene slik en mal skriver dem for hånd: lenker, og id bare på panelene. */
function bar(valg: Bar = {}): string {
  const overskrift = valg.overskrift ?? ((i) => NAVN[i])
  return `
    <fs-tabs${valg.vert ?? ""}>
      <ul class="fs-tabs__list"${valg.liste ?? ' aria-label="Deler av saken"'}>
        ${NAVN.map((n, i) => `<li><a href="#${NOKLER[i]}"${valg.lenke?.(i) ?? ""}>${n}</a></li>`).join("")}
      </ul>
      ${NAVN.map((_, i) => {
        const tittel = overskrift(i)
        return `<section class="fs-tabs__panel" id="${NOKLER[i]}"${valg.panel?.(i) ?? ""}>${tittel === null ? "" : `<h2>${tittel}</h2>`}<p id="inne-${NOKLER[i]}">Innholdet i ${NAVN[i].toLowerCase()}.</p>${valg.inni?.(i) ?? ""}</section>`
      }).join("")}
    </fs-tabs>`
}

/** Det `fs.tabs()` skriver, satt sammen slik en mal gjør det. */
function fraByggefunksjonen(): string {
  const f = tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
  return `
    <fs-tabs>
      <ul ${attr(f.list)}>
        ${f.tabs.map((t, i) => `<li><a ${attr(t)}>${NAVN[i]}</a></li>`).join("")}
      </ul>
      ${f.panels.map((p, i) => `<section ${attr(p)}><h2 ${attr(f.headings[i])}>${NAVN[i]}</h2><p>Innholdet i ${NAVN[i].toLowerCase()}.</p></section>`).join("")}
    </fs-tabs>`
}

const vert = () => document.querySelector("fs-tabs") as FsTabs
const faner = () => [
  ...document.querySelectorAll<HTMLElement>("fs-tabs .fs-tabs__list a"),
]
const paneler = () => [
  ...document.querySelectorAll<HTMLElement>(".fs-tabs__panel"),
]
const valgt = () =>
  faner().map((f) => f.getAttribute("aria-selected") === "true")
const skjult = () => paneler().map((p) => p.hasAttribute("hidden"))

/**
 * Det utregnede navnet, etter AccName, slik en skjermleser får det.
 *
 * axe sine typer har ikke funksjonene som regner ut navnet fra treet, så de
 * typesettes her.
 */
const navneberegning = axe as unknown as {
  setup: (rot: Node) => void
  teardown: () => void
  utils: { getNodeFromTree: (e: Element) => unknown }
  commons: { text: { accessibleTextVirtual: (n: unknown) => string } }
}
function navn(element: Element): string {
  navneberegning.setup(document)
  try {
    return navneberegning.commons.text.accessibleTextVirtual(
      navneberegning.utils.getNodeFromTree(element),
    )
  } finally {
    navneberegning.teardown()
  }
}

/**
 * Tab, slik en tastaturbruker trykker den. WebKit på macOS hopper som Safari
 * over lenker med Tab, og der er det Alt+Tab som går til lenker.
 */
async function tab() {
  if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}")
  else await userEvent.tab()
}

async function tegn() {
  await customElements.whenDefined("fs-tabs")
  await ventPaTegning()
}

/**
 * Stopper `hashchange`, slik søk i siden gjør: nettleseren avdekker treffet
 * og sender `beforematch`, men endrer ikke adressen. Uten dette valgte
 * adressen fanen, og en test av `beforematch` kunne ikke feile.
 *
 * Kalles før `monter()`: Chromium kaller lytterne på `window` i den
 * rekkefølgen de ble lagt til, også en lytter i fangstfasen, så en stopper
 * lagt til etter komponentens stoppet ingenting der.
 */
function somSokISiden(): () => void {
  const stopp = (e: Event) => e.stopImmediatePropagation()
  window.addEventListener("hashchange", stopp, true)
  return () => window.removeEventListener("hashchange", stopp, true)
}

function lyttEtterAdvarsler() {
  return vi.spyOn(console, "warn").mockImplementation(() => {})
}

/** Advarslene som har kommet, når `warnAboutMarkup` har sjekket vilkåret sitt. */
async function advarsler(spion: ReturnType<typeof lyttEtterAdvarsler>) {
  await ventPaTegning()
  await ventPaTegning()
  return spion.mock.calls.map((k) => String(k[0]))
}

beforeAll(() => {
  defineFsTabs()
})

beforeEach(async () => {
  await settAdresse("")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("A. Tre tilstander av siden", () => {
  it("A6: registreringen gir markup fra fs.tabs() den samme tilstanden som håndskrevet markup, og endrer ingenting byggefunksjonen skrev", async () => {
    /** Attributtene som bærer fanene, uten id-er, som er ulike i de to kildene. */
    const tilstand = () =>
      [...document.querySelectorAll("fs-tabs, fs-tabs *")].map((e) =>
        [...e.attributes]
          .filter(
            (a) =>
              ![
                "id",
                "href",
                "aria-controls",
                "aria-labelledby",
                "class",
                "aria-label",
              ].includes(a.name),
          )
          .map((a) => `${a.name}=${a.value}`)
          .sort()
          .join(" "),
      )

    monter(bar({ overskrift: (i) => NAVN[i] }))
    await tegn()
    const forventet = tilstand()

    const omslag = document.createElement("div")
    omslag.innerHTML = fraByggefunksjonen()
    const skrevet = new Map<Element, Map<string, string | null>>()
    for (const e of omslag.querySelectorAll("*"))
      skrevet.set(e, new Map([...e.attributes].map((a) => [a.name, a.value])))
    const endret: string[] = []
    const observatør = new MutationObserver((poster) => {
      for (const p of poster) {
        const fra = skrevet.get(p.target as Element)
        if (p.attributeName && fra?.has(p.attributeName))
          endret.push(`${(p.target as Element).localName} ${p.attributeName}`)
      }
    })
    observatør.observe(omslag, { attributes: true, subtree: true })
    document.body.replaceChildren(omslag)
    await tegn()
    observatør.disconnect()

    expect(endret, "registreringen endret noe byggefunksjonen skrev").toEqual(
      [],
    )
    expect(tilstand()).toEqual(forventet)
  })

  /** En React-app som rendrer fanene med `fs.tabs()` fra React-inngangen. */
  const App = ({ teller }: { teller: number }) => {
    const f = fsReact.tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
    return h(
      "div",
      { "data-teller": teller },
      h(
        "fs-tabs",
        null,
        h(
          "ul",
          f.list,
          ...f.tabs.map((t, i) =>
            h("li", { ...f.item, key: NOKLER[i] }, h("a", t, NAVN[i])),
          ),
        ),
        ...f.panels.map((p, i) =>
          h(
            "section",
            { ...p, key: NOKLER[i] },
            h("h2", null, NAVN[i]),
            h("p", null, "Innhold"),
          ),
        ),
      ),
    )
  }

  it("A7: React hydrerer markup fra fs.tabs() i React-inngangen uten avvik, også når brukeren har byttet fane og React rendrer på nytt", async () => {
    const avvik: string[] = []
    const feil = vi.spyOn(console, "error").mockImplementation((...a) => {
      avvik.push(a.map(String).join(" "))
    })

    const flate = monter("")
    flate.innerHTML = renderToString(h(App, { teller: 0 }))
    await tegn()
    const rot = hydrateRoot(flate, h(App, { teller: 0 }), {
      onRecoverableError: (e) => avvik.push(String(e)),
    })
    await ventPaTegning()

    faner()[1].click()
    await tegn()
    rot.render(h(App, { teller: 1 }))
    await tegn()

    feil.mockRestore()
    expect(avvik).toEqual([])
    expect(valgt()).toEqual([false, true, false])
    expect(skjult()).toEqual([true, false, true])
    rot.unmount()
  })

  it("A7 med D11: React hydrerer uten avvik også når adressen peker på en annen fane", async () => {
    await settAdresse("#sak-vedlegg")
    const avvik: string[] = []
    const feil = vi.spyOn(console, "error").mockImplementation((...a) => {
      avvik.push(a.map(String).join(" "))
    })

    const flate = monter("")
    flate.innerHTML = renderToString(h(App, { teller: 0 }))
    await tegn()
    const rot = hydrateRoot(flate, h(App, { teller: 0 }), {
      onRecoverableError: (e) => avvik.push(String(e)),
    })
    await ventPaTegning()

    feil.mockRestore()
    expect(avvik).toEqual([])
    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("#sak-soknaden")
    rot.unmount()
  })

  it("A9: komponenten skriver ingenting på markup fra fs.tabs() i React-inngangen", async () => {
    const omslag = document.createElement("div")
    omslag.innerHTML = renderToString(h(App, { teller: 0 }))
    const poster: string[] = []
    const observatør = new MutationObserver((r) =>
      poster.push(
        ...r.map(
          (p) =>
            `${(p.target as Element).localName} ${p.attributeName ?? p.type}`,
        ),
      ),
    )
    observatør.observe(omslag, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    document.body.replaceChildren(omslag)
    await tegn()
    observatør.disconnect()

    expect(poster).toEqual([])
  })
})

describe("B. Semantikk og navn", () => {
  it("B5: en fane med bare ikon gir panelet navnet fra aria-label, uten skjult tekst", async () => {
    monter(
      bar({ overskrift: () => null })
        .replace(
          '<a href="#vedlegg">Vedlegg</a>',
          '<a href="#vedlegg" aria-label="Vedlegg"><svg aria-hidden="true" width="16" height="16"></svg></a>',
        )
        .replace(
          '<a href="#meldinger">Meldinger</a>',
          '<a href="#meldinger">Meldinger<span aria-hidden="true"> (3)</span></a>',
        ),
    )
    await tegn()

    expect(paneler().map(navn)).toEqual(NAVN)
  })

  it("B6: panelet heter det samme som fanen, også når overskriften sier noe annet", async () => {
    monter(
      bar({
        overskrift: (i) => (i === 1 ? "Dokumenter du har lastet opp" : NAVN[i]),
      }),
    )
    await tegn()

    expect(paneler().map(navn)).toEqual(faner().map(navn))
  })

  it("B7: en aria-labelledby serveren skrev endres ikke, også når den peker på noe som kommer senere", async () => {
    monter(
      bar({
        panel: (i) => (i === 1 ? ' aria-labelledby="kommer-senere"' : ""),
      }),
    )
    await tegn()
    const panel = paneler()[1]

    expect(panel.getAttribute("aria-labelledby")).toBe("kommer-senere")

    panel.insertAdjacentHTML("beforebegin", '<p id="kommer-senere">Vedlegg</p>')
    await tegn()

    expect(panel.getAttribute("aria-labelledby")).toBe("kommer-senere")
    expect(navn(panel)).toBe("Vedlegg")
  })

  it("B8: navnet følger med når teksten på fanen endres i tekstnoden, slik idiomorph gjør det", async () => {
    monter(bar({ overskrift: () => null }))
    await tegn()

    ;(faner()[1].firstChild as Text).nodeValue = "Vedlegg (2)"
    await tegn()

    expect(navn(paneler()[1])).toBe("Vedlegg (2)")
  })

  /*
   * Hver rad bytter ut den andre fanen, overskriften i panelet dens og det
   * som står utenfor raden. Navnene regnes ut av axe, slik en skjermleser
   * gjør, og panelet skal hete det samme som fanen (B5, B6, D7).
   */
  const NAVNEVARIANTER: Array<{
    hva: string
    lenke: string
    overskrift: string
    utenfor?: string
    navn: string
  }> = [
    {
      hva: "tekst",
      lenke: "Vedlegg",
      overskrift: "<h2>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "uten overskrift",
      lenke: "Vedlegg",
      overskrift: "",
      navn: "Vedlegg",
    },
    {
      hva: "overskrift med annen tekst",
      lenke: "Vedlegg",
      overskrift: "<h2>Bilag</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "skjult overskrift",
      lenke: "Vedlegg",
      overskrift: "<h2 hidden>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "overskrift med aria-label lik fanen",
      lenke: "Vedlegg",
      overskrift: '<h2 aria-label="Vedlegg">Bilag</h2>',
      navn: "Vedlegg",
    },
    {
      hva: "overskrift med aria-label ulik fanen",
      lenke: "Vedlegg",
      overskrift: '<h2 aria-label="Noe annet">Vedlegg</h2>',
      navn: "Vedlegg",
    },
    {
      // Peker panelet på overskriften, følges ikke overskriftens egen
      // `aria-labelledby`, og panelet heter «Bilag».
      hva: "overskrift med aria-labelledby",
      lenke: "Vedlegg",
      overskrift: '<h2 aria-labelledby="ov-navn">Bilag</h2>',
      utenfor: '<span id="ov-navn">Vedlegg</span>',
      navn: "Vedlegg",
    },
    {
      hva: "tekst skjult med CSS",
      lenke: 'Vedlegg<span style="display: none"> (2)</span>',
      overskrift: "",
      navn: "Vedlegg",
    },
    {
      hva: "tekst med aria-hidden",
      lenke: 'Vedlegg<span aria-hidden="true"> (2)</span>',
      overskrift: "<h2>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "bilde med alt",
      lenke: '<img alt="Vedlegg" width="1" height="1">',
      overskrift: "<h2>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "aria-label på et barn",
      lenke: '<span role="img" aria-label="Vedlegg">📎</span>',
      overskrift: "",
      navn: "Vedlegg",
    },
    {
      // AccName 2B gjelder også et barn av fanen.
      hva: "aria-labelledby på et barn, mot et skjult element",
      lenke:
        '<svg role="img" aria-labelledby="ikon-navn" width="16" height="16"></svg>',
      overskrift: "",
      utenfor: '<span id="ikon-navn" hidden>Bilag</span>',
      navn: "Bilag",
    },
    {
      hva: "aria-labelledby på fanen, mot et skjult element",
      lenke: "Vedlegg",
      overskrift: "",
      utenfor: '<span id="fane-navn" hidden>Bilag</span>',
      navn: "Bilag",
    },
    {
      // Inni en `aria-labelledby` som alt følges, følges ikke en til.
      hva: "aria-labelledby inni aria-labelledby",
      lenke: "Vedlegg",
      overskrift: "",
      utenfor:
        '<span id="fane-navn"><span role="img" aria-labelledby="dypere">Bilag</span></span><span id="dypere">Feil</span>',
      navn: "Bilag",
    },
  ]

  for (const v of NAVNEVARIANTER) {
    it(`B5 og B6: panelet heter det fanen heter, ${v.hva}`, async () => {
      const lenkeAttr = v.utenfor?.includes('id="fane-navn"')
        ? ' aria-labelledby="fane-navn"'
        : ""
      monter(
        `${v.utenfor ?? ""}${bar()
          .replace(
            '<a href="#vedlegg">Vedlegg</a>',
            `<a href="#vedlegg"${lenkeAttr}>${v.lenke}</a>`,
          )
          .replace("<h2>Vedlegg</h2>", v.overskrift)}`,
      )
      await tegn()

      expect(navn(faner()[1])).toBe(v.navn)
      expect(navn(paneler()[1])).toBe(v.navn)
    })
  }

  it("B6: overskriften er navnet bare når navnet dens er det samme som fanens", async () => {
    monter(
      bar().replace(
        "<h2>Vedlegg</h2>",
        '<h2 aria-label="Noe helt annet">Vedlegg</h2>',
      ),
    )
    await tegn()

    expect(paneler().map(navn)).toEqual(NAVN)
  })

  it("B5: en fane med aria-labelledby mot et skjult element heter det elementet sier", async () => {
    monter(
      `<span id="skjult-navn" hidden>Bilag</span>${bar({
        overskrift: () => null,
      }).replace(
        '<a href="#vedlegg">',
        '<a href="#vedlegg" aria-labelledby="skjult-navn">',
      )}`,
    )
    await tegn()

    expect(navn(paneler()[1])).toBe("Bilag")
  })

  it("B5: tekst skjult med CSS og en fane med bare title", async () => {
    monter(
      bar({ overskrift: () => null })
        .replace(
          '<a href="#vedlegg">Vedlegg</a>',
          '<a href="#vedlegg">Vedlegg<span style="display: none"> (2)</span></a>',
        )
        .replace(
          '<a href="#meldinger">Meldinger</a>',
          '<a href="#meldinger" title="Meldinger"><svg aria-hidden="true" width="16" height="16"></svg></a>',
        ),
    )
    await tegn()

    expect(paneler().map(navn)).toEqual(NAVN)
  })

  it("B8: navnet følger med når teksten i overskriften endres", async () => {
    monter(bar())
    await tegn()
    expect(navn(paneler()[1])).toBe("Vedlegg")

    // Slik idiomorph gjør det: bare tekstnoden endres.
    const tekst = paneler()[1].querySelector("h2")?.firstChild as Text
    tekst.nodeValue = "Bilag"
    await tegn()

    // Overskriften sier ikke lenger det fanen sier, så panelet heter det
    // fanen heter.
    expect(navn(paneler()[1])).toBe("Vedlegg")
  })

  it("B8: navnet følger med når teksten aria-labelledby peker på inni et panel, endres", async () => {
    monter(
      bar({ overskrift: () => null })
        .replace(
          '<a href="#vedlegg">',
          '<a href="#vedlegg" aria-labelledby="sent-navn">',
        )
        .replace(
          '<p id="inne-soknaden">',
          '<p id="inne-soknaden"><span id="sent-navn" hidden><b>Bilag</b></span>',
        ),
    )
    await tegn()
    expect(navn(paneler()[1])).toBe("Bilag")

    // Teksten står inni elementet id-en peker på, ikke rett i det.
    const tekst = document.querySelector("#sent-navn b")?.firstChild as Text
    tekst.nodeValue = "Dokumenter"
    await tegn()

    expect(navn(paneler()[1])).toBe("Dokumenter")
  })

  it("B8: det samme når aria-labelledby står på et barn av fanen", async () => {
    monter(
      bar({ overskrift: () => null })
        .replace(
          '<a href="#vedlegg">Vedlegg</a>',
          '<a href="#vedlegg"><svg role="img" aria-labelledby="sent-navn" width="16" height="16"></svg></a>',
        )
        .replace(
          '<p id="inne-soknaden">',
          '<p id="inne-soknaden"><span id="sent-navn" hidden>Bilag</span>',
        ),
    )
    await tegn()
    expect(navn(paneler()[1])).toBe("Bilag")

    const tekst = document.getElementById("sent-navn")?.firstChild as Text
    tekst.nodeValue = "Dokumenter"
    await tegn()

    expect(navn(paneler()[1])).toBe("Dokumenter")
  })

  it("B7: reserven tas bort når elementet serverens aria-labelledby peker på, kommer inni et panel", async () => {
    monter(
      bar({
        overskrift: () => null,
        panel: (i) => (i === 1 ? ' aria-labelledby="sent-navn"' : ""),
      }),
    )
    await tegn()
    expect(paneler()[1].getAttribute("aria-label")).toBe("Vedlegg")

    const dypt = document.getElementById("inne-soknaden") as HTMLElement
    dypt.insertAdjacentHTML("beforeend", '<span id="sent-navn">Vedlegg</span>')
    await tegn()

    expect(paneler()[1].hasAttribute("aria-label")).toBe(false)
    expect(paneler()[1].getAttribute("aria-labelledby")).toBe("sent-navn")
  })

  it("B8: navnet følger med når elementet aria-labelledby peker på, kommer inni et panel", async () => {
    monter(
      bar({ overskrift: () => null }).replace(
        '<a href="#vedlegg">',
        '<a href="#vedlegg" aria-labelledby="sent-navn">',
      ),
    )
    await tegn()
    expect(navn(paneler()[1])).toBe("Vedlegg")

    const dypt = document.getElementById("inne-soknaden") as HTMLElement
    dypt.insertAdjacentHTML(
      "beforeend",
      '<span hidden><span id="sent-navn">Bilag</span></span>',
    )
    await tegn()

    expect(navn(paneler()[1])).toBe("Bilag")
  })

  it("B8: navnet følger med når et element inni et panel får id-en aria-labelledby peker på", async () => {
    monter(
      bar({ overskrift: () => null })
        .replace(
          '<a href="#vedlegg">',
          '<a href="#vedlegg" aria-labelledby="sent-navn">',
        )
        .replace(
          '<p id="inne-soknaden">',
          '<p id="inne-soknaden"><span id="ennå-ikke" hidden>Bilag</span>',
        ),
    )
    await tegn()
    expect(navn(paneler()[1])).toBe("Vedlegg")

    document.getElementById("ennå-ikke")?.setAttribute("id", "sent-navn")
    await tegn()

    expect(navn(paneler()[1])).toBe("Bilag")
  })

  it("D7: overskriften blir navnet når teksten dens endres til fanens", async () => {
    monter(bar({ overskrift: (i) => (i === 1 ? "Bilag" : NAVN[i]) }))
    await tegn()
    expect(paneler()[1].getAttribute("aria-label")).toBe("Vedlegg")

    const overskrift = paneler()[1].querySelector("h2") as HTMLElement
    ;(overskrift.firstChild as Text).nodeValue = "Vedlegg"
    await tegn()

    expect(paneler()[1].hasAttribute("aria-label")).toBe(false)
    expect(paneler()[1].getAttribute("aria-labelledby")).toBe(overskrift.id)
  })

  it("B8: navnet følger med når elementet aria-labelledby peker på, mister id-en sin inni et panel", async () => {
    monter(
      bar({ overskrift: () => null })
        .replace(
          '<a href="#vedlegg">',
          '<a href="#vedlegg" aria-labelledby="sent-navn">',
        )
        .replace(
          '<p id="inne-soknaden">',
          '<p id="inne-soknaden"><span id="sent-navn" hidden>Bilag</span>',
        ),
    )
    await tegn()
    expect(navn(paneler()[1])).toBe("Bilag")

    document.getElementById("sent-navn")?.setAttribute("id", "noe-annet")
    await tegn()

    expect(navn(paneler()[1])).toBe("Vedlegg")
  })

  it("B8: navnet følger med når alt på et bilde i fanen endres", async () => {
    monter(
      bar({ overskrift: () => null }).replace(
        '<a href="#vedlegg">Vedlegg</a>',
        '<a href="#vedlegg"><img alt="Vedlegg" width="1" height="1"></a>',
      ),
    )
    await tegn()

    ;(faner()[1].querySelector("img") as HTMLElement).setAttribute(
      "alt",
      "Bilag",
    )
    await tegn()

    expect(navn(paneler()[1])).toBe("Bilag")
  })

  it("B9: komponenten sier fra når raden mangler navn", async () => {
    const spion = lyttEtterAdvarsler()
    monter(bar({ liste: "" }))
    await tegn()

    expect((await advarsler(spion)).some((m) => m.includes("aria-label"))).toBe(
      true,
    )
  })

  it("B9: komponenten sier ikke fra når raden har navn", async () => {
    const spion = lyttEtterAdvarsler()
    monter(bar())
    await tegn()

    expect(
      (await advarsler(spion)).filter((m) => m.startsWith("fs-tabs")),
    ).toEqual([])
  })

  it("B9 og D8: fs.tabs() kaster når label mangler eller er tom", () => {
    // Hardt mellomrom og BOM er mellomrom for JavaScript, og for Kotlin bare
    // når den sjekker på samme måte.
    for (const label of [undefined, "", "   ", "\u00a0\ufeff"]) {
      for (const bygg of [tabs, fsReact.tabs]) {
        expect(() =>
          bygg({ id: "uten-navn", keys: ["a"], label } as never),
        ).toThrow(/label/)
      }
    }
  })

  it("I1: label sjekkes før keys, som i Kotlin", () => {
    expect(() => tabs({ id: "x", keys: [""], label: "" })).toThrow(/label/)
  })
})

describe("C. Tastatur og fokus", () => {
  const rundt = (innhold: string) =>
    `<button type="button" id="foer">Før</button>${innhold}<button type="button" id="etter">Etter</button>`

  it("C1: Tab inn i raden lander på den valgte fanen, og Tab videre går til det valgte panelet", async () => {
    monter(rundt(bar()))
    await tegn()
    faner()[1].click()
    await tegn()
    ;(document.getElementById("foer") as HTMLElement).focus()

    await tab()
    expect(document.activeElement).toBe(faner()[1])
    await tab()
    expect(document.activeElement).toBe(paneler()[1])
  })

  it("C2: ingenting i et panel som ikke er valgt, kan nås med Tab, heller ikke panelet selv", async () => {
    monter(
      rundt(
        bar({
          inni: (i) =>
            `<button type="button" id="knapp-${NOKLER[i]}">Gjør noe</button>`,
        }),
      ),
    )
    await tegn()
    ;(document.getElementById("foer") as HTMLElement).focus()

    const besokt: Element[] = []
    for (let i = 0; i < 10 && document.activeElement?.id !== "etter"; i++) {
      await tab()
      if (document.activeElement) besokt.push(document.activeElement)
    }

    const iSkjulte = besokt.filter((e) =>
      paneler().some(
        (p) => p.hasAttribute("hidden") && (p === e || p.contains(e)),
      ),
    )
    expect(iSkjulte.map((e) => e.id || e.localName)).toEqual([])
    expect(besokt[besokt.length - 1]?.id).toBe("etter")
  })

  it("C3: venstrepil går rundt fra første til siste", async () => {
    monter(bar())
    await tegn()
    faner()[0].focus()

    await userEvent.keyboard("{ArrowLeft}")
    await tegn()

    expect(document.activeElement).toBe(faner()[2])
    expect(valgt()).toEqual([false, false, true])
  })

  it("C7: Enter velger ved manuell aktivering", async () => {
    monter(bar({ vert: ' activation="manual"' }))
    await tegn()
    faner()[0].focus()

    await userEvent.keyboard("{ArrowRight}")
    expect(valgt()).toEqual([true, false, false])
    await userEvent.keyboard("{Enter}")
    await tegn()

    expect(valgt()).toEqual([false, true, false])
  })

  it("C8: en fane med hidden hoppes over av piltastene og får aldri tabbestoppet", async () => {
    monter(
      rundt(bar().replace('<a href="#vedlegg">', '<a href="#vedlegg" hidden>')),
    )
    await tegn()
    faner()[0].focus()

    await userEvent.keyboard("{ArrowRight}")
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(faner().map((f) => f.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "0",
    ])
    expect(document.activeElement).toBe(faner()[2])
  })

  it("C10: fokus synes på fanen og på panelet", async () => {
    monter(rundt(bar()))
    await tegn()
    ;(document.getElementById("foer") as HTMLElement).focus()

    for (const element of [faner()[0], paneler()[0]]) {
      await tab()
      expect(document.activeElement).toBe(element)
      const stil = getComputedStyle(element)
      expect(stil.outlineStyle, element.localName).not.toBe("none")
      expect(
        Number.parseFloat(stil.outlineWidth),
        element.localName,
      ).toBeGreaterThanOrEqual(2)
    }
  })
})

describe("D. Mus og lenker", () => {
  it("D2: et ekte midtklikk velger ikke fanen", async () => {
    monter(bar())
    await tegn()
    const lenke = faner()[1]
    let klikk = 0
    lenke.addEventListener("click", () => klikk++)
    // Et midtklikk åpner lenken i en ny fane. I testen ville den nye fanen
    // lastet Vitests testside, som sender meldinger kjøringen ikke kjenner,
    // og WebKit navigerer i samme side i stedet. Nettleserens handling
    // stoppes, så testen spør bare om komponenten. Lytteren står på `window`
    // og kjører sist, så den ser om noe før den har stoppet lenken.
    let stoppet: boolean | undefined
    const stopp = (e: Event) => {
      stoppet = e.defaultPrevented
      e.preventDefault()
    }
    window.addEventListener("auxclick", stopp)
    try {
      await userEvent.click(lenke, { button: "middle" } as never)
      await tegn()
    } finally {
      window.removeEventListener("auxclick", stopp)
    }

    expect(stoppet).toBe(false)
    expect(klikk).toBe(0)
    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("")
  })

  it('D3: en role="tab" uten href er ikke en fane, og komponenten sier fra', async () => {
    const spion = lyttEtterAdvarsler()
    monter(
      bar().replace(
        "</ul>",
        '<li><button type="button" role="tab" aria-controls="soknaden" id="uten-href">Annet</button></li></ul>',
      ),
    )
    await tegn()
    const knapp = document.getElementById("uten-href") as HTMLElement

    expect(knapp.hasAttribute("aria-selected")).toBe(false)
    expect(knapp.hasAttribute("tabindex")).toBe(false)
    expect((await advarsler(spion)).some((m) => m.includes("href"))).toBe(true)
  })
})

describe("E. Adressen og søk i siden", () => {
  it("E1: en adresse til noe inni et panel velger den fanen ved lasting", async () => {
    await settAdresse("#inne-meldinger")
    monter(bar())
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(location.hash).toBe("#inne-meldinger")
  })

  /** Raden med en fane til, som peker på et panel som ikke finnes. */
  const medFaneUtenPanel = (markup: string) =>
    markup.replace(
      '<li><a href="#vedlegg">',
      '<li><a href="#finnes-ikke">Mangler</a></li><li><a href="#vedlegg">',
    )

  it("E1: en fane uten panel hindrer ikke adressen i å velge", async () => {
    lyttEtterAdvarsler()
    await settAdresse("#vedlegg")
    monter(medFaneUtenPanel(bar()))
    await tegn()

    expect(valgt()).toEqual([false, false, true, false])
  })

  for (const [fragment, id] of [
    ["sent-innhold", "sent-innhold"],
    ["s%C3%B8knad-sent", "søknad-sent"],
  ]) {
    it(`E1: innhold adressen peker på, som kommer etter panelet, velger fanen (#${fragment})`, async () => {
      await settAdresse(`#${fragment}`)
      monter(bar({ inni: (i) => (i === 2 ? '<div id="beholder"></div>' : "") }))
      await tegn()
      expect(valgt()).toEqual([true, false, false])

      // Dypt i panelet, der det som skjer ellers ikke gir en ny runde (F11).
      ;(document.getElementById("beholder") as HTMLElement).insertAdjacentHTML(
        "beforeend",
        `<p id="${id}">Kom senere</p>`,
      )
      await tegn()

      expect(valgt()).toEqual([false, false, true])
      expect(location.hash).toBe(`#${fragment}`)
    })
  }

  for (const [hva, lag] of [
    ["en hel rad", (m: string) => m],
    ["en rad med en fane uten panel", medFaneUtenPanel],
  ] as const) {
    it(`E6: adressen rettes etter en patch, også i ${hva}`, async () => {
      lyttEtterAdvarsler()
      monter(lag(bar()))
      await tegn()

      // Appen flytter adressen uten å velge, og serveren rører et panel.
      history.replaceState(null, "", "#vedlegg")
      paneler()[0].setAttribute("data-patch", "1")
      paneler()[0].setAttribute("hidden", "")
      paneler()[0].removeAttribute("hidden")
      await tegn()

      expect(valgt()[0]).toBe(true)
      expect(location.hash).toBe("#soknaden")
    })
  }

  it("G2: en adresse til noe som ikke finnes, står, og et klikk meldes én gang", async () => {
    await settAdresse("#/sak/1")
    monter(bar())
    await tegn()
    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("#/sak/1")
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    faner()[1].click()
    await tegn()
    await tegn()

    expect(valgt()).toEqual([false, true, false])
    expect(location.hash).toBe("#vedlegg")
    expect(meldt).toEqual([1])
  })

  it("E1: raden først og panelene etterpå: adressen velger likevel", async () => {
    await settAdresse("#meldinger")
    const markup = bar()
    const slutt = markup.indexOf("</ul>") + "</ul>".length
    monter(`${markup.slice(0, slutt)}</fs-tabs>`)
    await tegn()

    vert().insertAdjacentHTML(
      "beforeend",
      markup.slice(slutt, markup.lastIndexOf("</fs-tabs>")),
    )
    await tegn()
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(location.hash).toBe("#meldinger")
  })

  it("E1: kobles raden fra og til igjen, leses adressen på nytt", async () => {
    monter(bar())
    await tegn()
    faner()[1].click()
    await tegn()
    const v = vert()
    const forelder = v.parentElement as HTMLElement

    v.remove()
    history.replaceState(null, "", "#meldinger")
    forelder.append(v)
    await tegn()
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("E3: en lenke til noe inni et skjult panel velger fanen gjennom beforematch", async () => {
    const slipp = somSokISiden()
    let sett = 0
    try {
      monter(bar())
      await tegn()
      paneler()[1].addEventListener("beforematch", () => sett++)

      // `hashchange` er stoppet, så det er `beforematch` som må velge.
      location.hash = "#inne-vedlegg"
      await tegn()
      await tegn()
    } finally {
      slipp()
    }

    expect(sett).toBe(1)
    expect(valgt()).toEqual([false, true, false])
    expect(skjult()).toEqual([true, false, true])
  })

  it("E4: det samme når panelet står utenfor <fs-tabs>", async () => {
    const markup = bar()
    const [foran, bak] = markup.split(
      '<section class="fs-tabs__panel" id="vedlegg"',
    )
    const slutt = bak.indexOf("</section>") + "</section>".length
    const vedlegg = `<section class="fs-tabs__panel" id="vedlegg"${bak.slice(0, slutt)}`
    const slipp = somSokISiden()
    try {
      monter(`${foran}${bak.slice(slutt)}${vedlegg}`)
      await tegn()
      location.hash = "#inne-vedlegg"
      await tegn()
      await tegn()
    } finally {
      slipp()
    }

    expect(valgt()).toEqual([false, true, false])
    expect(
      paneler()
        .filter((p) => !p.hasAttribute("hidden"))
        .map((p) => p.id),
    ).toEqual(["vedlegg"])
  })

  /** Faner i faner: treffet `#dypt` står i det indre panelet `ib`, i det ytre `yb`. */
  const FANER_I_FANER = (indre = "") => `
    <a href="#dypt" id="til-dypt">Til treffet</a>
    <fs-tabs id="ytre">
      <ul class="fs-tabs__list" aria-label="Ytre"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
      <section class="fs-tabs__panel" id="ya"><h2>YA</h2>Ytre a</section>
      <section class="fs-tabs__panel" id="yb"><h2>YB</h2>
        <fs-tabs id="indre"${indre}>
          <ul class="fs-tabs__list" aria-label="Indre"><li><a href="#ia">IA</a></li><li><a href="#ib">IB</a></li></ul>
          <section class="fs-tabs__panel" id="ia"><h3>IA</h3>Indre a</section>
          <section class="fs-tabs__panel" id="ib"><h3>IB</h3><p id="dypt">Dypt inne</p></section>
        </fs-tabs>
      </section>
    </fs-tabs>`

  const skjultI = (...ider: string[]) =>
    ider.map((id) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden"),
    )

  /*
   * Et ekte klikk, ikke `location.hash` fra skriptet: kommer navigasjonen fra
   * brukeren, kjører nettleseren mikrooppgavene etter hver lytter, midt i
   * avdekkingen, slik den gjør ved søk i siden. Fra et skript gjør den ikke
   * det, og testen kunne ikke feile. `hashchange` er stoppet, som ved søk i
   * siden, ellers valgte adressen den ytre fanen etterpå.
   */
  it("E3: søk i siden avdekker et treff i en fanerad inne i et skjult panel", async () => {
    const slipp = somSokISiden()
    try {
      monter(FANER_I_FANER())
      await tegn()
      await userEvent.click(document.getElementById("til-dypt") as HTMLElement)
      await tegn()
      await tegn()
    } finally {
      slipp()
    }

    expect(
      (document.getElementById("dypt") as HTMLElement).checkVisibility(),
    ).toBe(true)
    expect(skjultI("ya", "yb", "ia", "ib")).toEqual([true, false, true, false])
  })

  it("E3: det samme når den indre raden er server-controlled, og valget meldes én gang", async () => {
    const slipp = somSokISiden()
    const meldt: number[] = []
    try {
      monter(FANER_I_FANER(" server-controlled"))
      await tegn()
      ;(document.getElementById("indre") as HTMLElement).addEventListener(
        "tab-select",
        (e) => {
          e.stopPropagation()
          meldt.push((e as CustomEvent<{ index: number }>).detail.index)
        },
      )
      await userEvent.click(document.getElementById("til-dypt") as HTMLElement)
      await tegn()
      await tegn()
    } finally {
      slipp()
    }

    expect(
      (document.getElementById("dypt") as HTMLElement).checkVisibility(),
    ).toBe(true)
    expect(skjultI("ya", "yb", "ia", "ib")).toEqual([true, false, true, false])
    expect(meldt).toEqual([1])
  })

  it("E3: søk i siden åpner en lukket <details> rundt raden", async (ctx) => {
    const slipp = somSokISiden()
    try {
      // Først uten faner: åpner ikke motoren en <details> selv, er det ikke
      // komponenten testen kan si noe om.
      monter(
        '<a href="#kontroll-treff" id="til-kontroll">Til</a><details id="kontroll"><summary>K</summary><p id="kontroll-treff">Treff</p></details>',
      )
      await userEvent.click(
        document.getElementById("til-kontroll") as HTMLElement,
      )
      await tegn()
      const motorenApner = (
        document.getElementById("kontroll") as HTMLDetailsElement
      ).open
      if (!motorenApner) ctx.skip()

      monter(
        `<a href="#inne-vedlegg" id="til-treff">Til treffet</a><details id="rundt"><summary>Mer</summary>${bar()}</details>`,
      )
      await tegn()
      await userEvent.click(document.getElementById("til-treff") as HTMLElement)
      await tegn()
      await tegn()
    } finally {
      slipp()
    }

    expect((document.getElementById("rundt") as HTMLDetailsElement).open).toBe(
      true,
    )
    expect(
      (
        document.getElementById("inne-vedlegg") as HTMLElement
      ).checkVisibility(),
    ).toBe(true)
    expect(valgt()).toEqual([false, true, false])
  })

  it("E3: tas panelet ut under avdekkingen og settes inn igjen, vises det", async () => {
    // Nettleseren avdekker ikke et panel som ikke står i dokumentet etter
    // `beforematch`. Uten en reserve ventet komponenten på det for alltid, og
    // panelet ble stående skjult selv om fanen var valgt.
    const slipp = somSokISiden()
    try {
      monter(`<a href="#inne-vedlegg" id="til-treff">Til treffet</a>${bar()}`)
      await tegn()
      const panel = paneler()[1]
      const forelder = panel.parentElement as HTMLElement
      const neste = panel.nextSibling
      panel.addEventListener(
        "beforematch",
        () => {
          panel.remove()
          setTimeout(() => forelder.insertBefore(panel, neste), 0)
        },
        { once: true },
      )
      await userEvent.click(document.getElementById("til-treff") as HTMLElement)
      await new Promise((r) => setTimeout(r, 10))
      await tegn()
    } finally {
      slipp()
    }

    expect(valgt()).toEqual([false, true, false])
    expect(skjult()).toEqual([true, false, true])
  })

  it("E3: setter noe annet hidden under avdekkingen, vises panelet likevel", async () => {
    // Nettleseren stopper når panelet ikke lenger har `until-found` etter
    // `beforematch`. Endringen ga en runde mens komponenten ventet, og ingen
    // runde kom etterpå, med mindre komponenten skrev raden selv.
    const slipp = somSokISiden()
    try {
      monter(`<a href="#inne-vedlegg" id="til-treff">Til treffet</a>${bar()}`)
      await tegn()
      const panel = paneler()[1]
      panel.addEventListener(
        "beforematch",
        () => panel.setAttribute("hidden", ""),
        { once: true },
      )
      await userEvent.click(document.getElementById("til-treff") as HTMLElement)
      await new Promise((r) => setTimeout(r, 10))
      await tegn()
    } finally {
      slipp()
    }

    expect(valgt()).toEqual([false, true, false])
    expect(skjult()).toEqual([true, false, true])
  })

  it("E3: en beforematch et skript sender, velger med en gang", async () => {
    // Ingen nettleser avdekker panelet etter en hendelse fra et skript, så
    // komponenten venter ikke på det.
    monter(bar())
    await tegn()

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()

    expect(skjult()).toEqual([true, true, false])
  })

  it("E1: en tom <fs-tabs> som fylles etterpå, velger fanen adressen peker på", async () => {
    await settAdresse("#meldinger")
    monter("<fs-tabs></fs-tabs>")
    await tegn()

    vert().innerHTML = bar().slice(
      bar().indexOf(">") + 1,
      bar().lastIndexOf("<"),
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("E6: adressen rettes når serveren flytter valget med en patch", async () => {
    monter(bar())
    await tegn()
    faner()[1].click()
    await tegn()
    expect(location.hash).toBe("#vedlegg")

    const innhold = bar().slice(bar().indexOf(">") + 1, bar().lastIndexOf("<"))
    vert().innerHTML = innhold.replace(
      '<a href="#soknaden">',
      '<a href="#soknaden" aria-selected="true">',
    )
    await tegn()

    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("#soknaden")
  })

  it("E6: adressen rettes når serveren flytter valget under server-controlled", async () => {
    monter(bar({ vert: " server-controlled" }))
    await tegn()
    faner()[1].click()
    await tegn()
    expect(location.hash).toBe("#vedlegg")

    // Serveren svarer med den første, og rører bare panelene.
    paneler()[1].setAttribute("hidden", "")
    paneler()[0].removeAttribute("hidden")
    await tegn()

    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("#soknaden")
  })

  it("E3: søk i siden velger fanen også under server-controlled, som et klikk", async () => {
    monter(bar({ vert: " server-controlled" }))
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    // Nettleseren fjerner `hidden` selv etter hendelsen.
    paneler()[2].removeAttribute("hidden")
    await tegn()
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(skjult()).toEqual([true, true, false])
    expect(meldt).toEqual([2])
  })

  it("E3: søk i siden velger fanen når raden står i en shadow root", async () => {
    const flate = monter('<div id="vert-for-rot"></div>')
    const rot = (
      flate.querySelector("#vert-for-rot") as HTMLElement
    ).attachShadow({ mode: "open" })
    rot.innerHTML = bar()
    await tegn()
    const p = [...rot.querySelectorAll<HTMLElement>(".fs-tabs__panel")]

    // Som nettleseren sender den: bobler, men er ikke `composed`.
    p[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await tegn()

    expect(
      [...rot.querySelectorAll(".fs-tabs__list a")].map(
        (a) => a.getAttribute("aria-selected") === "true",
      ),
    ).toEqual([false, false, true])
  })

  it("E8: adressen skrives også med en <base> til et annet opphav", async () => {
    const base = document.createElement("base")
    base.href = "https://eksempel.invalid/annet/"
    document.head.prepend(base)
    try {
      monter(bar())
      await tegn()
      const sti = location.pathname

      faner()[1].click()
      await tegn()

      expect(location.pathname).toBe(sti)
      expect(location.hash).toBe("#vedlegg")
    } finally {
      base.remove()
    }
  })

  it("D11: serverens aria-selected vinner over adressen når siden lastes", async () => {
    await settAdresse("#vedlegg")
    monter(
      bar().replace(
        '<a href="#meldinger">',
        '<a href="#meldinger" aria-selected="true">',
      ),
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    // Adressen rettes til fanen som faktisk er valgt (E6).
    expect(location.hash).toBe("#meldinger")
  })

  it("D11: en adresse til noe utenfor raden står når serveren har valgt", async () => {
    await settAdresse("#annet")
    monter(
      `<p id="annet">Annet</p>${bar().replace('<a href="#meldinger">', '<a href="#meldinger" aria-selected="true">')}`,
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(location.hash).toBe("#annet")
  })

  it("E8: et klikk endrer ikke stien i adressen, heller ikke med <base>", async () => {
    const base = document.createElement("base")
    base.href = "/en-annen-side/"
    document.head.prepend(base)
    try {
      monter(bar())
      await tegn()
      const sti = location.pathname

      faner()[1].click()
      await tegn()

      expect(location.pathname).toBe(sti)
      expect(location.hash).toBe("#vedlegg")
    } finally {
      base.remove()
    }
  })

  it("E5: en lenke til noe inni et skjult panel åpner fanen og ruller dit", async () => {
    monter(
      `${bar()}<div style="block-size: 200vh"></div><a href="#inne-meldinger" id="hopp">Til meldingene</a>`,
    )
    await tegn()
    window.scrollTo(0, document.body.scrollHeight)

    ;(document.getElementById("hopp") as HTMLElement).click()
    await tegn()
    await tegn()
    const mål = (
      document.getElementById("inne-meldinger") as HTMLElement
    ).getBoundingClientRect()

    expect(valgt()).toEqual([false, false, true])
    // Rullingen kan lande på en brøkdel av en piksel.
    expect(mål.top).toBeGreaterThan(-1)
    expect(mål.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  describe("E6: adressen peker på det valgte panelet etter hvert valg", () => {
    const veier: [string, () => Promise<void>, number][] = [
      ["klikk", async () => faner()[2].click(), 2],
      [
        "høyrepil",
        async () => {
          faner()[0].focus()
          await userEvent.keyboard("{ArrowRight}")
        },
        1,
      ],
      [
        "End",
        async () => {
          faner()[0].focus()
          await userEvent.keyboard("{End}")
        },
        2,
      ],
      ["select()", async () => vert().select(1), 1],
      [
        "selected",
        async () => {
          vert().selected = 2
        },
        2,
      ],
      [
        "søk i siden (beforematch)",
        async () => {
          paneler()[1].dispatchEvent(
            new Event("beforematch", { bubbles: true }),
          )
        },
        1,
      ],
      [
        "reserven når den valgte fanen forsvinner",
        async () => {
          faner()[1].click()
          await tegn()
          faner()[1].closest("li")?.remove()
          paneler()[1].remove()
        },
        0,
      ],
    ]

    for (const [vei, gjør, indeks] of veier) {
      it(vei, async () => {
        monter(bar())
        await tegn()
        await gjør()
        await tegn()

        expect(valgt().indexOf(true)).toBe(indeks)
        expect(location.hash).toBe(`#${paneler()[indeks].id}`)
      })
    }

    it("mellomrom og Enter ved manuell aktivering", async () => {
      monter(bar({ vert: ' activation="manual"' }))
      await tegn()
      faner()[0].focus()
      await userEvent.keyboard("{ArrowRight}")
      await userEvent.keyboard(" ")
      await tegn()
      expect(location.hash).toBe("#vedlegg")

      await userEvent.keyboard("{ArrowRight}")
      await userEvent.keyboard("{Enter}")
      await tegn()
      expect(location.hash).toBe("#meldinger")
    })

    it("en adresse til noe inni det valgte panelet står", async () => {
      monter(bar())
      await tegn()

      location.hash = "#inne-vedlegg"
      await tegn()
      await tegn()

      expect(valgt()).toEqual([false, true, false])
      expect(location.hash).toBe("#inne-vedlegg")
    })
  })

  it("E7 med E6: etter innerHTML velges fanen brukeren sist valgte med piltasten", async () => {
    const innhold = bar()
    monter(innhold)
    await tegn()
    faner()[1].click()
    await tegn()
    faner()[1].focus()
    await userEvent.keyboard("{ArrowRight}")
    await tegn()

    vert().innerHTML = innhold.slice(
      innhold.indexOf(">") + 1,
      innhold.lastIndexOf("<"),
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })
})

describe("F. Oppdatering fra serveren", () => {
  it("F11: det som skjer dypt i et panel, gir ingen ny runde", async () => {
    monter(
      bar({
        inni: (i) =>
          i === 1
            ? '<div role="listbox" id="forslag"><div role="option" aria-selected="false">A</div></div><p id="teller">0</p>'
            : "",
      }),
    )
    await tegn()
    const runder = vi.spyOn(
      FsTabs.prototype as unknown as { sync: () => void },
      "sync",
    )

    // Slik et forslagsfelt og en teller i panelet gjør det for hvert tastetrykk.
    const valg = document.querySelector('[role="option"]') as HTMLElement
    valg.setAttribute("aria-selected", "true")
    ;(document.getElementById("forslag") as HTMLElement).hidden = true
    valg.insertAdjacentHTML("afterend", '<div role="option">B</div>')
    ;(
      (document.getElementById("teller") as HTMLElement).firstChild as Text
    ).nodeValue = "1"
    await tegn()

    expect(runder).not.toHaveBeenCalled()
  })

  it("F11: det samme når adressen peker på noe som ikke finnes, som i en app med ruting", async () => {
    await settAdresse("#/sak/1")
    // I en beholder: det som legges rett i panelet, kan være en overskrift.
    monter(
      bar({ inni: (i) => (i === 1 ? '<div><p id="teller">0</p></div>' : "") }),
    )
    await tegn()
    const runder = vi.spyOn(
      FsTabs.prototype as unknown as { sync: () => void },
      "sync",
    )

    ;(
      (document.getElementById("teller") as HTMLElement).firstChild as Text
    ).nodeValue = "1"
    document
      .getElementById("teller")
      ?.insertAdjacentHTML("afterend", "<p>Mer</p>")
    await tegn()

    expect(runder).not.toHaveBeenCalled()
  })

  it("F11: en patch på panelet selv gir en ny runde", async () => {
    monter(bar())
    await tegn()
    const runder = vi.spyOn(
      FsTabs.prototype as unknown as { sync: () => void },
      "sync",
    )

    paneler()[1].removeAttribute("hidden")
    await tegn()

    expect(runder).toHaveBeenCalled()
    expect(skjult()).toEqual([false, true, true])
  })

  it("F1: en indre fanerad før den ytre raden tar ikke rollene fra den ytre", async () => {
    // Panelene står før raden, og det første panelet har en egen fanerad.
    monter(`
      <fs-tabs id="ytre">
        <section class="fs-tabs__panel" id="ya"><h2>YA</h2>
          <fs-tabs>
            <ul class="fs-tabs__list" aria-label="Indre"><li><a href="#ia">IA</a></li></ul>
            <section class="fs-tabs__panel" id="ia"><h3>IA</h3></section>
          </fs-tabs>
        </section>
        <section class="fs-tabs__panel" id="yb"><h2>YB</h2></section>
        <ul class="fs-tabs__list" aria-label="Ytre" id="ytre-rad"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
      </fs-tabs>`)
    await tegn()
    const rad = document.getElementById("ytre-rad") as HTMLElement

    expect(rad.getAttribute("role")).toBe("tablist")
    expect([...rad.children].map((li) => li.getAttribute("role"))).toEqual([
      "presentation",
      "presentation",
    ])
  })

  it("G2 med F4: tab-select sendes ikke når innerHTML bare bytter ut lenkene", async () => {
    monter(bar())
    await tegn()
    faner()[1].click()
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    vert().innerHTML = bar().slice(
      bar().indexOf(">") + 1,
      bar().lastIndexOf("<"),
    )
    await tegn()

    expect(valgt()).toEqual([false, true, false])
    expect(meldt).toEqual([])
  })

  it("I2: et kodet fragment finner panelet sitt", async () => {
    monter(`
      <fs-tabs>
        <ul class="fs-tabs__list" aria-label="Deler"><li><a href="#s%C3%B8knaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>
        <section class="fs-tabs__panel" id="søknaden"><h2>Søknaden</h2></section>
        <section class="fs-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>
      </fs-tabs>`)
    await tegn()

    expect(faner()[0].getAttribute("aria-controls")).toBe("søknaden")
    faner()[1].click()
    await tegn()
    faner()[0].click()
    await tegn()
    expect(skjult()).toEqual([false, true])
  })

  it("F7: velger serveren en fane etter at valget ble borte, står panelene og tabbestoppet i samsvar", async () => {
    monter(bar())
    await tegn()
    faner()[1].click()
    await tegn()

    // Serveren bytter ut raden med full markup, og markerer den tredje.
    vert().querySelector("ul")?.remove()
    vert().insertAdjacentHTML(
      "afterbegin",
      `<ul class="fs-tabs__list" aria-label="Deler av saken" role="tablist">${NAVN.map(
        (n, i) =>
          `<li role="presentation"><a role="tab" aria-controls="${NOKLER[i]}" href="#${NOKLER[i]}"${i === 2 ? ' aria-selected="true"' : ""}>${n}</a></li>`,
      ).join("")}</ul>`,
    )
    await tegn()
    await tegn()

    expect(skjult()).toEqual([true, true, false])
    expect(faner().map((f) => f.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "0",
    ])
  })
})

describe("G. API og hendelser", () => {
  it("G2: tab-select sendes når adressen velger fanen ved lasting", async () => {
    const meldt: number[] = []
    const lytter = (e: Event) =>
      meldt.push((e as CustomEvent<{ index: number }>).detail.index)
    document.addEventListener("tab-select", lytter)
    try {
      await settAdresse("#vedlegg")
      monter(bar())
      await tegn()
      expect(meldt).toEqual([1])
    } finally {
      document.removeEventListener("tab-select", lytter)
    }
  })

  it("G2: tab-select sendes når søk i siden velger fanen", async () => {
    monter(bar())
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await tegn()

    expect(meldt).toEqual([2])
  })

  it("G2: tab-select sendes ikke ved klikk på fanen som alt er valgt", async () => {
    monter(bar())
    await tegn()
    faner()[1].click()
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    faner()[1].click()
    await tegn()

    expect(valgt()).toEqual([false, true, false])
    expect(meldt).toEqual([])
  })

  it("G2: tab-select sendes ikke når adressen endres til fanen som alt er valgt", async () => {
    monter(bar())
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    location.hash = "#soknaden"
    await tegn()
    await tegn()

    expect(valgt()).toEqual([true, false, false])
    expect(meldt).toEqual([])
  })

  it("G3: tab-select sendes ikke når serveren flytter valget", async () => {
    monter(bar({ vert: " server-controlled" }))
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    paneler()[0].setAttribute("hidden", "")
    paneler()[1].removeAttribute("hidden")
    await tegn()

    expect(valgt()).toEqual([false, true, false])
    expect(meldt).toEqual([])
  })
})

describe("H. Utseende", () => {
  it("H1: den valgte fanen skiller seg ut med mer enn farge", async () => {
    monter(bar())
    await tegn()
    const [valgte, annen] = faner().map((f) => getComputedStyle(f))

    expect(Number(valgte.fontWeight)).toBeGreaterThan(Number(annen.fontWeight))
    expect(rgb(valgte.borderBottomColor).a).toBeGreaterThan(0)
    expect(rgb(annen.borderBottomColor).a).toBe(0)
  })

  for (const utseende of ["light", "dark"] as const) {
    it(`H2: kontrasten på fanene og streken holder i ${utseende === "light" ? "lyst" : "mørkt"} tema`, async () => {
      document.documentElement.dataset.theme = utseende
      try {
        monter(bar())
        await tegn()
        const flate = rgb(
          getComputedStyle(
            document.getElementById("fs-testflate") as HTMLElement,
          ).backgroundColor,
        )
        const [valgte, annen] = faner().map((f) => getComputedStyle(f))

        expect(
          contrastRatio(rgb(valgte.color), flate),
          "tekst, valgt",
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(rgb(annen.color), flate),
          "tekst, ikke valgt",
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(rgb(valgte.borderBottomColor), flate),
          "streken",
        ).toBeGreaterThanOrEqual(3)
      } finally {
        delete document.documentElement.dataset.theme
      }
    })
  }

  describe.skipIf(server.browser !== "chromium")("H3 i kontrastmodus", () => {
    afterEach(async () => {
      await cdp().send("Emulation.setEmulatedMedia", { features: [] })
      await ventPaTegning()
    })

    it("H3: den valgte fanen synes", async () => {
      monter(bar())
      await tegn()
      await cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "forced-colors", value: "active" }],
      })
      await ventPaTegning()
      const [valgte, annen] = faner().map((f) => getComputedStyle(f))

      expect(valgte.borderBottomStyle).toBe("solid")
      expect(valgte.borderBottomColor).not.toBe(annen.borderBottomColor)
      expect(valgte.color).not.toBe(annen.color)
    })
  })
})

describe("I. Byggefunksjonen", () => {
  it("I2: en id-stamme med mellomrom kaster, som nøklene", () => {
    expect(() => tabs({ id: "a b", keys: ["x"], label: "Faner" })).toThrow(
      /mellomrom/,
    )
    expect(() =>
      fsReact.tabs({ id: "a b", keys: ["x"], label: "Faner" }),
    ).toThrow(/mellomrom/)
  })

  it("I6: selected som ikke er et heltall, gir den første fanen", () => {
    for (const selected of [Number.NaN, 1.5]) {
      const f = fsReact.tabs({
        id: "sak",
        keys: ["a", "b"],
        label: "Faner",
        selected,
      })
      expect(f.tabs.map((t) => t["aria-selected"])).toEqual(["true", "false"])
      expect(f.panels.map((p) => p.hidden)).toEqual([undefined, true])
    }
  })

  it("I6: fs.tabs() i React-inngangen gir hele tilstanden", () => {
    expect(
      fsReact.tabs({
        id: "sak",
        keys: ["a", "b"],
        label: "Deler av saken",
        selected: 1,
      }),
    ).toEqual({
      list: {
        className: "fs-tabs__list",
        role: "tablist",
        "aria-label": "Deler av saken",
      },
      item: { role: "presentation" },
      tabs: [
        {
          id: "sak-a-tab",
          href: "#sak-a",
          role: "tab",
          "aria-selected": "false",
          "aria-controls": "sak-a",
          tabIndex: -1,
        },
        {
          id: "sak-b-tab",
          href: "#sak-b",
          role: "tab",
          "aria-selected": "true",
          "aria-controls": "sak-b",
          tabIndex: 0,
        },
      ],
      panels: [
        {
          id: "sak-a",
          className: "fs-tabs__panel",
          role: "tabpanel",
          "aria-labelledby": "sak-a-tab",
          hidden: true,
        },
        {
          id: "sak-b",
          className: "fs-tabs__panel",
          role: "tabpanel",
          "aria-labelledby": "sak-b-tab",
          tabIndex: 0,
        },
      ],
    })
  })

  it("I5: fs.tabs() skriver bare lenker, id-er og klasser", () => {
    expect(
      tabs({ id: "sak", keys: ["a", "b"], label: "Deler av saken" }),
    ).toEqual({
      list: { class: "fs-tabs__list", "aria-label": "Deler av saken" },
      tabs: [{ href: "#sak-a" }, { href: "#sak-b" }],
      panels: [
        { id: "sak-a", class: "fs-tabs__panel" },
        { id: "sak-b", class: "fs-tabs__panel" },
      ],
      headings: [{ id: "sak-a-heading" }, { id: "sak-b-heading" }],
    })
  })
})
