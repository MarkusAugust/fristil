/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineLtSuggestion, type LtSuggestion } from "./lt-suggestion"
import { suggestion } from "./suggestion"

import "../../../tokens/tokens.css"
import "./suggestion.css"
import "../../css/sr-only/sr-only.css"

const KOMMUNER = ["Bergen", "Bodø", "Oslo", "Tromsø"]
const NOKLER = ["bergen", "bodo", "oslo", "tromso"]

/** The markup the server sends. The field and the list exist before the script has run. */
const FORSLAG = suggestion({
  id: "kommune",
  keys: NOKLER,
  help: true,
})

async function tegn() {
  await customElements.whenDefined("lt-suggestion")
  await waitForPaint()
  return document.querySelector("lt-suggestion") as LtSuggestion
}

function skriv(felt: LtSuggestion, tekst: string) {
  const input = felt.querySelector("input") as HTMLInputElement
  input.value = tekst
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("lt-suggestion", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  beforeEach(async () => {
    mount(`
      <lt-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(FORSLAG.empty)} hidden>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
        <p class="lt-help-text" ${attr(FORSLAG.help)}>Begynn å skrive</p>
      </lt-suggestion>
    `)
    await tegn()
  })

  it("is a real field before the script has run", () => {
    // The web component used to render the whole field itself. Then there was
    // nothing to fill in, and nothing was included in the submission.
    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement

    expect(input.name).toBe("kommune")
    expect(label.htmlFor).toBe(input.id)
    expect(input.getAttribute("role")).toBe("combobox")
    expect(input.getAttribute("aria-autocomplete")).toBe("list")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.querySelectorAll("[role='option']")).toHaveLength(4)
  })

  it("does not ask the template to preserve anything", () => {
    // What the list shows and what is highlighted come from the user, and the
    // web component sets them back itself after a patch. If
    // `data-preserve-attr` comes back here, someone has revived the contract
    // the template had to copy from the documentation.
    const input = document.querySelector("input") as HTMLInputElement
    const liste = document.querySelector("[role='listbox']") as HTMLElement
    const valg = document.querySelectorAll("[role='option']")

    expect(input.hasAttribute("data-preserve-attr")).toBe(false)
    expect(liste.hasAttribute("data-preserve-attr")).toBe(false)
    for (const v of valg)
      expect(v.hasAttribute("data-preserve-attr")).toBe(false)
  })

  it("narrows the suggestions while the user types", async () => {
    const felt = await tegn()
    skriv(felt, "bo")
    await tegn()

    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)

    expect(synlige.map((o) => o.textContent?.trim())).toEqual(["Bodø"])
  })

  it("announces the number of matches to screen readers", async () => {
    const felt = await tegn()
    skriv(felt, "bod")
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("One match")
  })

  it("moves the highlight with the arrow keys and points to it with aria", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()

    const aktiv = felt.querySelector("[aria-selected='true']") as HTMLElement
    expect(aktiv.textContent?.trim()).toBe("Bergen")
    // Focus stays in the field. aria-activedescendant is what makes the
    // screen reader announce the option anyway.
    expect(input.getAttribute("aria-activedescendant")).toBe(aktiv.id)
  })

  it("chooses with Enter and reports it", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const valgt: string[] = []
    felt.addEventListener("suggestion-select", (hendelse) => {
      valgt.push(hendelse.detail.value)
    })

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    )
    await tegn()

    expect(input.value).toBe("Bergen")
    expect(valgt).toEqual(["Bergen"])
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("says so when nothing matches", async () => {
    const felt = await tegn()
    skriv(felt, "xyz")
    await tegn()

    const tom = felt.querySelector(".lt-suggestion__empty") as HTMLElement
    expect(tom.hidden).toBe(false)
    expect(
      (felt.querySelector("[role='status']") as HTMLElement).textContent,
    ).toBe("No matches")
  })

  it("closes the list on Escape", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    skriv(felt, "bo")
    await tegn()

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
    await tegn()

    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    expect(liste.hidden).toBe(true)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("does not filter when something else already has", async () => {
    const felt = await tegn()
    felt.setAttribute("prefiltered", "")
    skriv(felt, "xyz")
    await tegn()

    // The server or React has already decided what is shown. Then the web
    // component must keep its hands off.
    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)
    expect(synlige).toHaveLength(4)
  })

  it("can be set as a property, the way React 19 does it", async () => {
    /*
     * React writes the property rather than the attribute when a web
     * component has one with that name. With only a getter the write threw
     * "Cannot set property", the attribute never landed, and the web component
     * hid what React had just rendered.
     */
    const felt = await tegn()

    felt.prefiltered = true
    expect(felt.hasAttribute("prefiltered")).toBe(true)

    felt.prefiltered = false
    expect(felt.hasAttribute("prefiltered")).toBe(false)
  })

  it("announces the number of matches when whoever filtered has rendered the list", async () => {
    /*
     * The message follows the list, not the keystroke. `prefiltered` turns off
     * the hiding, not the announcement: the first version returned at once,
     * and then a Datastar app was left with no word of how many matches were
     * left. It was not written anywhere, and people who cannot see the screen
     * noticed.
     */
    const felt = await tegn()
    felt.prefiltered = true
    const status = felt.querySelector("[role='status']") as HTMLElement

    skriv(felt, "b")
    await tegn()
    expect(
      status.textContent,
      "announced a count before whoever filtered had answered",
    ).toBe("")

    // The way a server or React would do it: everything except one is hidden.
    const valg = [...felt.querySelectorAll<HTMLElement>("[role='option']")]
    for (const [i, alternativ] of valg.entries()) alternativ.hidden = i !== 0
    await tegn()

    expect(status.textContent).toBe("One match")
  })

  it("leaves the empty message alone when something else filtered", async () => {
    /*
     * The empty message is part of what the list shows, and whoever filtered
     * decides that. The web component cannot tell "the search found nothing"
     * from "the answer has not arrived yet", and so made the message visible
     * again in the middle of an asynchronous search, with no way around it.
     */
    const felt = await tegn()
    felt.prefiltered = true
    const tom = felt.querySelector(".lt-suggestion__empty") as HTMLElement

    // The app is waiting for an answer: no options, and the message stays hidden.
    for (const alternativ of felt.querySelectorAll("[role='option']"))
      alternativ.remove()
    skriv(felt, "xyz")
    await tegn()
    expect(tom.hidden, 'the web component showed "No matches" itself').toBe(
      true,
    )

    // The app answers that nothing matched, and shows the message itself.
    tom.hidden = false
    skriv(felt, "xyzæ")
    await tegn()
    expect(tom.hidden, 'the web component hid the app\'s "No matches"').toBe(
      false,
    )
  })

  it("has no accessibility violations with the list open", async () => {
    const felt = await tegn()
    skriv(felt, "o")
    await tegn()

    await expectNoAccessibilityViolations()
  })
})

