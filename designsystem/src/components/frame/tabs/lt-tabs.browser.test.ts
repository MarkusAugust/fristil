/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { gåTil, settAdresse } from "../../../testing/address"
import { attr } from "../../../testing/markup"
import { defineLtTabs, type LtTabs } from "./lt-tabs"
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

/** The markup `lt.tabs()` gives: links, ids and classes. The web component writes the rest. */
const FANER = tabs({
  id: "sak",
  keys: NOKLER,
  label: "Deler av saken",
})

/** The links in the tab list and the panels, from the builder function, separately. */
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
    <lt-tabs${vert}>
      <ul ${attr(faner.list)}>${lenker}</ul>
      ${paneler.join("")}
    </lt-tabs>`
}

const faner = () => [
  ...document.querySelectorAll<HTMLElement>("lt-tabs [role='tab']"),
]
const paneler = () => [
  ...document.querySelectorAll<HTMLElement>(".lt-tabs__panel"),
]
const valgt = () =>
  faner().map((f) => f.getAttribute("aria-selected") === "true")
// `hidden` instead of `.hidden`: the property answers "until-found" for that form.
const skjult = () => paneler().map((p) => p.hasAttribute("hidden"))

function tast(element: Element, key: string) {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
}

async function tegn() {
  await customElements.whenDefined("lt-tabs")
  await ventPaTegning()
}

beforeEach(async () => {
  // The web component reads the address on load, and the address carries
  // over between tests.
  await settAdresse("")
})

describe("lt-tabs", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  beforeEach(async () => {
    monter(fraByggefunksjonen())
    await tegn()
  })

  it("sets the roles and the wiring on markup from lt.tabs()", () => {
    const liste = document.querySelector(".lt-tabs__list") as HTMLElement
    const [fane] = faner()
    const panel = document.getElementById("sak-soknaden") as HTMLElement

    expect(liste.getAttribute("role")).toBe("tablist")
    expect(liste.getAttribute("aria-label")).toBe("Deler av saken")
    expect(fane.getAttribute("role")).toBe("tab")
    expect(fane.getAttribute("aria-controls")).toBe("sak-soknaden")
    expect(panel.getAttribute("role")).toBe("tabpanel")
    expect(panel.getAttribute("aria-labelledby")).toBe("sak-soknaden-heading")
  })

  it("writes no id on the tabs", () => {
    // Datastar and idiomorph recognise an element by its id. An id the server
    // did not send makes the element get replaced at the next update.
    expect(faner().map((f) => f.id)).toEqual(["", "", ""])
  })

  it("hides the panels that are not selected with until-found", () => {
    // `lt.tabs()` does not write `hidden`, so the panels show without
    // JavaScript. The web component hides them, and with `until-found` find in
    // page reaches them.
    expect(paneler().map((p) => p.getAttribute("hidden"))).toEqual([
      null,
      "until-found",
      "until-found",
    ])
  })

  it("gives only the selected tab a tab stop", () => {
    // Otherwise there is one tab stop per tab, and Tab never gets into the
    // panel without going through the whole tab list.
    expect(faner().map((f) => f.tabIndex)).toEqual([0, -1, -1])
  })

  it("does not ask the template to preserve anything", () => {
    // The tab selection belongs to the user, and the web component restores
    // it itself after a patch. If `data-preserve-attr` comes back here,
    // someone has revived the contract the template had to copy from the
    // documentation.
    expect(faner()[0].hasAttribute("data-preserve-attr")).toBe(false)
    expect(paneler()[0].hasAttribute("data-preserve-attr")).toBe(false)
  })

  it("moves between the tabs with the arrow keys", async () => {
    faner()[0].focus()
    tast(faner()[0], "ArrowRight")
    await tegn()

    expect(document.activeElement).toBe(faner()[1])
    expect(valgt()).toEqual([false, true, false])
  })

  it("wraps from the last to the first", async () => {
    faner()[2].click()
    await tegn()
    tast(faner()[2], "ArrowRight")
    await tegn()

    expect(document.activeElement).toBe(faner()[0])
  })

  it("fires an event when a tab is selected", async () => {
    const meldinger: number[] = []
    document
      .querySelector("lt-tabs")
      ?.addEventListener("tab-select", (hendelse) => {
        meldinger.push(hendelse.detail.index)
      })
    faner()[1].click()
    await tegn()

    expect(meldinger).toEqual([1])
  })

  it("has no accessibility violations", async () => {
    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("lt.tabs() and the keys", () => {
  it("makes links, panel ids and heading ids from the keys", () => {
    // The full form is in requirement I5, in
    // `lt-tabs-requirements.browser.test.ts`.
    const f = tabs({ id: "sak", keys: ["a", "b"], label: "Saken" })

    expect(f.tabs.map((t) => t.href)).toEqual(["#sak-a", "#sak-b"])
    expect(f.panels.map((p) => p.id)).toEqual(["sak-a", "sak-b"])
    expect(f.headings.map((h) => h.id)).toEqual([
      "sak-a-heading",
      "sak-b-heading",
    ])
  })

  it("gives an empty tab list for no keys", () => {
    const f = tabs({ id: "tom", keys: [], label: "Tom" })

    expect(f.tabs).toEqual([])
    expect(f.panels).toEqual([])
    expect(f.headings).toEqual([])
  })

  it("throws on a key that cannot become an id", () => {
    expect(() => tabs({ id: "x", keys: [""], label: "Faner" })).toThrow(/empty/)
    expect(() => tabs({ id: "x", keys: ["a b"], label: "Faner" })).toThrow(
      /whitespace/,
    )
    expect(() => tabs({ id: "x", keys: ["a\tb"], label: "Faner" })).toThrow(
      /whitespace/,
    )
    expect(() => tabs({ id: "x", keys: ["a\u00a0b"], label: "Faner" })).toThrow(
      /whitespace/,
    )
    expect(() => tabs({ id: "x", keys: ["a", "a"], label: "Faner" })).toThrow(
      /twice/,
    )
    expect(() => tabs({ id: "x", keys: [1 as never], label: "Faner" })).toThrow(
      /not a string/,
    )
    expect(() => tabs({ id: "x", label: "Faner" } as never)).toThrow(
      /keys is missing/,
    )
  })
})

describe("lt-tabs finds the panel through href and skips what cannot be selected", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  const liste = (lenker: string) =>
    `<ul class="lt-tabs__list" role="tablist">${lenker}</ul>`

  it("skips a disabled tab with the arrow keys, Home and End", async () => {
    // Without this the arrow key selected the disabled tab, and the tab list
    // was left without a single tab that could take focus. The keyboard user
    // was locked out.
    const første = deler(FANER, [1])
    monter(
      `<lt-tabs>${liste(første.lenker)}${første.paneler.join("")}</lt-tabs>`,
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
    monter(`<lt-tabs>${liste(andre.lenker)}${andre.paneler.join("")}</lt-tabs>`)
    await tegn()
    faner()[0].focus()
    tast(faner()[0], "End")
    await tegn()
    expect(document.activeElement).toBe(faner()[1])

    ;(document.querySelector("lt-tabs") as LtTabs).select(2)
    await tegn()
    expect(valgt()).toEqual([false, true, false])
  })

  it("goes to the first and last tab with Home and End", async () => {
    const { lenker, paneler: p } = deler()
    monter(`<lt-tabs>${liste(lenker)}${p.join("")}</lt-tabs>`)
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

  it("keeps tabs inside tabs as separate tab lists", async () => {
    // `querySelectorAll` over the whole subtree made an inner tab list part of
    // the outer one: a click on an inner tab hid the outer panel it was in.
    const ytre = tabs({ id: "ytre", keys: ["a", "b"], label: "Ytre" })
    const indre = tabs({ id: "indre", keys: ["a", "b"], label: "Indre" })
    const rad = (f: typeof ytre, navn: string) =>
      f.tabs.map((t, i) => `<li><a ${attr(t)}>${navn} ${i}</a></li>`).join("")
    monter(`
      <lt-tabs>
        <ul ${attr(ytre.list)}>${rad(ytre, "Ytre")}</ul>
        <section ${attr(ytre.panels[0])}>
          <h2 ${attr(ytre.headings[0])}>Ytre 0</h2>
          <lt-tabs>
            <ul ${attr(indre.list)}>${rad(indre, "Indre")}</ul>
            <section ${attr(indre.panels[0])}><h3 ${attr(indre.headings[0])}>A</h3></section>
            <section ${attr(indre.panels[1])}><h3 ${attr(indre.headings[1])}>B</h3></section>
          </lt-tabs>
        </section>
        <section ${attr(ytre.panels[1])}><h2 ${attr(ytre.headings[1])}>Ytre 1</h2></section>
      </lt-tabs>
    `)
    await tegn()
    ;(
      document.querySelectorAll(
        "lt-tabs lt-tabs [role='tab']",
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

  it("finds the panel through href, not through the order", async () => {
    // The wiring is in the markup, and is read from there. With the panels in
    // a different order, a click on tab 1 showed another tab's panel.
    const { lenker, paneler: p } = deler()
    const [forste, ...resten] = p
    monter(`<lt-tabs>${liste(lenker)}${[...resten, forste].join("")}</lt-tabs>`)
    await tegn()
    faner()[1].click()
    await tegn()

    const skjultId = (id: string) =>
      (document.getElementById(id) as HTMLElement).hasAttribute("hidden")
    expect(skjultId("sak-soknaden")).toBe(true)
    expect(skjultId("sak-vedlegg")).toBe(false)
    expect(skjultId("sak-meldinger")).toBe(true)
  })

  it("finds a panel outside the host", async () => {
    const { lenker, paneler: p } = deler()
    monter(`
      <lt-tabs>${liste(lenker)}${p[0]}</lt-tabs>
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

  it("warns about a link that points to nothing, without freezing", async () => {
    // When the web component did not find the panel, two tabs could get the
    // same one and write opposite `hidden` on it in every round, and the page
    // froze.
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const { lenker, paneler: p } = deler()
      monter(`
        <lt-tabs>${liste(
          lenker
            .replace('href="#sak-vedlegg"', 'href="#sak-vedleggx"')
            .replace(
              'aria-controls="sak-vedlegg"',
              'aria-controls="sak-vedleggx"',
            ),
        )}${p.join("")}</lt-tabs>
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
          String(k[0]).includes("has tabs without a panel"),
        ),
      ).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it("shows a panel two tabs share when one of them is selected", async () => {
    // A mistake in the markup, but a silent wrong answer is worse than showing
    // the panel: when only the first tab wrote, the panel stayed hidden while
    // the other was selected.
    const { lenker, paneler: p } = deler()
    monter(`
      <lt-tabs>${liste(
        lenker
          .replace('href="#sak-meldinger"', 'href="#sak-soknaden"')
          .replace(
            'aria-controls="sak-meldinger"',
            'aria-controls="sak-soknaden"',
          ),
      )}${p.join("")}</lt-tabs>
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

  it("moves the tab stop when a patch disables the selected tab", async () => {
    const { lenker, paneler: p } = deler()
    monter(`<lt-tabs>${liste(lenker)}${p.join("")}</lt-tabs>`)
    await tegn()
    faner()[1].click()
    await tegn()
    faner()[1].setAttribute("aria-disabled", "true")
    await tegn()

    // The selection stays, but the tab stop is a tab that can take focus.
    expect(valgt()).toEqual([false, true, false])
    expect(faner().map((f) => f.tabIndex)).toEqual([-1, -1, 0])
  })

  it("lets selected be set as a property", async () => {
    // React 19 writes the property when it exists, and the documentation
    // shows `tabs.selected` as API. A getter alone threw on assignment.
    const { lenker, paneler: p } = deler()
    monter(`<lt-tabs>${liste(lenker)}${p.join("")}</lt-tabs>`)
    await tegn()

    const meldinger: number[] = []
    const vert = document.querySelector("lt-tabs") as LtTabs
    vert.addEventListener("tab-select", (h) => {
      meldinger.push(h.detail.index)
    })
    vert.selected = 2
    await tegn()

    expect(vert.selected).toBe(2)
    expect(valgt()).toEqual([false, false, true])
    expect(meldinger).toEqual([2])
  })

  it("swaps the left and right arrows in right-to-left", async () => {
    // On a page read from right to left the next tab is to the left. Without
    // this the right arrow moved focus visually backwards.
    const { lenker, paneler: p } = deler()
    monter(`
      <div dir="rtl">
        <lt-tabs>${liste(lenker)}${p.join("")}</lt-tabs>
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
 * Markup written without JavaScript: a list of links and one panel per link,
 * without roles, wiring or `hidden`. What the template must write is an id on
 * the panels, and it needs the links anyway. The web component fills in the
 * rest.
 */
const BAR = `
  <lt-tabs>
    <ul class="lt-tabs__list" aria-label="Deler av saken">
      <li><a href="#soknaden">Søknaden</a></li>
      <li><a href="#vedlegg">Vedlegg</a></li>
      <li><a href="#meldinger">Meldinger</a></li>
    </ul>
    <section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2><p>Søknaden ble sendt 4. mars.</p></section>
    <section class="lt-tabs__panel" id="vedlegg"><h2>Vedlegg</h2><p>Tre vedlegg.</p></section>
    <section class="lt-tabs__panel" id="meldinger"><h2>Meldinger</h2><p>Ingen meldinger.</p></section>
  </lt-tabs>`

describe("lt-tabs wires bare structure", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  function barDeler() {
    return {
      liste: document.querySelector(".lt-tabs__list") as HTMLElement,
      punkter: [...document.querySelectorAll<HTMLElement>(".lt-tabs__list li")],
      lenker: [
        ...document.querySelectorAll<HTMLAnchorElement>(".lt-tabs__list a"),
      ],
      paneler: [...document.querySelectorAll<HTMLElement>(".lt-tabs__panel")],
    }
  }

  it("sets roles, wiring and tab stops", async () => {
    monter(BAR)
    await tegn()
    const { liste, punkter, lenker, paneler: p } = barDeler()

    expect(liste.getAttribute("role")).toBe("tablist")
    // Without the role a screen reader says "list, 3 items" before each tab.
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
    // Only the selected panel is a tab stop. A hidden panel that can take
    // focus is an invisible stop for the keyboard.
    expect(p.map((x) => x.getAttribute("tabindex"))).toEqual(["0", null, null])

    expect(lenker.map((l) => l.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ])
    expect(lenker.map((l) => l.tabIndex)).toEqual([0, -1, -1])
    // Without `until-found`, find in page does not reach a hidden panel.
    expect(p.map((x) => x.getAttribute("hidden"))).toEqual([
      null,
      "until-found",
      "until-found",
    ])

    await forventIngenTilgjengelighetsbrudd()
  })

  it("writes no id on links, list items, the tab list or the panels", async () => {
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
    // The panels' ids come from the server, and are the same as before.
    expect(p.map((x) => x.id)).toEqual(["soknaden", "vedlegg", "meldinger"])
  })

  it("names the panel from the heading in it", async () => {
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

  it("uses the tab's text as the name when the panel has no heading", async () => {
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

  it("uses the tab's text as the name when aria-labelledby points to nothing", async () => {
    // An `aria-labelledby` without a valid id is ignored when the name is
    // computed, and then `aria-label` takes over.
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

  it("leaves a name the server wrote, and removes the fallback when it arrives", async () => {
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

  it("leaves an aria-label the server wrote", async () => {
    monter(
      BAR.replace('id="vedlegg"', 'id="vedlegg" aria-label="Alle vedlegg"'),
    )
    await tegn()
    const { paneler: p } = barDeler()

    expect(p[1].getAttribute("aria-label")).toBe("Alle vedlegg")
    expect(p[1].hasAttribute("aria-labelledby")).toBe(false)
  })

  it("reads the selection from hidden when no tab is marked", async () => {
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
    // The form the server used, also on the panel it had not hidden.
    expect(p[0].getAttribute("hidden")).toBe("")
  })

  it("leaves what the server wrote", async () => {
    // Values the web component would never write itself, so the test tells
    // "left alone" from "wrote the same".
    monter(BAR.replace('id="vedlegg"', 'id="vedlegg" tabindex="-1"'))
    await tegn()
    const { paneler: p } = barDeler()

    expect(p[1].tabIndex).toBe(-1)
  })

  it("writes aria-controls from href, also when the server wrote another", async () => {
    // The two are the same information, and `href` is the one that works
    // without JavaScript.
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

  it("restores the wiring with the same heading id after a patch", async () => {
    monter(BAR)
    await tegn()
    const { lenker, paneler: p } = barDeler()
    const overskrift = p[1].querySelector("h2") as HTMLElement
    const id = overskrift.id

    // As a morph does it: everything that was not in the server's HTML is
    // removed.
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

  it("lets the server switch tab with hidden alone under server-controlled", async () => {
    /*
     * The idiomatic Datastar way: `data-attr:hidden` on each panel, and
     * nothing on the tabs. The web component had written
     * `aria-selected="true"` on the first itself, and read it back as the
     * server's word, so the panel the server had just shown was hidden again.
     */
    monter(BAR.replace("<lt-tabs>", "<lt-tabs server-controlled>"))
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

  it("leaves a link without a role alone when the server wrote the roles", async () => {
    // If the server has written the roles itself, a link without a role in
    // the tab list is something other than a tab.
    monter(`
      <lt-tabs>
        <ul class="lt-tabs__list" role="tablist" aria-label="Deler av saken">
          <li role="presentation"><a href="#soknaden" role="tab">Søknaden</a></li>
          <li role="presentation"><a href="#vedlegg" role="tab">Vedlegg</a></li>
          <li><a href="#annet" class="til-toppen">Til toppen</a></li>
        </ul>
        <section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>
        <section class="lt-tabs__panel" id="vedlegg"><h2>Vedlegg</h2></section>
      </lt-tabs>
    `)
    await tegn()
    const annen = document.querySelector(".til-toppen") as HTMLElement

    expect(annen.hasAttribute("role")).toBe(false)
    expect(annen.hasAttribute("aria-selected")).toBe(false)
    expect(annen.tabIndex).toBe(0)
  })

  it("takes a new link in a bare tab list as a tab", async () => {
    monter(BAR)
    await tegn()
    const { liste, paneler: p } = barDeler()

    const punkt = document.createElement("li")
    punkt.innerHTML = '<a href="#historikk">Historikk</a>'
    liste.append(punkt)
    const panel = document.createElement("section")
    panel.className = "lt-tabs__panel"
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

  it("keeps the user's selection through a patch that removes everything the web component wrote", async () => {
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

describe("lt-tabs under server-controlled", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  /** The recipe from the Datastar tab on the component page, bare structure. */
  const FIRE = `
    <lt-tabs server-controlled>
      <ul class="lt-tabs__list" aria-label="Deler av saken">
        <li><a href="#soknaden">Søknaden</a></li>
        <li><a href="#vedlegg">Vedlegg</a></li>
      </ul>
      <section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>
      <section class="lt-tabs__panel" id="vedlegg" hidden><h2>Vedlegg</h2></section>
    </lt-tabs>`

  function tilstand() {
    return {
      valgt: [...document.querySelectorAll("lt-tabs a")].map((l) =>
        l.getAttribute("aria-selected"),
      ),
      skjult: paneler().map((p) => p.hasAttribute("hidden")),
    }
  }

  it("lets a click stand after the observer has run", async () => {
    /*
     * The click was undone in the next microtask: `repair()` read the
     * server's old word from memory. A test that reads right after the click
     * does not see it, so this one waits for a frame first.
     */
    monter(FIRE)
    await tegn()

    document.querySelectorAll<HTMLElement>("lt-tabs a")[1].click()
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "true"],
      skjult: [true, false],
    })
  })

  it("follows a server that moves with hidden alone, after server-controlled was set after a click", async () => {
    // When the attribute is set midway, what is there is the starting point.
    // But the web component wrote `aria-selected` on the tabs itself on the
    // click. When that counted as the server's, it took precedence over
    // `hidden`, and the server could not move the tab.
    monter(FIRE.replace("<lt-tabs server-controlled>", "<lt-tabs>"))
    await tegn()
    const vert = document.querySelector("lt-tabs") as HTMLElement
    document.querySelectorAll<HTMLElement>("lt-tabs a")[1].click()
    await ventPaTegning()
    vert.setAttribute("server-controlled", "")
    await ventPaTegning()

    const p = paneler()
    p[0].removeAttribute("hidden")
    p[1].setAttribute("hidden", "")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["true", "false"],
      skjult: [false, true],
    })
  })

  it("takes what is there as the starting point when server-controlled is set, and repairs again when it is removed", async () => {
    // Without the attribute from the start, as when a patch sets it.
    monter(FIRE.replace("<lt-tabs server-controlled>", "<lt-tabs>"))
    await tegn()
    const vert = document.querySelector("lt-tabs") as HTMLElement
    const lenker = [...document.querySelectorAll<HTMLElement>("lt-tabs a")]
    lenker[1].click()
    await ventPaTegning()

    // The server takes over, and a patch writes the panel as it is. Unless
    // the web component forgot its memory, the tab list jumped back to what
    // the server said before the click.
    vert.setAttribute("server-controlled", "")
    const p = paneler()
    p[0].setAttribute("hidden", p[0].getAttribute("hidden") ?? "")
    await ventPaTegning()
    expect(tilstand()).toEqual({
      valgt: ["false", "true"],
      skjult: [true, false],
    })

    // The server lets go again and sends the first. The earlier click is
    // forgotten, and does not come back.
    vert.removeAttribute("server-controlled")
    p[0].removeAttribute("hidden")
    p[1].setAttribute("hidden", "")
    await ventPaTegning()
    expect(tilstand()).toEqual({
      valgt: ["true", "false"],
      skjult: [false, true],
    })

    // A new click stands through a patch that strips it.
    lenker[1].click()
    await ventPaTegning()
    p[0].removeAttribute("hidden")
    p[1].setAttribute("hidden", "")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "true"],
      skjult: [true, false],
    })
  })

  it("lets the server move the selection after the click", async () => {
    monter(FIRE)
    await tegn()
    const p = paneler()

    document.querySelectorAll<HTMLElement>("lt-tabs a")[1].click()
    await ventPaTegning()

    // The server sends the first tab again, and touches only the panels.
    p[0].removeAttribute("hidden")
    p[1].setAttribute("hidden", "")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["true", "false"],
      skjult: [false, true],
    })
  })

  /** Three tabs: with two, "back to the first" is also the wrong answer. */
  const TRE = `
    <lt-tabs server-controlled>
      <ul class="lt-tabs__list" aria-label="Deler av saken">
        <li><a href="#soknaden">Søknaden</a></li>
        <li><a href="#vedlegg">Vedlegg</a></li>
        <li><a href="#meldinger">Meldinger</a></li>
      </ul>
      <section class="lt-tabs__panel" id="soknaden"><h2>Søknaden</h2></section>
      <section class="lt-tabs__panel" id="vedlegg" hidden><h2>Vedlegg</h2></section>
      <section class="lt-tabs__panel" id="meldinger" hidden><h2>Meldinger</h2></section>
    </lt-tabs>`

  async function klikkAndre() {
    monter(TRE)
    await tegn()
    document.querySelectorAll<HTMLElement>("lt-tabs a")[1].click()
    await ventPaTegning()
    return {
      lenker: [...document.querySelectorAll<HTMLElement>("lt-tabs a")],
      paneler: paneler(),
    }
  }

  it("follows the server to a third tab, not back to the first", async () => {
    const { paneler: p } = await klikkAndre()

    // The server answers with the third, and touches only the panels.
    p[1].setAttribute("hidden", "")
    p[2].removeAttribute("hidden")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "false", "true"],
      skjult: [true, true, false],
    })
  })

  it("follows the server when it moves aria-selected to a third tab", async () => {
    const { lenker } = await klikkAndre()

    lenker[1].setAttribute("aria-selected", "false")
    lenker[2].setAttribute("aria-selected", "true")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "false", "true"],
      skjult: [true, true, false],
    })
  })

  it("follows the server also after a tab was added while the click was pending", async () => {
    const { paneler: p } = await klikkAndre()
    const vert = document.querySelector("lt-tabs") as HTMLElement

    // A patch adds a fourth tab. It has said nothing about the selection.
    vert
      .querySelector(".lt-tabs__list")
      ?.insertAdjacentHTML(
        "beforeend",
        '<li><a href="#historikk">Historikk</a></li>',
      )
    vert.insertAdjacentHTML(
      "beforeend",
      '<section class="lt-tabs__panel" id="historikk" hidden><h2>Historikk</h2></section>',
    )
    await ventPaTegning()
    expect(tilstand().valgt).toEqual(["false", "true", "false", "false"])

    // Then the server moves to the third, with `hidden` alone.
    p[1].setAttribute("hidden", "")
    p[2].removeAttribute("hidden")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "false", "true", "false"],
      skjult: [true, true, false, true],
    })
  })

  it("stays on the clicked tab when the server confirms it with bare markup", async () => {
    /*
     * The morph strips `aria-selected` from the tabs, since the server's
     * markup does not have it, and leaves the panels: they are already as the
     * server sent them. The server's old word about the panels then won, and
     * the tab list jumped back.
     */
    const { lenker } = await klikkAndre()

    for (const lenke of lenker) lenke.removeAttribute("aria-selected")
    await ventPaTegning()

    expect(tilstand()).toEqual({
      valgt: ["false", "true", "false"],
      skjult: [true, false, true],
    })
  })

  it("ignores the address, so the server decides", async () => {
    await settAdresse("#meldinger")
    monter(TRE)
    await tegn()

    expect(tilstand().valgt).toEqual(["true", "false", "false"])
  })

  it("ignores the address also when it changes", async () => {
    monter(TRE)
    await tegn()

    await gåTil("#meldinger")
    await tegn()

    expect(tilstand().valgt).toEqual(["true", "false", "false"])
  })

  it("reports a click with tab-select, and writes it to the address", async () => {
    monter(TRE)
    await tegn()
    const meldt: number[] = []
    document
      .querySelector("lt-tabs")
      ?.addEventListener("tab-select", (e) =>
        meldt.push((e as CustomEvent<{ index: number }>).detail.index),
      )

    document.querySelectorAll<HTMLElement>("lt-tabs a")[2].click()
    await ventPaTegning()

    expect(meldt).toEqual([2])
    expect(location.hash).toBe("#meldinger")
  })
})

describe("lt-tabs when a patch touches the panels and the links", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  it("gives a new panel with the same id the role, the name and hidden", async () => {
    monter(BAR)
    await tegn()
    const gammelt = document.getElementById("vedlegg") as HTMLElement

    const nytt = document.createElement("section")
    nytt.className = "lt-tabs__panel"
    nytt.id = "vedlegg"
    nytt.innerHTML = "<h2>Nye vedlegg</h2>"
    gammelt.replaceWith(nytt)
    await ventPaTegning()

    expect(nytt.getAttribute("role")).toBe("tabpanel")
    expect(
      nytt.hasAttribute("hidden"),
      "the panel of a tab that is not selected is visible",
    ).toBe(true)
    // The heading says something other than the tab, so the panel is named
    // what the tab is named.
    expect(nytt.getAttribute("aria-label")).toBe("Vedlegg")
  })

  it("follows the markup when the patch replaces the links", async () => {
    /*
     * The selection is tied to the link itself and only survives a morph that
     * keeps the nodes. `innerHTML` and htmx's default swap create new nodes,
     * and then what the markup says applies, and otherwise the address.
     */
    const bar = BAR.slice(BAR.indexOf(">") + 1, BAR.lastIndexOf("<"))
    monter(BAR)
    await tegn()
    const vert = document.querySelector("lt-tabs") as LtTabs
    faner()[1].click()
    await ventPaTegning()
    expect(vert.selected).toBe(1)
    expect(location.hash).toBe("#vedlegg")

    // No tab marked by the server: the address says where the user was.
    vert.innerHTML = bar
    await ventPaTegning()
    expect(vert.selected).toBe(1)

    // The server marks a tab itself, and it wins over the address.
    vert.innerHTML = bar
      .replace(
        '<a href="#soknaden">',
        '<a href="#soknaden" aria-selected="true">',
      )
      .replace('id="vedlegg"', 'id="vedlegg" hidden')
    await ventPaTegning()
    expect(vert.selected).toBe(0)

    // Nothing in the address either: the first.
    history.replaceState(null, "", location.pathname + location.search)
    vert.innerHTML = bar
    await ventPaTegning()
    expect(vert.selected).toBe(0)
    expect(faner()[0].getAttribute("aria-selected")).toBe("true")
  })

  it("warns and leaves the other panels alone when one is removed", async () => {
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
          String(k[0]).includes("has tabs without a panel"),
        ),
      ).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })

  it("leaves the browser's shortcuts with Alt and Cmd alone", async () => {
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

describe("lt-tabs as links", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  it("writes the selection to the address without jumping, and without a new history entry", async () => {
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

  it("selects the tab even when the address cannot be written", async () => {
    // Safari throws after a hundred calls in ten seconds. The throw stopped
    // the click before the tab was selected.
    monter(fraByggefunksjonen())
    await tegn()
    const skriv = vi.spyOn(history, "replaceState").mockImplementation(() => {
      throw new DOMException("Too many calls", "SecurityError")
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

  it("lets the browser open the link when a modifier is held down", async () => {
    monter(fraByggefunksjonen())
    await tegn()
    const lenke = faner()[1]

    // The listener on the link runs after the web component's, and stops the
    // test from actually navigating.
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

  it("selects the tab the address points to on load", async () => {
    await settAdresse("#sak-vedlegg")
    monter(fraByggefunksjonen())
    await tegn()

    expect(valgt()).toEqual([false, true, false])
    expect(skjult()).toEqual([true, false, true])
  })

  it("selects the tab when the address changes", async () => {
    monter(fraByggefunksjonen())
    await tegn()

    history.replaceState(null, "", "#sak-meldinger")
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("selects the tab on beforematch", async () => {
    monter(BAR)
    await tegn()

    paneler()[2].dispatchEvent(new Event("beforematch", { bubbles: true }))
    await tegn()

    expect(valgt()).toEqual([false, false, true])
  })

  it("lets a panel hidden with until-found take no space", async () => {
    // A hidden panel keeps its box, so the spacing around the content must be
    // zeroed, or there is an empty gap under the selected panel.
    monter(BAR)
    await tegn()

    const høyder = paneler().map((p) => p.getBoundingClientRect().height)

    expect(høyder[0]).toBeGreaterThan(0)
    expect(høyder[1]).toBe(0)
    expect(høyder[2]).toBe(0)
  })

  it("hides the panels in the same form across the whole tab list", async () => {
    // The server hides with `hidden=""`. The first panel was never hidden by
    // the server, but gets the same form as the others when it is hidden.
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

  it("only moves focus with the arrow keys under manual activation, and selects with Space", async () => {
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

  it("selects at once by default", async () => {
    monter(fraByggefunksjonen())
    await tegn()
    faner()[0].focus()

    tast(faner()[0], "ArrowRight")
    await tegn()

    expect(valgt()).toEqual([false, true, false])
  })
})

describe("lt-tabs after a morph and with arrow keys", () => {
  beforeAll(() => {
    defineLtTabs()
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
      <lt-tabs>
        <ul ${attr(FEM.list)}>${lenker()}</ul>
        ${FEM.panels
          .map(
            (panel, i) =>
              `<section ${attr(panel)}><h2 ${attr(FEM.headings[i])}>Panel ${i}</h2></section>`,
          )
          .join("")}
      </lt-tabs>`)
    await tegn()
    return document.querySelector("lt-tabs") as HTMLElement
  }

  it("works on tabs a morph has replaced", async () => {
    // One listener on the host. Before, every new tab got its own listeners,
    // and the old ones were kept in memory.
    const vert = await monterFaner()
    const rad = vert.querySelector(".lt-tabs__list") as HTMLElement
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

  it("works even when something on the tab list stops the events", async () => {
    // The listener is on the host. Without the capture phase, clicks and
    // arrow keys did not get through when the tab list had a listener that
    // stopped them.
    const vert = await monterFaner()
    const rad = vert.querySelector(".lt-tabs__list") as HTMLElement
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

  it("leaves the down arrow alone in a horizontal tab list", async () => {
    // Before, it moved focus and stole page scrolling.
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

  it("uses the down arrow in a vertical tab list", async () => {
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
