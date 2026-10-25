/**
 * What survives a patch through Datastar's own morph.
 *
 * `morph.browser.test.ts` runs Datastar's attribute loop on the same nodes,
 * and so assumes the morph keeps them. It does not always. Datastar v1.0.4
 * matches old and new elements like this (`isSoftMatch` in
 * `library/src/plugins/watchers/patchElements.ts`):
 *
 * ```js
 * oldNode.tagName === newNode.tagName &&
 *   (!oldNode.id || oldNode.id === newNode.id)
 * ```
 *
 * If the element in the page has an id, and the server's element has none
 * or a different one, it is not morphed. The old one is removed and the
 * server's is inserted. If a component creates the id itself, every patch
 * from a template without ids therefore gets new nodes, and what the
 * component remembered on the old node is gone.
 *
 * These tests run the real bundle, not a reproduction of the loop:
 * `src/testing/datastar/datastar-v1.0.4.js`, taken from
 * `starfederation/datastar@v1.0.4/bundles/datastar.js` (sha256
 * `727844adfc825ee651fb93c544a2a739986f9a21820a94524b35f0cac470cf91`), with
 * the last line, `//# sourceMappingURL=datastar.js.map`, removed so Vite
 * does not look for a map that is not included. It is the version
 * `agent/datastar.md` points to. The file is here because the npm package,
 * `@starfederation/datastar`, stops at 1.0.0-beta.11: 1.0.x exists only as
 * a file in the Git repository and on the CDN. The patch is sent as the same
 * `datastar-fetch` event the SSE reader itself sends once it has parsed a
 * `datastar-patch-elements`, and one test goes all the way through `@get`
 * and a stream, so we know the shortcut is the same.
 *
 * The tabs write no id: the links have none, and the panels' ids come from
 * the server, since `href` requires them. Datastar therefore morphs them into
 * the old nodes, and the selection stays. The heading in the panel gets an
 * id from the component, since it has nothing the user can lose. Field,
 * suggestion field and popover warn in the console when a patch replaced
 * something the user had interacted with; see the last group.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest"

import { waitForPaint } from "../../../testing/a11y"
import { setAddress } from "../../../testing/address"
import { attr } from "../../../testing/markup"
import { defineLtField } from "../field/lt-field"
import { defineLtPopover } from "../popover/lt-popover"
import { defineLtSuggestion } from "../suggestion/lt-suggestion"
import { defineLtTabs } from "./lt-tabs"
import { tabs } from "./tabs"

import "../../../testing/datastar/datastar-v1.0.4.js"

/** Patches like a `datastar-patch-elements` without a selector: `outer` on the id. */
function patch(elements: string): void {
  document.dispatchEvent(
    new CustomEvent("datastar-fetch", {
      detail: {
        type: "datastar-patch-elements",
        el: document.body,
        argsRaw: { elements },
      },
    }),
  )
}

/** Whether each node is still the same. */
function sammeNoder(før: Element[], etter: Element[]): boolean[] {
  return før.map((node, i) => node === etter[i])
}

const NAVN = ["Søknaden", "Vedlegg", "Meldinger"]
const NOKLER = ["soknaden", "vedlegg", "meldinger"]

/**
 * A tab list as a Go or Kotlin template writes it without `lt.tabs()`: links
 * without an id, and ids only on the panels, which the links require.
 */
const BAR = `<lt-tabs id="saken">
  <ul class="lt-tabs__list" aria-label="Deler av saken">
    ${NAVN.map((n, i) => `<li><a href="#${NOKLER[i]}">${n}</a></li>`).join("\n    ")}
  </ul>
  ${NAVN.map((n, i) => `<section class="lt-tabs__panel" id="${NOKLER[i]}"><h2>${n}</h2><p>Innhold</p></section>`).join("\n  ")}
</lt-tabs>`

/** What `lt.tabs()` writes: links, the panels' ids, the headings' ids and the classes. */
const FANER = tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
const FRA_BYGGEFUNKSJONEN = `<lt-tabs id="saken">
  <ul ${attr(FANER.list)}>
    ${FANER.tabs.map((t, i) => `<li><a ${attr(t)}>${NAVN[i]}</a></li>`).join("\n    ")}
  </ul>
  ${FANER.panels.map((p, i) => `<section ${attr(p)}><h2 ${attr(FANER.headings[i])}>${NAVN[i]}</h2><p>Innhold</p></section>`).join("\n  ")}
</lt-tabs>`