/**
 * A prefiltered field that has not yet got anything to show.
 *
 * This is the markup from the Datastar tab in the documentation: the list is
 * empty until the server has sent something. Had the web component counted
 * on focus, the field would have announced "No matches" before the user had
 * typed a character, to exactly the people who cannot see the screen, and
 * the empty message would have been visible on a field nobody had searched
 * in.
 */
describe("lt-suggestion waiting for the first answer", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  beforeEach(async () => {
    const tomt = suggestion({ id: "kommune", keys: [] })

    mount(`
      <lt-suggestion prefiltered>
        <label ${attr(tomt.label)}>Kommune</label>
        <div>
          <input ${attr(tomt.control)} name="kommune">
          <ul ${attr(tomt.list)}></ul>
          <p ${attr(tomt.empty)}>Ingen treff</p>
          <span ${attr(tomt.status)}></span>
        </div>
      </lt-suggestion>
    `)
    await tegn()
  })

  it("says nothing on focus", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(new FocusEvent("focus"))
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("")
    // The builder function no longer writes `hidden` on an empty list. What
    // keeps the message away is that an empty list below an empty field is not
    // opened, and that the stylesheet hides the message after a closed list.
    const liste = felt.querySelector("ul") as HTMLElement
    const tom = felt.querySelector(".lt-suggestion__empty") as HTMLElement
    expect(liste.hidden, "an empty list opened on focus").toBe(true)
    expect(
      getComputedStyle(tom).display,
      'showed "No matches" before anyone had searched',
    ).toBe("none")
  })

  it("reports when the server has sent the list", async () => {
    const felt = await tegn()
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    // The way a patch would do it.
    liste.innerHTML = `
      <li class="lt-suggestion__option" id="kommune-option-bergen" role="option">Bergen</li>
      <li class="lt-suggestion__option" id="kommune-option-bodo" role="option">Bodø</li>
    `
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("2 matches")
  })
})

/**
 * The server can also decide which option is active.
 *
 * `lt.suggestion({ activeIndex })` writes `aria-selected="true"` on one of
 * them. Had the web component kept a separate counter, the first arrow key
 * would jump to the top of the list instead of to the next option, and the
 * highlight the server had just sent would be gone.
 */
describe("lt-suggestion with the highlight from the server", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  beforeEach(async () => {
    const fra = suggestion({
      id: "kommune",
      keys: NOKLER,
      open: true,
      activeIndex: 2,
    })

    mount(`
      <lt-suggestion>
        <label ${attr(fra.label)}>Kommune</label>
        <div>
          <input ${attr(fra.control)} name="kommune">
          <ul ${attr(fra.list)}>
            ${fra.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(fra.empty)}>Ingen treff</p>
          <span ${attr(fra.status)}></span>
        </div>
      </lt-suggestion>
    `)
    await tegn()
  })

  it("moves on from what the server highlighted", async () => {
    const felt = document.querySelector("lt-suggestion") as LtSuggestion
    const input = felt.querySelector("input") as HTMLInputElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    expect(valg[2].getAttribute("aria-selected")).toBe("true")

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await waitForPaint()

    expect(
      valg[3].getAttribute("aria-selected"),
      "the arrow key did not move to the option after the one the server highlighted",
    ).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[3].id)
  })
})

describe("lt-suggestion with arrow up", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  beforeEach(async () => {
    mount(`
      <lt-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(FORSLAG.empty)}>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </lt-suggestion>
    `)
    await tegn()
  })

  it("opens the list and goes to the last option", async () => {
    const felt = document.querySelector("lt-suggestion") as LtSuggestion
    const input = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    )
    await waitForPaint()

    // Without the opening, aria-activedescendant pointed into a list the
    // field at the same time reported as closed.
    expect(liste.hidden, "the list was not opened").toBe(false)
    expect(input.getAttribute("aria-expanded")).toBe("true")

    const siste = valg[valg.length - 1]
    expect(
      siste.getAttribute("aria-selected"),
      "arrow up did not go to the last option",
    ).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(siste.id)
  })
})

