/// <reference path="../../../types/css.d.ts" />
/// <reference types="@vitest/browser-playwright" />

/**
 * The requirements for the tabs, one requirement per test, with the
 * requirement's number in the name.
 *
 * The requirements are in `krav-faner.md` in the investigation, with a
 * source for each. Requirements that already have a test that can fail are
 * in `lt-tabs.browser.test.ts` and `lt-tabs-morph.browser.test.ts`. The page
 * without JavaScript is tested in `scripts/check-without-javascript.ts`,
 * since Vitest is itself a script.
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

import { lt as ltReact } from "../../../react"
import { monter, ventPaTegning } from "../../../testing/a11y"
import { settAdresse } from "../../../testing/address"
import { rgb } from "../../../testing/color"
import { Idiomorph } from "../../../testing/idiomorph/idiomorph-v0.8.0.js"
import { attr } from "../../../testing/markup"
import { contrastRatio } from "../../../tokens/color"
import { defineLtTabs, LtTabs } from "./lt-tabs"
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

/** The tabs as a template writes them by hand: links, and ids only on the panels. */
function bar(valg: Bar = {}): string {
  const overskrift = valg.overskrift ?? ((i) => NAVN[i])
  return `
    <lt-tabs${valg.vert ?? ""}>
      <ul class="lt-tabs__list"${valg.liste ?? ' aria-label="Deler av saken"'}>
        ${NAVN.map((n, i) => `<li><a href="#${NOKLER[i]}"${valg.lenke?.(i) ?? ""}>${n}</a></li>`).join("")}
      </ul>
      ${NAVN.map((_, i) => {
        const tittel = overskrift(i)
        return `<section class="lt-tabs__panel" id="${NOKLER[i]}"${valg.panel?.(i) ?? ""}>${tittel === null ? "" : `<h2>${tittel}</h2>`}<p id="inne-${NOKLER[i]}">Innholdet i ${NAVN[i].toLowerCase()}.</p>${valg.inni?.(i) ?? ""}</section>`
      }).join("")}
    </lt-tabs>`
}

/** What `lt.tabs()` writes, put together the way a template does it. */
function fraByggefunksjonen(): string {
  const f = tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
  return `
    <lt-tabs>
      <ul ${attr(f.list)}>
        ${f.tabs.map((t, i) => `<li><a ${attr(t)}>${NAVN[i]}</a></li>`).join("")}
      </ul>
      ${f.panels.map((p, i) => `<section ${attr(p)}><h2 ${attr(f.headings[i])}>${NAVN[i]}</h2><p>Innholdet i ${NAVN[i].toLowerCase()}.</p></section>`).join("")}
    </lt-tabs>`
}

const vert = () => document.querySelector("lt-tabs") as LtTabs
const faner = () => [
  ...document.querySelectorAll<HTMLElement>("lt-tabs .lt-tabs__list a"),
]
const paneler = () => [
  ...document.querySelectorAll<HTMLElement>(".lt-tabs__panel"),
]
const valgt = () =>
  faner().map((f) => f.getAttribute("aria-selected") === "true")
const skjult = () => paneler().map((p) => p.hasAttribute("hidden"))

/**
 * The computed name, by AccName, as a screen reader gets it.
 *
 * axe's types do not include the functions that compute the name from the
 * tree, so they are typed here.
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
 * Tab, as a keyboard user presses it. WebKit on macOS, like Safari, skips
 * links with Tab, and there it is Alt+Tab that moves to links.
 */
async function tab() {
  if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}")
  else await userEvent.tab()
}

async function tegn() {
  await customElements.whenDefined("lt-tabs")
  await ventPaTegning()
}

/**
 * Stops `hashchange`, as find in page does: the browser reveals the match
 * and sends `beforematch`, but does not change the address. Without this the
 * address selected the tab, and a test of `beforematch` could not fail.
 *
 * Called before `monter()`: Chromium calls the listeners on `window` in the
 * order they were added, a listener in the capture phase included, so a
 * stopper added after the component's stopped nothing there.
 */
function somSokISiden(): () => void {
  const stopp = (e: Event) => e.stopImmediatePropagation()
  window.addEventListener("hashchange", stopp, true)
  return () => window.removeEventListener("hashchange", stopp, true)
}

function lyttEtterAdvarsler() {
  return vi.spyOn(console, "warn").mockImplementation(() => {})
}