function faner(): HTMLAnchorElement[] {
  return [
    ...document.querySelectorAll<HTMLAnchorElement>("#saken .lt-tabs__list a"),
  ]
}

function paneler(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("#saken .lt-tabs__panel")]
}

function valgt(): (string | null)[] {
  return faner().map((fane) => fane.getAttribute("aria-selected"))
}

/** Clicks tab 2, patches with `markup`, and reports what survived. */
async function klikkOgPatch(markup: string) {
  document.body.innerHTML = markup
  await customElements.whenDefined("lt-tabs")
  await waitForPaint()

  const faneFør = faner()
  const panelFør = paneler()
  faneFør[1].click()
  await waitForPaint()
  expect(valgt()).toEqual(["false", "true", "false"])

  const meldt: number[] = []
  const lytter = new AbortController()
  document.addEventListener(
    "tab-select",
    (e) => meldt.push((e as CustomEvent<{ index: number }>).detail.index),
    { signal: lytter.signal },
  )
  patch(markup)
  await waitForPaint()
  lytter.abort()

  return {
    faner: sammeNoder(faneFør, faner()),
    paneler: sammeNoder(panelFør, paneler()),
    valgt: valgt(),
    skjult: paneler().map((p) => p.hasAttribute("hidden")),
    hidden: paneler().map((p) => p.getAttribute("hidden")),
    lenkeIder: faner().map((f) => f.id),
    navn: paneler().map((p) => {
      const peker = p.getAttribute("aria-labelledby")
      return peker ? document.getElementById(peker)?.textContent : null
    }),
    meldt,
  }
}

describe("lt-tabs through Datastar's morph", () => {
  beforeAll(() => {
    defineLtTabs()
  })

  beforeEach(async () => {
    // A click on a tab writes the address, and the component reads it on
    // load.
    await setAddress("")
  })

  it("bare markup: the links and panels are morphed, and the selection stays", async () => {
    /*
     * The component writes no id on the links, and the panels' ids come from
     * the server. Datastar therefore has something to recognise in both, and
     * morphs them into the old nodes. `chosenTab` points to a node that is
     * still in the page, and the selection is restored after the morph took
     * `aria-selected`, `tabindex` and `hidden`.
     */
    const r = await klikkOgPatch(BAR)
    expect(r.faner).toEqual([true, true, true])
    expect(r.paneler).toEqual([true, true, true])
    expect(r.valgt).toEqual(["false", "true", "false"])
    expect(r.skjult).toEqual([true, false, true])
    expect(r.lenkeIder).toEqual(["", "", ""])
    expect(r.meldt).toEqual([])
  })

  it("bare markup: the panels keep their name from the heading", async () => {
    // The heading has no id from the server, so it can be replaced. The new
    // one gets the same id back, and the panel still points to it.
    const r = await klikkOgPatch(BAR)
    expect(r.navn).toEqual(NAVN)
  })

  it("markup from lt.tabs(): the same, and the panels are hidden with until-found", async () => {
    const r = await klikkOgPatch(FRA_BYGGEFUNKSJONEN)
    expect(r.faner).toEqual([true, true, true])
    expect(r.paneler).toEqual([true, true, true])
    expect(r.valgt).toEqual(["false", "true", "false"])
    expect(r.hidden).toEqual(["until-found", null, "until-found"])
    expect(r.navn).toEqual(NAVN)
    expect(r.meldt).toEqual([])
  })

  it("bare markup in a patch that wraps the tab list: the same", async () => {
    /*
     * The server often patches a region, not the tab list itself. Then
     * `<lt-tabs>` has no id and is morphed into the old one, and the links
     * inside are kept the same way.
     */
    const side = (innhold: string) => `<main id="side">${innhold}</main>`
    const uten = BAR.replace(' id="saken"', ' class="saken"')
    document.body.innerHTML = side(uten)
    await waitForPaint()
    const lenker = () => [
      ...document.querySelectorAll("#side .lt-tabs__list a"),
    ]
    const før = lenker()
    ;(før[1] as HTMLElement).click()
    await waitForPaint()

    patch(side(uten))
    await waitForPaint()

    expect(sammeNoder(før, lenker())).toEqual([true, true, true])
    expect(lenker().map((k) => k.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ])
  })

  it("all the way through @get and an SSE stream gives the same", async () => {
    /*
     * The same scenario as the first test, but the patch arrives as a real
     * `datastar-patch-elements` in a `text/event-stream`, fetched by
     * `data-on:click="@get(…)"`. Confirms that the event above is the same
     * path the bundle itself takes.
     */
    const oppdatert = BAR.replace("<p>Innhold</p>", "<p>Oppdatert</p>")
    const strøm = [
      "event: datastar-patch-elements",
      ...oppdatert.split("\n").map((linje) => `data: elements ${linje}`),
      "",
      "",
    ].join("\n")
    const hent = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(strøm, {
          headers: { "Content-Type": "text/event-stream" },
        }),
    )

    try {
      document.body.innerHTML = `${BAR}
        <button id="oppdater" data-on:click="@get('/saken')">Oppdater</button>`
      await waitForPaint()
      // Datastar reads `data-*` in a `setTimeout` after the node arrived.
      await new Promise((ferdig) => setTimeout(ferdig, 20))

      const før = faner()
      const panelFør = paneler()
      før[1].click()
      await waitForPaint()
      expect(valgt()).toEqual(["false", "true", "false"])

      document.getElementById("oppdater")?.click()
      // The links are kept, so the patch is recognised by the content of the first panel.
      await vi.waitFor(() =>
        expect(paneler()[0].textContent).toContain("Oppdatert"),
      )
      await waitForPaint()

      expect(hent).toHaveBeenCalledOnce()
      expect(sammeNoder(før, faner())).toEqual([true, true, true])
      expect(sammeNoder(panelFør, paneler())).toEqual([true, true, true])
      expect(valgt()).toEqual(["false", "true", "false"])
    } finally {
      // Otherwise `fetch` answered with this stream for the rest of the file
      // after a failure here.
      hent.mockRestore()
    }
  })
})