describe("lt-suggestion closes and cleans up", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  function markup(ekstraVert = "") {
    return `
      <lt-suggestion ${ekstraVert}>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
          </ul>
          <p ${attr(FORSLAG.empty)}>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </lt-suggestion>
      <input id="neste-felt" />
    `
  }

  const tast = (input: HTMLInputElement, key: string) =>
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))

  it("closes the list when focus leaves the field", async () => {
    // Tab moved on to the next field, and the list stayed over it with
    // `aria-expanded="true"` on a field that no longer had focus.
    mount(markup())
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    input.focus()
    await tegn()
    expect(liste.hidden).toBe(false)
    ;(document.getElementById("neste-felt") as HTMLInputElement).focus()
    await tegn()

    expect(liste.hidden).toBe(true)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("closes the list when focus leaves the web component through a button inside it", async () => {
    // A button next to the field is inside the web component, so the list
    // stays when focus goes there. If focus moves on out from there, the list
    // must close then too.
    mount(`
      <lt-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <button type="button" id="tom-knapp">Tøm</button>
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
          </ul>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </lt-suggestion>
      <input id="neste-felt" />
    `)
    const felt = await tegn()
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    ;(felt.querySelector("input") as HTMLInputElement).focus()
    await tegn()
    ;(document.getElementById("tom-knapp") as HTMLElement).focus()
    await tegn()
    expect(liste.hidden, "the list closed for a button inside").toBe(false)
    ;(document.getElementById("neste-felt") as HTMLElement).focus()
    await tegn()

    expect(liste.hidden).toBe(true)
  })

  it("keeps the list open when the user clicks the field inside a shadow root", async () => {
    // The documentation's previews live in a shadow root. The listener on
    // `document` saw `event.target` retargeted to the shadow host, counted the
    // click as outside, and closed the list in the same click that opened it.
    const vert = document.createElement("div")
    document.body.append(vert)
    const rot = vert.attachShadow({ mode: "open" })
    rot.innerHTML = markup()
    await customElements.whenDefined("lt-suggestion")
    await waitForPaint()

    const input = rot.querySelector("input") as HTMLInputElement
    const liste = rot.querySelector("[role='listbox']") as HTMLElement
    input.focus()
    input.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    )
    await waitForPaint()

    expect(liste.hidden, "the list was closed by the click in the field").toBe(
      false,
    )
    vert.remove()
  })

  it('hides "No matches" together with the list', async () => {
    // The empty message is a sibling of the list, not a child, so `hidden` on
    // the list did not hide it, and it stayed below a closed field.
    mount(markup())
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const tom = felt.querySelector(".lt-suggestion__empty") as HTMLElement

    skriv(felt, "xyz")
    await tegn()
    expect(tom.hidden).toBe(false)

    tast(input, "Escape")
    await tegn()
    expect(tom.hidden).toBe(true)
    expect(getComputedStyle(tom).display).toBe("none")
  })

  it("does not open the list again when server-controlled is set and removed", async () => {
    mount(markup())
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    tast(input, "ArrowDown")
    await tegn()
    expect(liste.hidden).toBe(false)

    // The server takes over and closes the list. Then it lets go again. Had
    // the web component remembered that the list was open, it would have
    // opened it again on the next patch.
    felt.setAttribute("server-controlled", "")
    liste.hidden = true
    input.setAttribute("aria-expanded", "false")
    await tegn()
    felt.removeAttribute("server-controlled")
    input.setAttribute("aria-expanded", "false")
    await tegn()

    expect(liste.hidden).toBe(true)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("clears the highlight when the highlighted option is filtered out, also with server-controlled", async () => {
    mount(markup("server-controlled"))
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    tast(input, "ArrowDown")
    await tegn()
    const bergen = felt.querySelector("[role='option']") as HTMLElement
    expect(bergen.getAttribute("aria-selected")).toBe("true")

    skriv(felt, "o")
    await tegn()

    expect(bergen.hidden).toBe(true)
    expect(bergen.getAttribute("aria-selected")).toBe("false")
    expect(input.getAttribute("aria-activedescendant")).toBeNull()
  })

  it("finds the options by role, not by class", async () => {
    mount(`
      <lt-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            <li id="egen-0" role="option">Bergen</li>
            <li id="egen-1" role="option">Oslo</li>
          </ul>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </lt-suggestion>
    `)
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    tast(input, "ArrowDown")
    await tegn()
    expect(input.getAttribute("aria-activedescendant")).toBe("egen-0")

    skriv(felt, "os")
    await tegn()
    expect((document.getElementById("egen-0") as HTMLElement).hidden).toBe(true)
    expect((document.getElementById("egen-1") as HTMLElement).hidden).toBe(
      false,
    )
  })

  it("leaves a narrower filter in the app alone", async () => {
    /*
     * The app renders only the matches of a `startsWith` search, without
     * `prefiltered`. Everything it keeps also contains the search term, so the
     * web component's filter hides none of it. The claim is in the
     * documentation, and here.
     */
    const smalt = suggestion({ id: "sted", keys: ["a", "b"] })
    mount(`
      <lt-suggestion>
        <label ${attr(smalt.label)}>Sted</label>
        <div>
          <input ${attr(smalt.control)} value="o">
          <ul ${attr(smalt.list)}>
            <li ${attr(smalt.options[0])}>Oslo</li>
            <li ${attr(smalt.options[1])}>Odda</li>
          </ul>
          <span ${attr(smalt.status)}></span>
        </div>
      </lt-suggestion>
    `)
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.focus()
    await tegn()

    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)
    expect(synlige.map((o) => o.textContent)).toEqual(["Oslo", "Odda"])
    expect(
      (felt.querySelector("[role='status']") as HTMLElement).textContent,
    ).toBe("2 matches")
  })
})

describe("lt.suggestion() writes what the web component would otherwise write", () => {
  it("writes hidden on the empty message when there are matches or the answer is on its way", () => {
    // That the list is closed is no longer checked here: the stylesheet hides
    // the message after a closed list, and "the empty message when the app
    // filters itself" checks that it is actually not shown on page load.
    expect(suggestion({ id: "k", keys: [] }).empty.hidden).toBe(undefined)
    expect(suggestion({ id: "k", keys: [], pending: true }).empty.hidden).toBe(
      true,
    )
    expect(
      suggestion({ id: "k", keys: ["a", "b"], open: true }).empty.hidden,
    ).toBe(true)
  })

  it("writes the highlight only when the list is open, both halves together", () => {
    const lukket = suggestion({
      id: "k",
      keys: ["a", "b", "c"],
      activeIndex: 1,
    })
    expect(lukket.options[1]["aria-selected"]).toBe("false")
    expect(lukket.control["aria-activedescendant"]).toBeUndefined()

    const apen = suggestion({
      id: "k",
      keys: ["a", "b", "c"],
      activeIndex: 1,
      open: true,
    })
    expect(apen.options[1]["aria-selected"]).toBe("true")
    expect(apen.control["aria-activedescendant"]).toBe("k-option-b")
  })
})

/*
 * Markup written without JavaScript: a label with `for`, a field with `id`,
 * a list with `<li>` and a status element, with no roles or wiring
 * otherwise. `for` and `id` are what HTML requires for the field to have a
 * name without JavaScript, and the web component never writes an id on the
 * field. It fills in the rest. The status element must be written: it is
 * content the server sends.
 */