/** The warnings that have arrived, once `warnAboutMarkup` has checked its condition. */
async function advarsler(spion: ReturnType<typeof lyttEtterAdvarsler>) {
  await ventPaTegning()
  await ventPaTegning()
  return spion.mock.calls.map((k) => String(k[0]))
}

beforeAll(() => {
  defineLtTabs()
})

beforeEach(async () => {
  await settAdresse("")
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("A. Three states of the page", () => {
  it("A6: registration gives markup from lt.tabs() the same state as hand-written markup, and changes nothing the builder function wrote", async () => {
    /** The attributes that carry the tabs, without ids, which differ between the two sources. */
    const tilstand = () =>
      [...document.querySelectorAll("lt-tabs, lt-tabs *")].map((e) =>
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

    expect(
      endret,
      "registration changed something the builder function wrote",
    ).toEqual([])
    expect(tilstand()).toEqual(forventet)
  })

  /** A React app that renders the tabs with `lt.tabs()` from the React entry point. */
  const App = ({ teller }: { teller: number }) => {
    const f = ltReact.tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
    return h(
      "div",
      { "data-teller": teller },
      h(
        "lt-tabs",
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

  it("A7: React hydrates markup from lt.tabs() in the React entry point without mismatches, also when the user has switched tabs and React renders again", async () => {
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

  it("A7 with D11: React hydrates without mismatches also when the address points to another tab", async () => {
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

  it("A9: the component writes nothing on markup from lt.tabs() in the React entry point", async () => {
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

describe("B. Semantics and names", () => {
  it("B5: an icon-only tab gives the panel its name from aria-label, without hidden text", async () => {
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

  it("B6: the panel has the same name as the tab, also when the heading says something else", async () => {
    monter(
      bar({
        overskrift: (i) => (i === 1 ? "Dokumenter du har lastet opp" : NAVN[i]),
      }),
    )
    await tegn()

    expect(paneler().map(navn)).toEqual(faner().map(navn))
  })

  it("B7: an aria-labelledby the server wrote is not changed, also when it points to something that arrives later", async () => {
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

  it("B8: the name follows when the tab's text changes in the text node, as idiomorph does it", async () => {
    monter(bar({ overskrift: () => null }))
    await tegn()

    ;(faner()[1].firstChild as Text).nodeValue = "Vedlegg (2)"
    await tegn()

    expect(navn(paneler()[1])).toBe("Vedlegg (2)")
  })

  /*
   * Each row replaces the second tab, the heading in its panel and what
   * stands outside the tab list. The names are computed by axe, as a screen
   * reader does, and the panel must have the same name as the tab (B5, B6,
   * D7).
   */
  const NAVNEVARIANTER: Array<{
    hva: string
    lenke: string
    overskrift: string
    utenfor?: string
    navn: string
  }> = [
    {
      hva: "text",
      lenke: "Vedlegg",
      overskrift: "<h2>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "without a heading",
      lenke: "Vedlegg",
      overskrift: "",
      navn: "Vedlegg",
    },
    {
      hva: "heading with different text",
      lenke: "Vedlegg",
      overskrift: "<h2>Bilag</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "hidden heading",
      lenke: "Vedlegg",
      overskrift: "<h2 hidden>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "heading with aria-label equal to the tab",
      lenke: "Vedlegg",
      overskrift: '<h2 aria-label="Vedlegg">Bilag</h2>',
      navn: "Vedlegg",
    },
    {
      hva: "heading with aria-label different from the tab",
      lenke: "Vedlegg",
      overskrift: '<h2 aria-label="Noe annet">Vedlegg</h2>',
      navn: "Vedlegg",
    },
    {
      // If the panel points to the heading, the heading's own
      // `aria-labelledby` is not followed, and the panel is named "Bilag".
      hva: "heading with aria-labelledby",
      lenke: "Vedlegg",
      overskrift: '<h2 aria-labelledby="ov-navn">Bilag</h2>',
      utenfor: '<span id="ov-navn">Vedlegg</span>',
      navn: "Vedlegg",
    },
    {
      hva: "text hidden with CSS",
      lenke: 'Vedlegg<span style="display: none"> (2)</span>',
      overskrift: "",
      navn: "Vedlegg",
    },
    {
      hva: "text with aria-hidden",
      lenke: 'Vedlegg<span aria-hidden="true"> (2)</span>',
      overskrift: "<h2>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "image with alt",
      lenke: '<img alt="Vedlegg" width="1" height="1">',
      overskrift: "<h2>Vedlegg</h2>",
      navn: "Vedlegg",
    },
    {
      hva: "aria-label on a child",
      lenke: '<span role="img" aria-label="Vedlegg">📎</span>',
      overskrift: "",
      navn: "Vedlegg",
    },
    {
      // AccName 2B also applies to a child of the tab.
      hva: "aria-labelledby on a child, pointing to a hidden element",
      lenke:
        '<svg role="img" aria-labelledby="ikon-navn" width="16" height="16"></svg>',
      overskrift: "",
      utenfor: '<span id="ikon-navn" hidden>Bilag</span>',
      navn: "Bilag",
    },
    {
      hva: "aria-labelledby on the tab, pointing to a hidden element",
      lenke: "Vedlegg",
      overskrift: "",
      utenfor: '<span id="fane-navn" hidden>Bilag</span>',
      navn: "Bilag",
    },
    {
      // Inside an `aria-labelledby` that is already being followed, another one is not followed.
      hva: "aria-labelledby inside aria-labelledby",
      lenke: "Vedlegg",
      overskrift: "",
      utenfor:
        '<span id="fane-navn"><span role="img" aria-labelledby="dypere">Bilag</span></span><span id="dypere">Feil</span>',
      navn: "Bilag",
    },
  ]

  for (const v of NAVNEVARIANTER) {
    it(`B5 and B6: the panel has the tab's name, ${v.hva}`, async () => {
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

  it("B6: the heading is the name only when its name is the same as the tab's", async () => {
    monter(
      bar().replace(
        "<h2>Vedlegg</h2>",
        '<h2 aria-label="Noe helt annet">Vedlegg</h2>',
      ),
    )
    await tegn()

    expect(paneler().map(navn)).toEqual(NAVN)
  })

  it("B5: a tab with aria-labelledby pointing to a hidden element is named what that element says", async () => {
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

  it("B5: text hidden with CSS and a tab with only a title", async () => {
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

  it("B8: the name follows when the text in the heading changes", async () => {
    monter(bar())
    await tegn()
    expect(navn(paneler()[1])).toBe("Vedlegg")

    // As idiomorph does it: only the text node changes.
    const tekst = paneler()[1].querySelector("h2")?.firstChild as Text
    tekst.nodeValue = "Bilag"
    await tegn()

    // The heading no longer says what the tab says, so the panel has the
    // tab's name.
    expect(navn(paneler()[1])).toBe("Vedlegg")
  })

  it("B8: the name follows when the text aria-labelledby points to inside a panel changes", async () => {
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

    // The text is inside the element the id points to, not directly in it.
    const tekst = document.querySelector("#sent-navn b")?.firstChild as Text
    tekst.nodeValue = "Dokumenter"
    await tegn()

    expect(navn(paneler()[1])).toBe("Dokumenter")
  })

  it("B8: the same when aria-labelledby is on a child of the tab", async () => {
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

  it("B7: the fallback is removed when the element the server's aria-labelledby points to arrives inside a panel", async () => {
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

  it("B8: the name follows when the element aria-labelledby points to arrives inside a panel", async () => {
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

  it("B8: the name follows when an element inside a panel gets the id aria-labelledby points to", async () => {
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

  it("D7: the heading becomes the name when its text changes to the tab's", async () => {
    monter(bar({ overskrift: (i) => (i === 1 ? "Bilag" : NAVN[i]) }))
    await tegn()
    expect(paneler()[1].getAttribute("aria-label")).toBe("Vedlegg")

    const overskrift = paneler()[1].querySelector("h2") as HTMLElement
    ;(overskrift.firstChild as Text).nodeValue = "Vedlegg"
    await tegn()

    expect(paneler()[1].hasAttribute("aria-label")).toBe(false)
    expect(paneler()[1].getAttribute("aria-labelledby")).toBe(overskrift.id)
  })

  it("B8: the name follows when the element aria-labelledby points to loses its id inside a panel", async () => {
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

  it("B8: the name follows when alt on an image in the tab changes", async () => {
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

  it("B9: the component warns when the tab list has no name", async () => {
    const spion = lyttEtterAdvarsler()
    monter(bar({ liste: "" }))
    await tegn()

    expect((await advarsler(spion)).some((m) => m.includes("aria-label"))).toBe(
      true,
    )
  })

  it("B9: the component does not warn when the tab list has a name", async () => {
    const spion = lyttEtterAdvarsler()
    monter(bar())
    await tegn()

    expect(
      (await advarsler(spion)).filter((m) => m.startsWith("lt-tabs")),
    ).toEqual([])
  })

  it("B9 and D8: lt.tabs() throws when label is missing or empty", () => {
    // A non-breaking space and a BOM are whitespace to JavaScript, and to
    // Kotlin only when it checks the same way.
    for (const label of [undefined, "", "   ", "\u00a0\ufeff"]) {
      for (const bygg of [tabs, ltReact.tabs]) {
        expect(() =>
          bygg({ id: "uten-navn", keys: ["a"], label } as never),
        ).toThrow(/label/)
      }
    }
  })

  it("I1: label is checked before keys, as in Kotlin", () => {
    expect(() => tabs({ id: "x", keys: [""], label: "" })).toThrow(/label/)
  })
})

describe("C. Keyboard and focus", () => {
  const rundt = (innhold: string) =>
    `<button type="button" id="foer">Før</button>${innhold}<button type="button" id="etter">Etter</button>`

  it("C1: Tab into the tab list lands on the selected tab, and Tab again moves to the selected panel", async () => {
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

  it("C2: nothing in a panel that is not selected can be reached with Tab, the panel itself included", async () => {
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

  it("C3: left arrow wraps from the first to the last", async () => {
    monter(bar())
    await tegn()
    faner()[0].focus()

    await userEvent.keyboard("{ArrowLeft}")
    await tegn()

    expect(document.activeElement).toBe(faner()[2])
    expect(valgt()).toEqual([false, false, true])
  })

  it("C7: Enter selects with manual activation", async () => {
    monter(bar({ vert: ' activation="manual"' }))
    await tegn()
    faner()[0].focus()

    await userEvent.keyboard("{ArrowRight}")
    expect(valgt()).toEqual([true, false, false])
    await userEvent.keyboard("{Enter}")
    await tegn()

    expect(valgt()).toEqual([false, true, false])
  })

  it("C8: a tab with hidden is skipped by the arrow keys and never gets the tab stop", async () => {
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

  it("C10: focus is visible on the tab and on the panel", async () => {
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

describe("D. Mouse and links", () => {
  it("D2: a real middle click does not select the tab", async () => {
    monter(bar())
    await tegn()
    const lenke = faner()[1]
    let klikk = 0
    lenke.addEventListener("click", () => klikk++)
    // A middle click opens the link in a new browser tab. In the test the new
    // tab would load Vitest's test page, which sends messages the run does
    // not recognise, and WebKit navigates in the same page instead. The
    // browser's default action is stopped, so the test asks only about the
    // component. The listener is on `window` and runs last, so it sees
    // whether anything before it has stopped the link.
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

  it('D3: a role="tab" without href is not a tab, and the component warns', async () => {
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

describe("E. The address and find in page", () => {
  it("E1: an address to something inside a panel selects that tab on load", async () => {
    await settAdresse("#inne-meldinger")
    monter(bar())
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(location.hash).toBe("#inne-meldinger")
  })

  /** The tab list with one more tab, which points to a panel that does not exist. */
  const medFaneUtenPanel = (markup: string) =>
    markup.replace(
      '<li><a href="#vedlegg">',
      '<li><a href="#finnes-ikke">Mangler</a></li><li><a href="#vedlegg">',
    )

  it("E1: a tab without a panel does not stop the address from selecting", async () => {
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
    it(`E1: content the address points to, arriving after the panel, selects the tab (#${fragment})`, async () => {
      await settAdresse(`#${fragment}`)
      monter(bar({ inni: (i) => (i === 2 ? '<div id="beholder"></div>' : "") }))
      await tegn()
      expect(valgt()).toEqual([true, false, false])

      // Deep in the panel, where what happens otherwise does not trigger a new round (F11).
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
    ["a complete tab list", (m: string) => m],
    ["a tab list with a tab without a panel", medFaneUtenPanel],
  ] as const) {
    it(`E6: the address is corrected after a patch, also in ${hva}`, async () => {
      lyttEtterAdvarsler()
      monter(lag(bar()))
      await tegn()

      // The app moves the address without selecting, and the server touches a panel.
      history.replaceState(null, "", "#vedlegg")
      paneler()[0].setAttribute("data-patch", "1")
      paneler()[0].setAttribute("hidden", "")
      paneler()[0].removeAttribute("hidden")
      await tegn()

      expect(valgt()[0]).toBe(true)
      expect(location.hash).toBe("#soknaden")
    })
  }

  it("G2: an address to something that does not exist stays, and a click is reported once", async () => {
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

  it("E1: the tab list first and the panels afterwards: the address still selects", async () => {
    await settAdresse("#meldinger")
    const markup = bar()
    const slutt = markup.indexOf("</ul>") + "</ul>".length
    monter(`${markup.slice(0, slutt)}</lt-tabs>`)
    await tegn()

    vert().insertAdjacentHTML(
      "beforeend",
      markup.slice(slutt, markup.lastIndexOf("</lt-tabs>")),
    )
    await tegn()
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(location.hash).toBe("#meldinger")
  })

  it("E1: when the tab list is disconnected and reconnected, the address is read again", async () => {
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

  it("E3: a link to something inside a hidden panel selects the tab through beforematch", async () => {
    const slipp = somSokISiden()
    let sett = 0
    try {
      monter(bar())
      await tegn()
      paneler()[1].addEventListener("beforematch", () => sett++)

      // `hashchange` is stopped, so it is `beforematch` that must select.
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

  it("E4: the same when the panel is outside <lt-tabs>", async () => {
    const markup = bar()
    const [foran, bak] = markup.split(
      '<section class="lt-tabs__panel" id="vedlegg"',
    )
    const slutt = bak.indexOf("</section>") + "</section>".length
    const vedlegg = `<section class="lt-tabs__panel" id="vedlegg"${bak.slice(0, slutt)}`
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

  /** Tabs in tabs: the match `#dypt` is in the inner panel `ib`, inside the outer `yb`. */
  const FANER_I_FANER = (indre = "") => `
    <a href="#dypt" id="til-dypt">Til treffet</a>
    <lt-tabs id="ytre">
      <ul class="lt-tabs__list" aria-label="Ytre"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
      <section class="lt-tabs__panel" id="ya"><h2>YA</h2>Ytre a</section>
      <section class="lt-tabs__panel" id="yb"><h2>YB</h2>
        <lt-tabs id="indre"${indre}>
          <ul class="lt-tabs__list" aria-label="Indre"><li><a href="#ia">IA</a></li><li><a href="#ib">IB</a></li></ul>
          <section class="lt-tabs__panel" id="ia"><h3>IA</h3>Indre a</section>
          <section class="lt-tabs__panel" id="ib"><h3>IB</h3><p id="dypt">Dypt inne</p></section>
        </lt-tabs>
      </section>
    </lt-tabs>`

  const skjultI = (...ider: string[]) =>
    ider.map((id) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden"),
    )

  /*
   * A real click, not `location.hash` from the script: when the navigation
   * comes from the user, the browser runs the microtasks after each
   * listener, in the middle of revealing, as it does with find in page. From
   * a script it does not, and the test could not fail. `hashchange` is
   * stopped, as with find in page, or the address selected the outer tab
   * afterwards.
   */
  it("E3: find in page reveals a match in a tab list inside a hidden panel", async () => {
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

  it("E3: the same when the inner tab list is server-controlled, and the selection is reported once", async () => {
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

  it("E3: find in page opens a closed <details> around the tab list", async (ctx) => {
    const slipp = somSokISiden()
    try {
      // First without tabs: if the engine does not open a <details> itself,
      // the test has nothing to say about the component.
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

  it("E3: a panel removed during revealing and inserted again is shown", async () => {
    // The browser does not reveal a panel that is not in the document after
    // `beforematch`. Without a fallback the component waited for it forever,
    // and the panel stayed hidden even though the tab was selected.
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

  it("E3: when something else sets hidden during revealing, the panel is still shown", async () => {
    // The browser stops when the panel no longer has `until-found` after
    // `beforematch`. The change triggered a round while the component was
    // waiting, and no round came afterwards, unless the component wrote the
    // tab list itself.
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

  it("E3: a beforematch sent by a script selects at once", async () => {
    // No browser reveals the panel after an event from a script, so the
    // component does not wait for it.
    monter(bar())
    await tegn()

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()

    expect(skjult()).toEqual([true, true, false])
  })

  it("E1: an empty <lt-tabs> filled afterwards selects the tab the address points to", async () => {
    await settAdresse("#meldinger")
    monter("<lt-tabs></lt-tabs>")
    await tegn()

    vert().innerHTML = bar().slice(
      bar().indexOf(">") + 1,
      bar().lastIndexOf("<"),
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("E6: the address is corrected when the server moves the selection with a patch", async () => {
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

  it("E6: the address is corrected when the server moves the selection under server-controlled", async () => {
    monter(bar({ vert: " server-controlled" }))
    await tegn()
    faner()[1].click()
    await tegn()
    expect(location.hash).toBe("#vedlegg")

    // The server answers with the first one, and touches only the panels.
    paneler()[1].setAttribute("hidden", "")
    paneler()[0].removeAttribute("hidden")
    await tegn()

    expect(valgt()).toEqual([true, false, false])
    expect(location.hash).toBe("#soknaden")
  })

  it("E3: find in page selects the tab under server-controlled too, like a click", async () => {
    monter(bar({ vert: " server-controlled" }))
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    // The browser itself removes `hidden` after the event.
    paneler()[2].removeAttribute("hidden")
    await tegn()
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(skjult()).toEqual([true, true, false])
    expect(meldt).toEqual([2])
  })

  it("E3: find in page selects the tab when the tab list is in a shadow root", async () => {
    const flate = monter('<div id="vert-for-rot"></div>')
    const rot = (
      flate.querySelector("#vert-for-rot") as HTMLElement
    ).attachShadow({ mode: "open" })
    rot.innerHTML = bar()
    await tegn()
    const p = [...rot.querySelectorAll<HTMLElement>(".lt-tabs__panel")]

    // As the browser sends it: bubbles, but is not `composed`.
    p[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await tegn()

    expect(
      [...rot.querySelectorAll(".lt-tabs__list a")].map(
        (a) => a.getAttribute("aria-selected") === "true",
      ),
    ).toEqual([false, false, true])
  })

  it("E8: the address is written also with a <base> to another origin", async () => {
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

  it("D11: the server's aria-selected wins over the address when the page loads", async () => {
    await settAdresse("#vedlegg")
    monter(
      bar().replace(
        '<a href="#meldinger">',
        '<a href="#meldinger" aria-selected="true">',
      ),
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    // The address is corrected to the tab that is actually selected (E6).
    expect(location.hash).toBe("#meldinger")
  })

  it("D11: an address to something outside the tab list stays when the server has selected", async () => {
    await settAdresse("#annet")
    monter(
      `<p id="annet">Annet</p>${bar().replace('<a href="#meldinger">', '<a href="#meldinger" aria-selected="true">')}`,
    )
    await tegn()

    expect(valgt()).toEqual([false, false, true])
    expect(location.hash).toBe("#annet")
  })

  it("E8: a click does not change the path in the address, not even with <base>", async () => {
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

  it("E5: a link to something inside a hidden panel opens the tab and scrolls there", async () => {
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
    // The scroll can land on a fraction of a pixel.
    expect(mål.top).toBeGreaterThan(-1)
    expect(mål.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  describe("E6: the address points to the selected panel after every selection", () => {
    const veier: [string, () => Promise<void>, number][] = [
      ["click", async () => faner()[2].click(), 2],
      [
        "right arrow",
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
        "find in page (beforematch)",
        async () => {
          paneler()[1].dispatchEvent(
            new Event("beforematch", { bubbles: true }),
          )
        },
        1,
      ],
      [
        "the fallback when the selected tab disappears",
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

    it("Space and Enter with manual activation", async () => {
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

    it("an address to something inside the selected panel stays", async () => {
      monter(bar())
      await tegn()

      location.hash = "#inne-vedlegg"
      await tegn()
      await tegn()

      expect(valgt()).toEqual([false, true, false])
      expect(location.hash).toBe("#inne-vedlegg")
    })
  })

  it("E7 with E6: after innerHTML the tab the user last selected with the arrow key is selected", async () => {
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

describe("F. Updates from the server", () => {
  it("F11: what happens deep in a panel does not trigger a new round", async () => {
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
      LtTabs.prototype as unknown as { sync: () => void },
      "sync",
    )

    // As a suggestion field and a counter in the panel do it on every keystroke.
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

  it("F11: the same when the address points to something that does not exist, as in an app with routing", async () => {
    await settAdresse("#/sak/1")
    // In a container: what is put directly in the panel could be a heading.
    monter(
      bar({ inni: (i) => (i === 1 ? '<div><p id="teller">0</p></div>' : "") }),
    )
    await tegn()
    const runder = vi.spyOn(
      LtTabs.prototype as unknown as { sync: () => void },
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

  it("F11: a patch on the panel itself triggers a new round", async () => {
    monter(bar())
    await tegn()
    const runder = vi.spyOn(
      LtTabs.prototype as unknown as { sync: () => void },
      "sync",
    )

    paneler()[1].removeAttribute("hidden")
    await tegn()

    expect(runder).toHaveBeenCalled()
    expect(skjult()).toEqual([false, true, true])
  })

  it("F1: an inner tab list before the outer tab list does not take the roles from the outer one", async () => {
    // The panels come before the tab list, and the first panel has a tab list of its own.
    monter(`
      <lt-tabs id="ytre">
        <section class="lt-tabs__panel" id="ya"><h2>YA</h2>
          <lt-tabs>
            <ul class="lt-tabs__list" aria-label="Indre"><li><a href="#ia">IA</a></li></ul>
            <section class="lt-tabs__panel" id="ia"><h3>IA</h3></section>
          </lt-tabs>
        </section>
        <section class="lt-tabs__panel" id="yb"><h2>YB</h2></section>
        <ul class="lt-tabs__list" aria-label="Ytre" id="ytre-rad"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
      </lt-tabs>`)
    await tegn()
    const rad = document.getElementById("ytre-rad") as HTMLElement

    expect(rad.getAttribute("role")).toBe("tablist")
    expect([...rad.children].map((li) => li.getAttribute("role"))).toEqual([
      "presentation",
      "presentation",
    ])
  })

  /**
   * F3: a morph with idiomorph keeps the links and panels, and the
   * selection stays.
   *
   * idiomorph recognises an element by its id, as Datastar does. The server
   * sends the markup as the template writes it, without `aria-selected` and
   * without `hidden`, so the morph strips everything the component wrote.
   * The links have no id, and the panels have the server's, so the nodes are
   * kept, and the component writes the selection back on the same nodes.
   */
  for (const [kilde, markup] of [
    ["bare markup", bar],
    ["markup from lt.tabs()", fraByggefunksjonen],
  ] as const) {
    it(`F3: idiomorph keeps the links and panels, and the selection stays (${kilde})`, async () => {
      const spion = lyttEtterAdvarsler()
      const flate = monter(markup())
      await tegn()
      const faneFør = faner()
      const panelFør = paneler()
      faneFør[1].click()
      await tegn()
      expect(valgt()).toEqual([false, true, false])

      Idiomorph.morph(flate, `<div id="lt-testflate">${markup()}</div>`, {
        morphStyle: "outerHTML",
      })
      await tegn()
      await tegn()

      expect(faner().map((f, i) => f === faneFør[i])).toEqual([
        true,
        true,
        true,
      ])
      expect(paneler().map((p, i) => p === panelFør[i])).toEqual([
        true,
        true,
        true,
      ])
      expect(valgt()).toEqual([false, true, false])
      expect(paneler().map((p) => p.getAttribute("hidden"))).toEqual([
        "until-found",
        null,
        "until-found",
      ])
      expect(faner().map((f) => f.id)).toEqual(["", "", ""])
      expect(await advarsler(spion)).toEqual([])
    })
  }

  it("G2 with F4: tab-select is not sent when innerHTML only replaces the links", async () => {
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

  it("I2: an encoded fragment finds its panel", async () => {
    monter(`
      <lt-tabs>
        <ul class="lt-tabs__list" aria-label="Deler"><li><a href="#s%C3%B8knaden">Søknaden</a></li><li><a href="#vedlegg">Vedlegg</a></li></ul>
        <section class="lt-tabs__panel" id="søknaden"><h2>Søknaden</h2></section>
        <section class="lt-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>
      </lt-tabs>`)
    await tegn()

    expect(faner()[0].getAttribute("aria-controls")).toBe("søknaden")
    faner()[1].click()
    await tegn()
    faner()[0].click()
    await tegn()
    expect(skjult()).toEqual([false, true])
  })

  it("F7: when the server selects a tab after the selection was lost, the panels and the tab stop agree", async () => {
    monter(bar())
    await tegn()
    faner()[1].click()
    await tegn()

    // The server replaces the tab list with full markup, and marks the third.
    vert().querySelector("ul")?.remove()
    vert().insertAdjacentHTML(
      "afterbegin",
      `<ul class="lt-tabs__list" aria-label="Deler av saken" role="tablist">${NAVN.map(
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

describe("G. API and events", () => {
  it("G2: tab-select is sent when the address selects the tab on load", async () => {
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

  it("G2: tab-select is sent when find in page selects the tab", async () => {
    monter(bar())
    await tegn()
    const meldt: number[] = []
    vert().addEventListener("tab-select", (e) => meldt.push(e.detail.index))

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await tegn()

    expect(meldt).toEqual([2])
  })

  it("G2: tab-select is not sent on a click on the tab that is already selected", async () => {
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

  it("G2: tab-select is not sent when the address changes to the tab that is already selected", async () => {
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

  it("G3: tab-select is not sent when the server moves the selection", async () => {
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

describe("H. Appearance", () => {
  it("H1: the selected tab stands out by more than colour", async () => {
    monter(bar())
    await tegn()
    const [valgte, annen] = faner().map((f) => getComputedStyle(f))

    expect(Number(valgte.fontWeight)).toBeGreaterThan(Number(annen.fontWeight))
    expect(rgb(valgte.borderBottomColor).a).toBeGreaterThan(0)
    expect(rgb(annen.borderBottomColor).a).toBe(0)
  })

  for (const utseende of ["light", "dark"] as const) {
    it(`H2: the contrast of the tabs and the underline holds in the ${utseende} theme`, async () => {
      document.documentElement.dataset.theme = utseende
      try {
        monter(bar())
        await tegn()
        const flate = rgb(
          getComputedStyle(
            document.getElementById("lt-testflate") as HTMLElement,
          ).backgroundColor,
        )
        const [valgte, annen] = faner().map((f) => getComputedStyle(f))

        expect(
          contrastRatio(rgb(valgte.color), flate),
          "text, selected",
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(rgb(annen.color), flate),
          "text, not selected",
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(rgb(valgte.borderBottomColor), flate),
          "the underline",
        ).toBeGreaterThanOrEqual(3)
      } finally {
        delete document.documentElement.dataset.theme
      }
    })
  }

  describe.skipIf(server.browser !== "chromium")(
    "H3 in forced colours mode",
    () => {
      afterEach(async () => {
        await cdp().send("Emulation.setEmulatedMedia", { features: [] })
        await ventPaTegning()
      })

      it("H3: the selected tab is visible", async () => {
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
    },
  )
})

describe("I. The builder function", () => {
  it("I2: an id stem with whitespace throws, like the keys", () => {
    expect(() => tabs({ id: "a b", keys: ["x"], label: "Faner" })).toThrow(
      /whitespace/,
    )
    expect(() =>
      ltReact.tabs({ id: "a b", keys: ["x"], label: "Faner" }),
    ).toThrow(/whitespace/)
  })

  it("I6: a selected that is not an integer gives the first tab", () => {
    for (const selected of [Number.NaN, 1.5]) {
      const f = ltReact.tabs({
        id: "sak",
        keys: ["a", "b"],
        label: "Faner",
        selected,
      })
      expect(f.tabs.map((t) => t["aria-selected"])).toEqual(["true", "false"])
      expect(f.panels.map((p) => p.hidden)).toEqual([undefined, true])
    }
  })

  it("I6: lt.tabs() in the React entry point gives the whole state", () => {
    expect(
      ltReact.tabs({
        id: "sak",
        keys: ["a", "b"],
        label: "Deler av saken",
        selected: 1,
      }),
    ).toEqual({
      list: {
        className: "lt-tabs__list",
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
          className: "lt-tabs__panel",
          role: "tabpanel",
          "aria-labelledby": "sak-a-tab",
          hidden: true,
        },
        {
          id: "sak-b",
          className: "lt-tabs__panel",
          role: "tabpanel",
          "aria-labelledby": "sak-b-tab",
          tabIndex: 0,
        },
      ],
    })
  })

  it("I5: lt.tabs() writes only links, ids and classes", () => {
    expect(
      tabs({ id: "sak", keys: ["a", "b"], label: "Deler av saken" }),
    ).toEqual({
      list: { class: "lt-tabs__list", "aria-label": "Deler av saken" },
      tabs: [{ href: "#sak-a" }, { href: "#sak-b" }],
      panels: [
        { id: "sak-a", class: "lt-tabs__panel" },
        { id: "sak-b", class: "lt-tabs__panel" },
      ],
      headings: [{ id: "sak-a-heading" }, { id: "sak-b-heading" }],
    })
  })
})