describe("lt-suggestion through Datastar's morph", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  /** Bare markup from a template: the label around the field, no ids, no roles. */
  const FORSLAG_BAR = `<lt-suggestion id="kommune-vert">
  <div>
    <label>Kommune <input class="lt-input"></label>
    <ul class="lt-suggestion__list"><li>Bergen</li><li>Bodø</li><li>Oslo</li></ul>
    <span class="lt-sr-only" role="status"></span>
  </div>
</lt-suggestion>`

  const FORSLAG_MED_ID = `<lt-suggestion id="kommune-vert">
  <label for="kommune">Kommune</label>
  <div>
    <input class="lt-input" id="kommune">
    <ul class="lt-suggestion__list" id="kommune-list"><li id="kommune-option-0">Bergen</li><li id="kommune-option-1">Bodø</li><li id="kommune-option-2">Oslo</li></ul>
    <span class="lt-sr-only" role="status"></span>
  </div>
</lt-suggestion>`

  async function skrivOgPatch(markup: string) {
    document.body.innerHTML = markup
    await customElements.whenDefined("lt-suggestion")
    await waitForPaint()

    const felt = document.querySelector("input") as HTMLInputElement
    const liste = document.querySelector("ul") as HTMLElement
    felt.focus()
    felt.value = "B"
    felt.dispatchEvent(new Event("input", { bubbles: true }))
    felt.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await waitForPaint()
    expect(felt.getAttribute("aria-expanded")).toBe("true")

    patch(markup)
    await waitForPaint()

    const nyttFelt = document.querySelector("input") as HTMLInputElement
    return {
      sammeFelt: nyttFelt === felt,
      sammeListe: document.querySelector("ul") === liste,
      verdi: nyttFelt.value,
      fokus: document.activeElement === nyttFelt,
      åpen: nyttFelt.getAttribute("aria-expanded"),
    }
  }

  it("bare markup: the field is morphed, and what the user typed and focus stay", async () => {
    /*
     * The component writes no id on the field, so Datastar has nothing to
     * recognise it by and morphs it. The list gets an id from the component
     * and is replaced, but it has no state the user loses: the component
     * wires up the new one and opens it again.
     */
    const { sammeListe: _, ...r } = await skrivOgPatch(FORSLAG_BAR)
    expect(r).toEqual({
      sammeFelt: true,
      verdi: "B",
      fokus: true,
      åpen: "true",
    })
  })

  it("id from the server: the field is morphed, and the text, focus and list stay", async () => {
    const r = await skrivOgPatch(FORSLAG_MED_ID)
    expect(r).toEqual({
      sammeFelt: true,
      sammeListe: true,
      verdi: "B",
      fokus: true,
      åpen: "true",
    })
  })
})