const BAR = `
  <lt-suggestion>
    <label for="kommune">Kommune</label>
    <div>
      <input class="lt-input" id="kommune" name="kommune">
      <ul class="lt-suggestion__list">
        ${KOMMUNER.map((k) => `<li>${k}</li>`).join("")}
      </ul>
      <p class="lt-suggestion__empty" hidden>Ingen treff</p>
      <span class="lt-sr-only" role="status"></span>
    </div>
  </lt-suggestion>`

describe("lt-suggestion wires up from bare structure", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  function deler() {
    return {
      felt: document.querySelector("lt-suggestion") as LtSuggestion,
      label: document.querySelector("label") as HTMLLabelElement,
      input: document.querySelector("input") as HTMLInputElement,
      liste: document.querySelector("ul") as HTMLElement,
      valg: [...document.querySelectorAll<HTMLElement>("li")],
    }
  }

  it("sets roles, ids and wiring, and keeps the list closed", async () => {
    mount(BAR)
    await tegn()
    const { felt, label, input, liste, valg } = deler()

    expect(input.getAttribute("role")).toBe("combobox")
    expect(input.getAttribute("autocomplete")).toBe("off")
    expect(input.getAttribute("aria-autocomplete")).toBe("list")
    expect(input.id).toBe("kommune")
    expect(label.htmlFor).toBe("kommune")
    expect(label.classList.contains("lt-label")).toBe(true)
    expect(liste.getAttribute("role")).toBe("listbox")
    expect(liste.id).not.toBe("")
    expect(input.getAttribute("aria-controls")).toBe(liste.id)
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(liste.hidden).toBe(true)
    for (const v of valg) {
      expect(v.getAttribute("role")).toBe("option")
      expect(v.id).not.toBe("")
      expect(v.classList.contains("lt-suggestion__option")).toBe(true)
    }

    skriv(felt, "b")
    await waitForPaint()
    expect(liste.hidden).toBe(false)
    expect(valg.filter((v) => !v.hidden).map((v) => v.textContent)).toEqual([
      "Bergen",
      "Bodø",
    ])
    expect(document.querySelector("[role='status']")?.textContent).toBe(
      "2 matches",
    )

    await expectNoAccessibilityViolations()
  })

  it("leaves what the server wrote", async () => {
    mount(
      BAR.replace('<label for="kommune">', '<label for="egen">')
        .replace(
          '<input class="lt-input" id="kommune" name="kommune">',
          '<input class="lt-input" name="kommune" id="egen" aria-expanded="true">',
        )
        .replace(
          '<ul class="lt-suggestion__list">',
          '<ul class="lt-suggestion__list" id="egen-liste">',
        ),
    )
    await tegn()
    const { label, input, liste } = deler()

    expect(input.id).toBe("egen")
    expect(label.htmlFor).toBe("egen")
    expect(liste.id).toBe("egen-liste")
    expect(input.getAttribute("aria-controls")).toBe("egen-liste")
    // The server said the list is open, and then it stays open.
    expect(input.getAttribute("aria-expanded")).toBe("true")
    expect(liste.hidden).toBe(false)
  })

  it("sets the wiring back with the same ids after a patch", async () => {
    mount(BAR)
    await tegn()
    const { label, input, liste, valg } = deler()
    const ider = [input.id, liste.id, valg[0].id]

    // The way a morph does it: everything not in the server's HTML is
    // removed. The field's id and the label's `for` were there, and stay.
    for (const navn of [
      "role",
      "aria-controls",
      "aria-expanded",
      "autocomplete",
      "aria-autocomplete",
    ]) {
      input.removeAttribute(navn)
    }
    for (const navn of ["role", "id", "hidden"]) liste.removeAttribute(navn)
    for (const navn of ["role", "id", "class"]) valg[0].removeAttribute(navn)
    await waitForPaint()

    expect([input.id, liste.id, valg[0].id]).toEqual(ider)
    expect(label.htmlFor).toBe(ider[0])
    expect(input.getAttribute("aria-controls")).toBe(ider[1])
    expect(valg[0].getAttribute("role")).toBe("option")
    expect(liste.hidden).toBe(true)
  })

  it("writes nothing on markup from lt.suggestion()", async () => {
    // The direct claim behind "what the server wrote stays": zero mutation
    // records from the web component's first round.
    const omslag = document.createElement("div")
    omslag.innerHTML = `
      <lt-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
          </ul>
          <p ${attr(FORSLAG.empty)} hidden>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
        <p class="lt-help-text" ${attr(FORSLAG.help)}>Begynn å skrive</p>
      </lt-suggestion>`
    const vert = omslag.querySelector("lt-suggestion") as HTMLElement
    const poster: MutationRecord[] = []
    const observatør = new MutationObserver((r) => poster.push(...r))
    observatør.observe(vert, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    document.body.append(omslag)
    await tegn()

    expect(poster.map((p) => `${p.type} ${p.attributeName}`)).toEqual([])
    observatør.disconnect()
    omslag.remove()
  })
})

describe("the empty message when the app filters itself", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  /** The way a React app renders the field: only the matches, and `prefiltered`. */
  async function felt(valg: { keys: string[]; pending?: boolean }) {
    const forslag = suggestion({ id: "kommune", ...valg })
    mount(`
      <lt-suggestion prefiltered>
        <label ${attr(forslag.label)}>Kommune</label>
        <div>
          <input ${attr(forslag.control)} name="kommune">
          <ul ${attr(forslag.list)}>${forslag.options
            .map((valg, i) => `<li ${attr(valg)}>Treff ${i}</li>`)
            .join("")}</ul>
          <p ${attr(forslag.empty)}>Ingen treff</p>
          <span ${attr(forslag.status)}></span>
        </div>
      </lt-suggestion>
    `)
    const vert = await tegn()
    return {
      input: vert.querySelector("input") as HTMLInputElement,
      liste: vert.querySelector("ul") as HTMLElement,
      tom: vert.querySelector(".lt-suggestion__empty") as HTMLElement,
    }
  }

  const synlig = (element: HTMLElement) =>
    getComputedStyle(element).display !== "none"

  it("does not show the message while the list is closed, even without matches", async () => {
    // The app does not know whether the list is open: that state belongs to
    // the web component. The stylesheet hides the message after a list with
    // `hidden`.
    const { liste, tom } = await felt({ keys: [] })

    expect(liste.hidden).toBe(true)
    expect(tom.hasAttribute("hidden")).toBe(false)
    expect(synlig(tom)).toBe(false)
  })

  it("shows the message when the list opens and the search found nothing", async () => {
    const { input, liste, tom } = await felt({ keys: [] })

    input.focus()
    input.value = "xyz"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await tegn()

    expect(liste.hidden, "the list did not open").toBe(false)
    expect(synlig(tom)).toBe(true)
  })

  it("keeps the message hidden while the answer is on its way", async () => {
    const { input, liste, tom } = await felt({ keys: [], pending: true })

    input.focus()
    input.value = "xyz"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await tegn()

    expect(liste.hidden).toBe(false)
    expect(synlig(tom)).toBe(false)
  })

  it("hides the message when there are matches", async () => {
    const { tom } = await felt({ keys: ["a", "b"] })
    expect(tom.hasAttribute("hidden")).toBe(true)
  })
})

describe("lt-suggestion when a patch replaces the field or the list", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  it("never writes an id on a new field, and gives the list the id the field points to", async () => {
    /*
     * The web component used to invent an id for a new field without one. That
     * very id made the next update from the server replace the field, with
     * focus and what the user had typed. The list holds no state the user can
     * lose, and still gets the id the field already points to.
     */
    mount(`
      <lt-suggestion>
        <label>Kommune
          <input class="lt-input">
        </label>
        <div>
          <ul class="lt-suggestion__list"><li>Oslo</li></ul>
          <p class="lt-suggestion__empty">Ingen treff</p>
          <span class="lt-suggestion__status" role="status"></span>
        </div>
      </lt-suggestion>
    `)
    const vert = await tegn()
    const listepeker = (
      vert.querySelector("input") as HTMLElement
    ).getAttribute("aria-controls")

    const nyttFelt = document.createElement("input")
    nyttFelt.className = "lt-input"
    nyttFelt.setAttribute("aria-controls", listepeker ?? "")
    vert.querySelector("input")?.replaceWith(nyttFelt)
    const nyListe = document.createElement("ul")
    nyListe.className = "lt-suggestion__list"
    nyListe.innerHTML = "<li>Bergen</li>"
    vert.querySelector("ul")?.replaceWith(nyListe)
    await tegn()

    expect(nyttFelt.hasAttribute("id")).toBe(false)
    expect(nyListe.id, "aria-controls points to nothing").toBe(listepeker)
  })
})

describe("lt-suggestion announces the count in the page's language", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  /** The suggestion field on a page with `lang`, and the texts as attributes. */
  async function felt(lang: string, attributter: string) {
    mount(`
      <div lang="${lang}">
        <lt-suggestion ${attributter}>
          <label ${attr(FORSLAG.label)}>Municipality</label>
          <div>
            <input ${attr(FORSLAG.control)} name="kommune">
            <ul ${attr(FORSLAG.list)}>
              ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n")}
            </ul>
            <span ${attr(FORSLAG.status)}></span>
          </div>
        </lt-suggestion>
      </div>
    `)
    return tegn()
  }

  async function opplest(element: LtSuggestion, tekst: string) {
    skriv(element, tekst)
    await tegn()
    return (element.querySelector("[role='status']") as HTMLElement).textContent
  }

  it("uses the form the language requires, with the number filled in", async () => {
    const element = await felt(
      "en",
      'count-none="No results" count-one="{n} result" count-other="{n} results"',
    )

    expect(await opplest(element, "bod")).toBe("1 result")
    expect(await opplest(element, "o")).toBe("3 results")
    expect(await opplest(element, "xyz")).toBe("No results")
  })

  it("falls back to count-other when a form is missing", async () => {
    // English has the form `one`. When only `count-other` is set, it must
    // apply to one match as well, rather than the announcement falling back to
    // the default text.
    const element = await felt("en", 'count-other="{n} results"')

    expect(await opplest(element, "bod")).toBe("1 results")
    expect(await opplest(element, "xyz")).toBe("0 results")
  })

  it("picks the inflection by language, not by the number alone", async () => {
    // Polish has four forms. 2, 3 and 4 are `few`, and 1 is `one`.
    const element = await felt(
      "pl",
      'count-one="{n} wynik" count-few="{n} wyniki" count-many="{n} wyników" count-other="{n} wyniku"',
    )

    expect(await opplest(element, "o")).toBe("3 wyniki")
    expect(await opplest(element, "bod")).toBe("1 wynik")
  })

  it("uses the default text when no text is set", async () => {
    const element = await felt("en", "")

    expect(await opplest(element, "bod")).toBe("One match")
    expect(await opplest(element, "o")).toBe("3 matches")
  })
})

/**
 * Imitates the value tracking React adds to a controlled field: a `value`
 * of its own on the node that remembers the last value set through it, and
 * `onChange` only when the value from the prototype differs.
 */
function kontrollertAvReact(felt: HTMLInputElement | HTMLTextAreaElement) {
  const opprinnelig = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(felt),
    "value",
  ) as PropertyDescriptor
  let husket = felt.value
  Object.defineProperty(felt, "value", {
    configurable: true,
    get() {
      return opprinnelig.get?.call(this)
    },
    set(verdi) {
      husket = `${verdi}`
      opprinnelig.set?.call(this, verdi)
    },
  })
  const endringer: string[] = []
  felt.addEventListener("input", () => {
    const faktisk = opprinnelig.get?.call(felt) as string
    if (faktisk !== husket) {
      husket = faktisk
      endringer.push(faktisk)
    }
  })
  return endringer
}