describe("lt-popover through Datastar's morph", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  const MENY_BAR = `<lt-popover id="meny-vert">
  <button class="lt-button">Handlinger</button>
  <div class="lt-popover"><button>Slett</button></div>
</lt-popover>`

  /** An id from the server, but `popover` left to the component. */
  const MENY_MED_ID = `<lt-popover id="meny-vert">
  <button class="lt-button" aria-controls="meny">Handlinger</button>
  <div class="lt-popover" id="meny"><button>Slett</button></div>
</lt-popover>`

  /** What `lt.popover()` and the Kotlin binding write. */
  const MENY_MANUAL = `<lt-popover id="meny-vert">
  <button class="lt-button" aria-controls="meny">Handlinger</button>
  <div class="lt-popover" id="meny" popover="manual"><button>Slett</button></div>
</lt-popover>`

  async function åpneOgPatch(markup: string) {
    document.body.innerHTML = markup
    await customElements.whenDefined("lt-popover")
    await waitForPaint()

    const knapp = document.querySelector("lt-popover > button") as HTMLElement
    const panel = document.querySelector(".lt-popover") as HTMLElement
    knapp.click()
    await waitForPaint()
    const slett = panel.querySelector("button") as HTMLButtonElement
    slett.focus()
    expect(panel.matches(":popover-open")).toBe(true)

    patch(markup)
    await waitForPaint()

    const nyttPanel = document.querySelector(".lt-popover") as HTMLElement
    return {
      sammeKnapp: document.querySelector("lt-popover > button") === knapp,
      sammePanel: nyttPanel === panel,
      åpent: nyttPanel.matches(":popover-open"),
      fokusIPanelet: nyttPanel.contains(document.activeElement),
    }
  }

  it("bare markup: the panel is morphed, stays open, and focus stays", async () => {
    // The component writes no id on the panel, so the panel in the page and
    // the one the server sends are the same to the morph. When it wrote an
    // id, the panel was replaced and focus was gone.
    const r = await åpneOgPatch(MENY_BAR)
    expect(r).toEqual({
      sammeKnapp: true,
      sammePanel: true,
      åpent: true,
      fokusIPanelet: true,
    })
  })

  it("id from the server without popover: the panel is morphed and stays open", async () => {
    /*
     * The server did not send `popover`, so the morph removes it along with
     * `open` on the host. The component closes, reopens in the next
     * microtask, and then "closed" from the closing arrives as a separate
     * task. It was taken as the user closing it, and the popover stayed
     * closed after the patch.
     */
    const r = await åpneOgPatch(MENY_MED_ID)
    expect(r).toEqual({
      sammeKnapp: true,
      sammePanel: true,
      åpent: true,
      fokusIPanelet: true,
    })
  })

  it("id and popover from the server: the panel is morphed, stays open, and focus stays", async () => {
    const r = await åpneOgPatch(MENY_MANUAL)
    expect(r).toEqual({
      sammeKnapp: true,
      sammePanel: true,
      åpent: true,
      fokusIPanelet: true,
    })
  })
})