describe("lt-suggestion with a field React controls", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  for (const kontroll of [
    '<input id="kommune" role="combobox" aria-controls="kommune-liste" aria-expanded="false" aria-autocomplete="list">',
    '<textarea id="kommune" role="combobox" aria-controls="kommune-liste" aria-expanded="false" aria-autocomplete="list"></textarea>',
  ]) {
    it(`gives onChange the chosen option (${kontroll.slice(1, 6)})`, async () => {
      // Set directly on the node, React saw no change, and wrote the old text
      // back on the next render.
      mount(`
        <lt-suggestion>
          <label for="kommune">Kommune</label>
          <div>
            ${kontroll}
            <ul class="lt-suggestion__list" role="listbox" id="kommune-liste" hidden>
              <li role="option" id="kommune-0">Bergen</li>
              <li role="option" id="kommune-1">Oslo</li>
            </ul>
          </div>
        </lt-suggestion>`)
      const felt = document.getElementById("kommune") as
        | HTMLInputElement
        | HTMLTextAreaElement
      const endringer = kontrollertAvReact(felt)
      await customElements.whenDefined("lt-suggestion")
      await waitForPaint()

      felt.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      )
      await waitForPaint()
      felt.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      )
      await waitForPaint()

      expect(felt.value).toBe("Bergen")
      expect(endringer).toEqual(["Bergen"])
    })
  }
})

/*
 * Markup the way a template writes it when the form should submit the code:
 * the options have `data-value`, and a hidden `.lt-suggestion__value` gets
 * the code.
 */
const MED_KODE = `
  <lt-suggestion>
    <label for="kommune">Kommune</label>
    <div>
      <input class="lt-input" id="kommune" name="kommune-tekst">
      <input type="hidden" class="lt-suggestion__value" name="kommune">
      <ul class="lt-suggestion__list">
        <li data-value="4601">Bergen</li>
        <li data-value="1804">Bodø</li>
        <li data-value="0301">Oslo</li>
      </ul>
      <span class="lt-sr-only" role="status"></span>
    </div>
  </lt-suggestion>`

function tast(input: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  const hendelse = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  input.dispatchEvent(hendelse)
  return hendelse
}

describe("lt-suggestion chooses correctly", () => {
  beforeAll(() => {
    defineLtSuggestion()
  })

  function deler() {
    return {
      input: document.getElementById("kommune") as HTMLInputElement,
      kode: document.querySelector(".lt-suggestion__value") as HTMLInputElement,
      liste: document.querySelector("ul") as HTMLElement,
      valg: [...document.querySelectorAll<HTMLElement>("li")],
    }
  }

  it("shows the text in the field and puts the code in the value field and the event", async () => {
    mount(MED_KODE)
    const vert = await tegn()
    const { input, kode, valg } = deler()
    const detaljer: unknown[] = []
    vert.addEventListener("suggestion-select", (e) =>
      detaljer.push((e as CustomEvent).detail),
    )

    input.focus()
    valg[0].click()
    await waitForPaint()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4601")
    expect(detaljer).toEqual([{ value: "4601", label: "Bergen" }])
  })

  it("empties the value field when the user changes the text after a choice", async () => {
    // Otherwise the form would have submitted the code for Bergen with "Bodø" in the field.
    mount(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()

    input.focus()
    valg[0].click()
    await waitForPaint()
    input.value = "Berge"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()

    expect(kode.value).toBe("")
  })

  it("sets the code back when an update empties the value field", async () => {
    // The value field's `value` is an attribute, and a morph writes the
    // server's empty value over the code the user chose.
    mount(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()

    input.focus()
    valg[2].click()
    await waitForPaint()
    kode.removeAttribute("value")
    await waitForPaint()

    expect(input.value).toBe("Oslo")
    expect(kode.value).toBe("0301")
  })

  it("leaves a different code from the server alone", async () => {
    // Only an emptied value is set back. A code the server sends, for instance
    // after looking up an ambiguous name, is the server's word.
    mount(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()

    input.focus()
    valg[0].click()
    await waitForPaint()
    kode.setAttribute("value", "4602")
    await waitForPaint()
    await waitForPaint()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4602")
  })

  it("dispatches input and change on the value field when the code is written and emptied", async () => {
    // Otherwise neither `data-bind` in Datastar nor the state in React sees the code.
    mount(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()
    const hendelser: string[] = []
    for (const type of ["input", "change"])
      kode.addEventListener(type, () => hendelser.push(`${type}:${kode.value}`))

    input.focus()
    valg[0].click()
    input.value = "Berge"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(hendelser).toEqual([
      "input:4601",
      "change:4601",
      "input:",
      "change:",
    ])
  })

  it("closes an open list when the field becomes readonly", async () => {
    // The repair kept it open, and Escape does nothing in a locked field.
    mount(MED_KODE)
    await tegn()
    const { input, liste } = deler()
    input.focus()
    tast(input, "ArrowDown")
    await waitForPaint()
    expect(liste.hidden).toBe(false)

    input.setAttribute("readonly", "")
    await waitForPaint()
    await waitForPaint()

    expect(liste.hidden).toBe(true)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("chooses on click alone, and not on mousedown alone", async () => {
    /*
     * Assistive technology that activates an element sends `click`. The choice
     * used to happen on `mousedown`, and a `click` alone chose nothing.
     * `mousedown` still keeps focus in the field.
     */
    mount(MED_KODE)
    await tegn()
    const { input, valg } = deler()
    input.focus()

    const ned = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    valg[1].dispatchEvent(ned)
    expect(ned.defaultPrevented).toBe(true)
    expect(input.value).toBe("")

    valg[1].click()
    expect(input.value).toBe("Bodø")
  })

  it("skips an option with aria-disabled, with keyboard and mouse", async () => {
    mount(
      MED_KODE.replace(
        '<li data-value="4601">Bergen</li>',
        '<li data-value="4601" aria-disabled="true">Bergen</li>',
      ),
    )
    await tegn()
    const { input, valg } = deler()
    input.focus()

    valg[0].click()
    expect(input.value).toBe("")

    tast(input, "ArrowDown")
    tast(input, "Enter")
    expect(input.value).toBe("Bodø")
  })

  it("does not open the list or change the value in a readonly field", async () => {
    mount(
      MED_KODE.replace('name="kommune-tekst"', 'name="kommune-tekst" readonly'),
    )
    await tegn()
    const { input, liste, valg } = deler()

    input.focus()
    tast(input, "ArrowDown")
    tast(input, "Enter")
    valg[0].click()
    await waitForPaint()

    expect(liste.hidden).toBe(true)
    expect(input.value).toBe("")
  })

  it("leaves the keys alone during IME composition", async () => {
    // Enter confirms the characters in the composition, and must not choose anything.
    mount(MED_KODE)
    await tegn()
    const { input } = deler()

    input.focus()
    tast(input, "ArrowDown")
    const enter = tast(input, "Enter", { isComposing: true })

    expect(enter.defaultPrevented).toBe(false)
    expect(input.value).toBe("")
  })

  it("goes to the first and last option with PgUp and PgDn, and leaves Home and End alone", async () => {
    mount(MED_KODE)
    await tegn()
    const { input, valg } = deler()

    input.focus()
    tast(input, "ArrowDown")
    tast(input, "PageDown")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[2].id)
    tast(input, "PageUp")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[0].id)

    // Home and End move the caret in the text. The web component leaves them alone.
    expect(tast(input, "Home").defaultPrevented).toBe(false)
    expect(tast(input, "End").defaultPrevented).toBe(false)
  })

  it("finds the highlighted option again by its text when the list is replaced", async () => {
    // The list and the options get ids from the web component, and an update
    // that sends the list again replaces them. The highlight follows the text.
    mount(MED_KODE)
    await tegn()
    const { input, liste } = deler()
    input.focus()
    tast(input, "ArrowDown")
    tast(input, "ArrowDown")
    await waitForPaint()
    expect(deler().valg[1].getAttribute("aria-selected")).toBe("true")

    const ny = document.createElement("ul")
    ny.className = "lt-suggestion__list"
    ny.innerHTML = `<li data-value="4601">Bergen</li><li data-value="1804">Bodø</li><li data-value="0301">Oslo</li>`
    liste.replaceWith(ny)
    await waitForPaint()
    await waitForPaint()

    const bodoe = [...ny.querySelectorAll("li")].find(
      (li) => li.textContent === "Bodø",
    ) as HTMLElement
    expect(bodoe.getAttribute("aria-selected")).toBe("true")
    expect(bodoe.id).not.toBe("")
    expect(input.getAttribute("aria-activedescendant")).toBe(bodoe.id)
  })

  it("writes the number of matches again when an update empties the status element", async () => {
    // The text is not in the server's version, so without this the template
    // would have to write Datastar's `data-ignore-morph`, which means nothing to
    // htmx.
    mount(MED_KODE)
    await tegn()
    const { input } = deler()
    const status = document.querySelector("[role='status']") as HTMLElement
    input.focus()
    input.value = "B"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()
    const lest = status.textContent
    expect(lest).not.toBe("")

    status.textContent = ""
    await waitForPaint()
    await waitForPaint()

    expect(status.textContent).toBe(lest)
  })

  it("places the list right below the field also when the help text comes after", async () => {
    // The host is the positioning box. Without its own `inset-block-start`
    // the list gets its static position, right after the field in the flow, and
    // not below the help text.
    mount(
      MED_KODE.replace(
        "</lt-suggestion>",
        '<p class="lt-help-text">Vi fyller ut resten av adressen for deg.</p></lt-suggestion>',
      ),
    )
    await tegn()
    const { input, liste } = deler()
    const hjelp = document.querySelector(".lt-help-text") as HTMLElement
    input.focus()
    tast(input, "ArrowDown")
    await waitForPaint()

    const felt = input.getBoundingClientRect()
    const boks = liste.getBoundingClientRect()
    expect(liste.hidden).toBe(false)
    expect(boks.top).toBeGreaterThanOrEqual(felt.bottom)
    expect(boks.top - felt.bottom).toBeLessThan(12)
    expect(hjelp.getBoundingClientRect().top).toBeLessThan(boks.bottom)
  })

  it("tells two options with the same text apart by code when the list is replaced", async () => {
    mount(
      MED_KODE.replace(
        '<li data-value="0301">Oslo</li>',
        '<li data-value="3018">Våler</li><li data-value="3419">Våler</li>',
      ),
    )
    await tegn()
    const { input, liste } = deler()
    input.focus()
    for (let i = 0; i < 4; i += 1) tast(input, "ArrowDown")
    await waitForPaint()
    expect(deler().valg[3].getAttribute("aria-selected")).toBe("true")

    const ny = liste.cloneNode(true) as HTMLElement
    for (const li of ny.querySelectorAll("li")) {
      li.removeAttribute("id")
      li.removeAttribute("aria-selected")
    }
    liste.replaceWith(ny)
    await waitForPaint()
    await waitForPaint()

    const valgt = ny.querySelector('[aria-selected="true"]') as HTMLElement
    expect(valgt.getAttribute("data-value")).toBe("3419")
  })

  it("sets the code back to the server's when the form is reset", async () => {
    // A hidden field has no default value to go back to, since the code is
    // written as an attribute. Without this the form submitted the code for
    // Bodø with empty text after a reset.
    mount(
      `<form>${MED_KODE.replace('name="kommune-tekst"', 'name="kommune-tekst" value="Bergen"').replace('class="lt-suggestion__value" name="kommune"', 'class="lt-suggestion__value" name="kommune" value="4601"')}</form>`,
    )
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[1].click()
    await waitForPaint()
    expect(input.value).toBe("Bodø")
    expect(kode.value).toBe("1804")

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await waitForPaint()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4601")

    // And with no code from the server: empty.
    mount(`<form>${MED_KODE}</form>`)
    await tegn()
    const andre = deler()
    andre.input.focus()
    andre.valg[0].click()
    await waitForPaint()
    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await waitForPaint()
    expect(andre.input.value).toBe("")
    expect(andre.kode.value).toBe("")
  })

  it("writes for from the field's id, and reports it, when the label pointed elsewhere", async () => {
    // Same rule as in <lt-field>: `for` and `id` are the same information.
    // But without JavaScript the field had no label, so it must be reported.
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount(MED_KODE.replace('for="kommune"', 'for="feil"'))
    await tegn()
    await new Promise((r) => setTimeout(r, 300))
    expect((document.querySelector("label") as HTMLLabelElement).htmlFor).toBe(
      "kommune",
    )
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0][0])).toContain(
      "pointed to a different id",
    )
    advarsel.mockRestore()
  })

  it("does not let the events on the value field bubble to the host", async () => {
    // The recipe fetches suggestions with `data-on:input` on <lt-suggestion>.
    // Had the code fired it, every choice would have searched for "4601".
    mount(MED_KODE)
    const vert = await tegn()
    const { input, valg } = deler()
    const paaVerten: string[] = []
    vert.addEventListener("input", (e) =>
      paaVerten.push((e.target as HTMLInputElement).name),
    )
    vert.addEventListener("change", (e) =>
      paaVerten.push((e.target as HTMLInputElement).name),
    )

    input.focus()
    valg[0].click()
    await waitForPaint()

    expect(paaVerten).toEqual(["kommune-tekst", "kommune-tekst"])
  })

  it("keeps the code on reset when the server has sent the choice back", async () => {
    // With htmx the server sends the text and the code back. Then the chosen
    // one is also the form's default value, and a reset must land there.
    mount(`<form>${MED_KODE}</form>`)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[0].click()
    await waitForPaint()
    // The server's answer: both values as attributes, the way a morph writes them.
    input.setAttribute("value", "Bergen")
    kode.setAttribute("value", "4601")
    await waitForPaint()
    await waitForPaint()

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await waitForPaint()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4601")
  })

  it("finds the code from the option when the text after reset is a different choice", async () => {
    // The server sent Bodø back after the user chose it, and the user kept
    // typing. The reset gives "Bodø", and the code follows the option.
    mount(`<form>${MED_KODE}</form>`)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[1].click()
    await waitForPaint()
    input.setAttribute("value", "Bodø")
    kode.setAttribute("value", "1804")
    await waitForPaint()
    input.value = "Bod"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()
    expect(kode.value).toBe("")

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await waitForPaint()

    expect(input.value).toBe("Bodø")
    expect(kode.value).toBe("1804")
  })

  it("does not write the count back when something else filters", async () => {
    // A patch is then the answer to a keystroke, and `announceFiltered`
    // announces the new count right after. Two numbers in a row are noise.
    mount(MED_KODE.replace("<lt-suggestion>", "<lt-suggestion prefiltered>"))
    await tegn()
    const { input, liste } = deler()
    const status = document.querySelector("[role='status']") as HTMLElement
    input.focus()
    liste.removeChild(liste.children[2])
    await waitForPaint()
    await waitForPaint()
    expect(status.textContent).not.toBe("")

    status.textContent = ""
    await waitForPaint()
    await waitForPaint()

    expect(status.textContent).toBe("")
  })

  it("says nothing when the label wraps the whole element", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount(
      `<label>Kommune <lt-suggestion><input class="lt-input" name="kommune"><ul class="lt-suggestion__list"><li>Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion></label>`,
    )
    await tegn()
    await new Promise((r) => setTimeout(r, 300))
    expect(
      (document.querySelector("input") as HTMLInputElement).labels?.length,
    ).toBe(1)
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })

  it("follows the form when form on the field points to another", async () => {
    // The `reset` listener belongs to the form the field belongs to now.
    // `form` on the field can point to another form without anything moving,
    // and a patch can change it.
    mount(`<form id="a">${MED_KODE}</form><form id="b"></form>`)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[0].click()
    await waitForPaint()
    expect(kode.value).toBe("4601")

    input.setAttribute("form", "b")
    await waitForPaint()
    await waitForPaint()
    input.value = "Berg"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()
    expect(kode.value).toBe("")
    input.value = "Bergen"
    kode.setAttribute("value", "4601")
    await waitForPaint()
    ;(document.getElementById("b") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await waitForPaint()

    // The text goes back to empty, and the code follows.
    expect(input.value).toBe("")
    expect(kode.value).toBe("")
  })

  it("does not write the count back when the list is closed", async () => {
    // Every patch of the region would otherwise announce the old count again.
    mount(MED_KODE)
    await tegn()
    const { input } = deler()
    const status = document.querySelector("[role='status']") as HTMLElement
    input.focus()
    input.value = "B"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await waitForPaint()
    expect(status.textContent).not.toBe("")
    tast(input, "Escape")
    await waitForPaint()

    status.textContent = ""
    await waitForPaint()
    await waitForPaint()

    expect(status.textContent).toBe("")
  })

  it("gives the code back as soon as the user types the chosen text again", async () => {
    // After a morph emptied both text and code, as idiomorph does without
    // ignoreActiveValue, the code must not wait for some random next patch.
    mount(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[0].click()
    await waitForPaint()
    input.value = ""
    kode.setAttribute("value", "")
    await waitForPaint()
    await waitForPaint()
    expect(kode.value).toBe("")

    input.value = "Bergen"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(kode.value).toBe("4601")
  })

  it("says nothing about a field without an id that is named by aria-labelledby", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    mount(
      `<lt-suggestion><label id="l">Kommune</label><input class="lt-input" name="kommune" aria-labelledby="l"><ul class="lt-suggestion__list"><li>Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    )
    await tegn()
    await new Promise((r) => setTimeout(r, 300))
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })

  it("goes back to the server's Våler when the user had chosen the other one", async () => {
    // Two options with the same text: on reset the text is the server's, and
    // then the server's code applies, not the one the user chose.
    mount(
      `<form>${MED_KODE.replace(
        'name="kommune-tekst"',
        'name="kommune-tekst" value="Våler"',
      )
        .replace(
          'class="lt-suggestion__value" name="kommune"',
          'class="lt-suggestion__value" name="kommune" value="3419"',
        )
        .replace(
          '<li data-value="0301">Oslo</li>',
          '<li data-value="3018">Våler</li><li data-value="3419">Våler</li>',
        )}</form>`,
    )
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[2].click()
    await waitForPaint()
    expect(kode.value).toBe("3018")

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await waitForPaint()

    expect(input.value).toBe("Våler")
    expect(kode.value).toBe("3419")
  })

  it("gives a label outside the element the class, as lt-field does", async () => {
    mount(
      `<label for="kommune">Kommune</label><lt-suggestion><input class="lt-input" id="kommune"><ul class="lt-suggestion__list"><li>Bergen</li></ul><span class="lt-sr-only" role="status"></span></lt-suggestion>`,
    )
    await tegn()
    expect(
      document.querySelector("label")?.classList.contains("lt-label"),
    ).toBe(true)
  })
})