describe("the components warn when a patch replaced the elements", () => {
  let advarsel: MockInstance<typeof console.warn>

  beforeAll(() => {
    defineLtTabs()
    defineLtSuggestion()
    defineLtField()
    defineLtPopover()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
    advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    advarsel.mockRestore()
  })

  /** The warnings that mention that something was replaced. */
  function meldinger(): string[] {
    return advarsel.mock.calls
      .map((call) => String(call[0]))
      .filter((m) => m.includes("replaced the"))
  }

  /**
   * Waits until `warnAboutMarkup` has checked its condition.
   *
   * It waits two frames after the patch landed, and its two are registered
   * after the test's two, so one `waitForPaint` is not enough.
   */
  async function roSeg() {
    await waitForPaint()
    await waitForPaint()
  }

  /** Patches like a `datastar-patch-elements` with a selector and mode. */
  function patchInni(selector: string, elements: string): void {
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-elements",
          el: document.body,
          argsRaw: { selector, mode: "inner", elements },
        },
      }),
    )
  }

  it("lt-tabs: does not warn, since the component writes no id that could be replaced", async () => {
    await klikkOgPatch(BAR)
    await roSeg()
    expect(meldinger()).toEqual([])

    faner()[1].click()
    await waitForPaint()
    patch(BAR)
    await roSeg()
    expect(valgt()).toEqual(["false", "true", "false"])
    expect(meldinger()).toEqual([])
  })

  it("lt-tabs: not on a narrow patch, where the selection stays", async () => {
    document.body.innerHTML = BAR
    await waitForPaint()
    faner()[1].click()
    await waitForPaint()

    patchInni("#saken > section:last-child", "Tre nye meldinger.")
    await roSeg()
    expect(valgt()).toEqual(["false", "true", "false"])
    expect(paneler()[2].textContent).toBe("Tre nye meldinger.")
    // The heading disappeared in the patch, so the name is the tab's text.
    expect(paneler()[2].getAttribute("aria-label")).toBe("Meldinger")
    expect(meldinger()).toEqual([])
  })

  const FORSLAG = (id: string) => `<lt-suggestion id="kommune-vert">
  <label for="${id}">Kommune</label>
  <div>
    <input class="lt-input" name="kommune" id="${id}">
    <ul class="lt-suggestion__list"><li>Bergen</li><li>Bodø</li></ul>
    <span class="lt-sr-only" role="status"></span>
  </div>
</lt-suggestion>`

  async function skrivOgPatchForslag(markup: string, tekst: string) {
    document.body.innerHTML = markup
    await waitForPaint()
    const felt = document.querySelector("input") as HTMLInputElement
    felt.focus()
    felt.value = tekst
    felt.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()
    patch(markup)
    await roSeg()
  }

  it("lt-suggestion: when the id from the server changed between two renders", async () => {
    document.body.innerHTML = FORSLAG("kommune-1")
    await waitForPaint()
    const felt = document.querySelector("input") as HTMLInputElement
    felt.focus()
    felt.value = "B"
    felt.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()
    patch(FORSLAG("kommune-2"))
    await roSeg()
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "lt-suggestion: a server update replaced the field",
    )
  })

  it("lt-suggestion: not when the server wrote the same id", async () => {
    await skrivOgPatchForslag(FORSLAG("kommune"), "B")
    expect(meldinger()).toEqual([])
  })

  /** A field wrapped in its label, optionally with an id from the server. */
  const FELT = (id: string, verdi = "") => `<lt-field id="navn-vert">
  <label>Navn <input class="lt-input" name="navn"${id}${verdi}></label>
</lt-field>`

  async function skrivOgPatchFelt(foer: string, etter: string, tekst: string) {
    document.body.innerHTML = foer
    await waitForPaint()
    const felt = document.querySelector("input") as HTMLInputElement
    felt.value = tekst
    patch(etter)
    await roSeg()
    return felt
  }

  it("lt-field: bare markup keeps the field and the text, without a warning", async () => {
    /*
     * The component writes no id on the control, so Datastar has nothing to
     * recognise it by and morphs it. The node, and the text the user typed,
     * stay. The component used to write an id, and that id was exactly what
     * made the field get replaced.
     */
    const gammel = await skrivOgPatchFelt(FELT(""), FELT(""), "Kari")
    const felt = document.querySelector("input") as HTMLInputElement
    expect(felt).toBe(gammel)
    expect(felt.value).toBe("Kari")
    expect(meldinger()).toEqual([])
  })

  it("lt-field: when the id from the server changed between two renders", async () => {
    await skrivOgPatchFelt(FELT(' id="navn-1"'), FELT(' id="navn-2"'), "Kari")
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "lt-field: a server update replaced the control",
    )
  })

  it("lt-field: not when the server wrote the same id", async () => {
    const gammel = await skrivOgPatchFelt(
      FELT(' id="navn"'),
      FELT(' id="navn"'),
      "Kari",
    )
    expect(document.querySelector("input")).toBe(gammel)
    expect(meldinger()).toEqual([])
  })

  it("lt-field: not when the user had not typed anything", async () => {
    await skrivOgPatchFelt(FELT(' id="navn-1"'), FELT(' id="navn-2"'), "")
    expect(meldinger()).toEqual([])
  })

  it("lt-field: not when the server sends the text back", async () => {
    // The server did what the message asks for. Then nothing is lost, even
    // though the node is new.
    await skrivOgPatchFelt(
      FELT(' id="navn-1"'),
      FELT(' id="navn-2"', ' value="Kari"'),
      "Kari",
    )
    expect((document.querySelector("input") as HTMLInputElement).value).toBe(
      "Kari",
    )
    expect(meldinger()).toEqual([])
  })

  it("lt-field: not for a bare <select> the user left alone", async () => {
    // The browser selects the first option without anything being
    // `defaultSelected`, so a comparison with that saw a choice the user
    // never made.
    const valg = `<lt-field id="land-vert">
  <label>Land <select class="lt-select"><option>Norge</option><option>Sverige</option></select></label>
</lt-field>`
    document.body.innerHTML = valg
    await waitForPaint()
    patch(valg)
    await roSeg()
    expect(meldinger()).toEqual([])
  })

  it("lt-field: a checked box without an id stays after the patch", async () => {
    const boks = `<lt-field id="samtykke-vert">
  <label><input class="lt-checkbox" type="checkbox" name="samtykke"> Samtykke</label>
</lt-field>`
    document.body.innerHTML = boks
    await waitForPaint()
    const gammel = document.querySelector("input") as HTMLInputElement
    gammel.checked = true
    patch(boks)
    await roSeg()
    const ny = document.querySelector("input") as HTMLInputElement
    expect(ny).toBe(gammel)
    expect(ny.checked).toBe(true)
    expect(meldinger()).toEqual([])
  })

  it("lt-field: when a checked box is replaced because the id changed", async () => {
    // `value` and `defaultValue` are always equal on a checkbox, so a
    // comparison of them never saw that the check was gone.
    const boks = (id: string) => `<lt-field id="samtykke-vert">
  <label><input class="lt-checkbox" type="checkbox" name="samtykke" id="${id}"> Samtykke</label>
</lt-field>`
    document.body.innerHTML = boks("samtykke-1")
    await waitForPaint()
    ;(document.querySelector("input") as HTMLInputElement).checked = true
    patch(boks("samtykke-2"))
    await roSeg()
    expect((document.querySelector("input") as HTMLInputElement).checked).toBe(
      false,
    )
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "lt-field: a server update replaced the control",
    )
  })

  const MENY = (id: string) => `<lt-popover id="meny-vert">
  <button class="lt-button"${id && ' aria-controls="meny"'}>Handlinger</button>
  <div class="lt-popover"${id} popover="manual"><button>Slett</button></div>
</lt-popover>`

  async function apneOgPatchMeny(markup: string, apne: boolean) {
    document.body.innerHTML = markup
    await waitForPaint()
    if (apne) {
      ;(document.querySelector("lt-popover > button") as HTMLElement).click()
      await waitForPaint()
    }
    patch(markup)
    await roSeg()
  }

  it("lt-popover: when the id from the server changed while the popover was open", async () => {
    // How a template writes it when the id is made from a counter.
    const meny = (id: string) => `<lt-popover id="meny-vert">
  <button class="lt-button" aria-controls="${id}">Handlinger</button>
  <div class="lt-popover" id="${id}" popover="manual"><button>Slett</button></div>
</lt-popover>`
    document.body.innerHTML = meny("meny-1")
    await waitForPaint()
    ;(document.querySelector("lt-popover > button") as HTMLElement).click()
    await waitForPaint()
    patch(meny("meny-2"))
    await roSeg()
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "lt-popover: a server update replaced the panel",
    )
  })

  it("lt-popover: not when the panel is bare, since it is then kept", async () => {
    await apneOgPatchMeny(MENY(""), true)
    expect(meldinger()).toEqual([])
  })

  it("lt-popover: not when the server wrote an id", async () => {
    await apneOgPatchMeny(MENY(' id="meny"'), true)
    expect(meldinger()).toEqual([])
  })

  it("lt-popover: not when the popover was closed", async () => {
    await apneOgPatchMeny(MENY(""), false)
    expect(meldinger()).toEqual([])
  })
})
