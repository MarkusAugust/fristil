/**
 * That fields and suggestion fields, as the recipes show them, work without
 * JavaScript and survive the server sending the region again, in each of the
 * three ways a page is updated.
 *
 * The markup is read straight from the "Plain HTML" tab on the component
 * pages, so the test and the documentation cannot say different things.
 * Datastar and idiomorph, which htmx morphs with, recognise an element by
 * its id. An element without an id is kept, and an element with an id the
 * server did not send is replaced. The components therefore never write an
 * id on the field: `for` and `id` come from the template, or the label wraps
 * the field. What holds for each way:
 *
 * - Datastar keeps the field, focus and the text.
 * - idiomorph keeps the field and focus, but sets the text and `checked`
 *   from the server's HTML. The exception is the focused field when
 *   `ignoreActiveValue` is on, as htmx users do with
 *   `hx-swap="morph:{ignoreActiveValue:true}"`; it is off by default. The
 *   server therefore has to send the values back.
 * - `innerHTML` replaces everything. The new field must be connected again.
 * - Without JavaScript there is no update, and the markup has to stand on
 *   its own: every field has a name, the required marker and the error text
 *   from the server are visible, and the list in the suggestion field is not
 *   open.
 *
 * The mutations that must fail it: an id written on the field by the
 * component (the cases with the label wrapping the field), the `for` write
 * taken out of the component (the case with a label without `for`), and the
 * id taken out of the recipe (the warning).
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import feltSide from "../../documentation/src/content/docs/components/field.mdx?raw"
import sprettSide from "../../documentation/src/content/docs/components/popover.mdx?raw"
import forslagSide from "../../documentation/src/content/docs/components/suggestion.mdx?raw"
import checkboxCss from "./components/css/checkbox/checkbox.css?inline"
import errorTextCss from "./components/css/error-text/error-text.css?inline"
import helpTextCss from "./components/css/help-text/help-text.css?inline"
import inputCss from "./components/css/input/input.css?inline"
import labelCss from "./components/css/label/label.css?inline"
import srOnlyCss from "./components/css/sr-only/sr-only.css?inline"
import { defineLtField } from "./components/frame/field/lt-field"
import { defineLtPopover } from "./components/frame/popover/lt-popover"
import { defineLtSuggestion } from "./components/frame/suggestion/lt-suggestion"
import suggestionCss from "./components/frame/suggestion/suggestion.css?inline"
import { waitForPaint } from "./testing/a11y"
import { Idiomorph } from "./testing/idiomorph/idiomorph-v0.8.0.js"
import tokensCss from "./tokens/tokens.css?inline"

import "./testing/datastar/datastar-v1.0.4.js"

type Maate = "Datastar" | "idiomorph" | "innerHTML"
const MAATER: Maate[] = ["Datastar", "idiomorph", "innerHTML"]

/**
 * The recipe in the "Plain HTML" tab on a component page: the first html
 * block containing the element, without the scripts.
 */
function oppskrift(side: string, tag: string): string {
  const fane = side.slice(side.indexOf('<TabItem label="Plain HTML">'))
  const blokker = [...fane.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1])
  const blokk = blokker.find((b) => b.includes(`<${tag}`))
  if (!blokk) throw new Error(`found no recipe with <${tag}> on the page`)
  return blokk.replace(/<script[\s\S]*?<\/script>/g, "")
}

const FELT = oppskrift(feltSide, "lt-field")
const FORSLAG = oppskrift(forslagSide, "lt-suggestion")
/** The "Text and code" recipe, with the hidden field for the code. */
const KODE = oppskrift(forslagSide, 'input class="lt-suggestion__value"')

/** The recipe with the label wrapping the field, and no id. */
const FELT_RUNDT = `
  <lt-field>
    <label class="lt-label">Fullt navn <input class="lt-input" name="navn" type="text"></label>
    <p class="lt-help-text">Slik det står i passet.</p>
  </lt-field>`

const FORSLAG_RUNDT = `
  <lt-suggestion>
    <label class="lt-label">Kommune <input class="lt-input" name="kommune" type="text"></label>
    <ul class="lt-suggestion__list"><li>Bergen</li><li>Bodø</li><li>Oslo</li></ul>
    <span class="lt-sr-only" role="status"></span>
  </lt-suggestion>`

const AVKRYSSING = (checked: boolean) => `
  <div>
    <input class="lt-checkbox" type="checkbox" id="vilkar" name="vilkar"${checked ? " checked" : ""}>
    <label class="lt-label" for="vilkar">Jeg godtar vilkårene</label>
  </div>`

/**
 * The region the server sends, with an id so Datastar finds it. An update
 * carries a marker, so each case can see that the patch actually arrived and
 * not just that nothing happened.
 */
const omraade = (innhold: string, oppdatert = false) =>
  `<div id="omraade">${oppdatert ? "<span hidden data-oppdatert></span>" : ""}${innhold}</div>`

async function oppdater(maate: Maate, innhold: string): Promise<void> {
  const rot = document.getElementById("omraade") as HTMLElement
  // The marker from the previous update is removed, so this one has to bring it.
  rot.querySelector("[data-oppdatert]")?.remove()
  if (maate === "Datastar") {
    // Like a `datastar-patch-elements` without a selector: `outer` on the id.
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-elements",
          el: document.body,
          argsRaw: { elements: omraade(innhold, true) },
        },
      }),
    )
  } else if (maate === "idiomorph") {
    Idiomorph.morph(rot, omraade(innhold, true), {
      morphStyle: "outerHTML",
      ignoreActiveValue: true,
    })
  } else {
    rot.innerHTML = `<span hidden data-oppdatert></span>${innhold}`
  }
  await roSeg()
  expect(
    document.querySelector("#omraade [data-oppdatert]"),
    `the update with ${maate} did not arrive`,
  ).not.toBeNull()
}

/** Waits until the observers have run. */
async function roSeg() {
  await waitForPaint()
  await waitForPaint()
}

/** Waits until `warnAboutMarkup` has seen the page settle. */
/*
 * 300 ms is enough when the frames come. In a hidden tab `whenSettled` falls
 * back to one second, and a silence test would then pass without having
 * seen anything; but "reports once when the recipe has no id on the field"
 * waits just as long and would fail, so the run as a whole cannot pass
 * empty.
 */
const stille = () => new Promise((r) => setTimeout(r, 300))

async function mount(innhold: string) {
  document.body.innerHTML = omraade(innhold)
  await roSeg()
}

const felt = () =>
  document.querySelector("input:not([type='checkbox'])") as HTMLInputElement

describe("fields and suggestion fields through a server update", () => {
  beforeAll(() => {
    defineLtField()
    defineLtSuggestion()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("reads the recipes from the component pages", () => {
    expect(FELT).toContain('for="name"')
    expect(FELT).toContain('id="name"')
    expect(FORSLAG).toContain('for="airport"')
    expect(FORSLAG).toContain('id="airport"')
    expect(KODE).toContain('data-value="BGO"')
  })

  for (const maate of MAATER) {
    it(`a chosen suggestion with a code: ${maate}`, async () => {
      // The plan's 6.1: choose a suggestion, then update. The server sends
      // the value field empty; with `innerHTML` it must send both values back.
      const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
      await mount(KODE)
      const input = felt()
      input.focus()
      ;(document.querySelector("li") as HTMLElement).click()
      await roSeg()
      const kode = () =>
        document.querySelector(".lt-suggestion__value") as HTMLInputElement
      expect(input.value).toBe("Bergen")
      expect(kode().value).toBe("BGO")

      await oppdater(
        maate,
        maate === "innerHTML"
          ? KODE.replace('type="text"', 'type="text" value="Bergen"').replace(
              'type="hidden"',
              'type="hidden" value="BGO"',
            )
          : KODE,
      )

      expect(felt().value).toBe("Bergen")
      expect(kode().value).toBe("BGO")
      await stille()
      expect(advarsel).not.toHaveBeenCalled()
    })
  }

  const TILFELLER = [
    {
      navn: "field from the recipe",
      markup: FELT,
      ledetekst: "Full name",
      id: "name",
    },
    {
      navn: "field with the label wrapping it, no id",
      markup: FELT_RUNDT,
      ledetekst: "Fullt navn",
      id: "",
    },
    {
      navn: "suggestion field from the recipe",
      markup: FORSLAG,
      ledetekst: "Airport",
      id: "airport",
    },
    {
      navn: "suggestion field with the label wrapping it, no id",
      markup: FORSLAG_RUNDT,
      ledetekst: "Kommune",
      id: "",
    },
  ]

  for (const maate of MAATER) {
    for (const t of TILFELLER) {
      it(`${t.navn}: ${maate}`, async () => {
        const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
        await mount(t.markup)
        const foer = felt()
        foer.focus()
        foer.value = "Kari"
        foer.dispatchEvent(new Event("input", { bubbles: true }))
        await roSeg()

        await oppdater(maate, t.markup)

        const etter = felt()
        if (maate === "innerHTML") {
          expect(etter).not.toBe(foer)
        } else {
          expect(etter).toBe(foer)
          expect(etter.value).toBe("Kari")
          expect(document.activeElement).toBe(etter)
        }
        expect(etter.id).toBe(t.id)
        expect(etter.labels?.length).toBe(1)
        expect(etter.labels?.[0]?.textContent).toContain(t.ledetekst)
        const hjelp = document.querySelector(".lt-help-text")
        if (hjelp) expect(etter.getAttribute("aria-describedby")).toBe(hjelp.id)
        if (etter.closest("lt-suggestion")) {
          expect(etter.getAttribute("role")).toBe("combobox")
          expect(etter.getAttribute("aria-controls")).toBe(
            document.querySelector("ul")?.id,
          )
        }
        await stille()
        expect(advarsel).not.toHaveBeenCalled()
      })
    }
  }

  it("idiomorph without ignoreActiveValue also sets the focused field from the server", async () => {
    // The default in idiomorph, and so in htmx without a setting in `hx-swap`.
    await mount(FELT)
    const input = felt()
    input.focus()
    input.value = "Kari"
    Idiomorph.morph(
      document.getElementById("omraade") as HTMLElement,
      omraade(FELT, true),
      { morphStyle: "outerHTML" },
    )
    await roSeg()
    expect(felt()).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe("")
  })

  for (const maate of ["Datastar", "idiomorph"] as const) {
    it(`a field without focus: ${maate} and what the server sends back`, async () => {
      /*
       * Datastar leaves the text. idiomorph sets it from the server's HTML,
       * so with htmx the server must send the value back. That is the one
       * sentence the documentation gives htmx users, and it is checked here.
       */
      await mount(FELT)
      felt().value = "Kari"
      felt().blur()

      await oppdater(maate, FELT)
      expect(felt().value).toBe(maate === "Datastar" ? "Kari" : "")

      // The server sends a different text from what is there. Both morphers
      // set the property when the attribute differs: Datastar in
      // patchElements.ts (`oldElt.value = newValue`), idiomorph always.
      felt().value = "Ola"
      await oppdater(maate, FELT.replace('id="name"', 'id="name" value="Kari"'))
      expect(felt().value).toBe("Kari")
    })

    it(`checkbox: ${maate} and what the server sends back`, async () => {
      await mount(AVKRYSSING(false))
      const boks = document.getElementById("vilkar") as HTMLInputElement
      boks.click()
      expect(boks.checked).toBe(true)

      await oppdater(maate, AVKRYSSING(false))
      expect(document.getElementById("vilkar")).toBe(boks)
      expect(boks.checked).toBe(maate === "Datastar")

      // The server sends `checked` while the box is unchecked after the user
      // touched it. Both morphers set the check from the server's HTML.
      boks.checked = false
      await oppdater(maate, AVKRYSSING(true))
      expect(boks.checked).toBe(true)
    })

    it(`list with ids from a key: the text stays in the right row (${maate})`, async () => {
      /*
       * An id that follows the position moves what the user typed to the
       * wrong row when the server inserts a new one at the top. An id from a
       * key in the data keeps the row where it belongs. The test is about the
       * rule the documentation gives templates, not the components: all the
       * ids come from the server.
       */
      const liste = (navn: string[]) =>
        navn
          .map((n) => {
            const k = n.toLowerCase()
            // An id on the row too, as `hx-target` and `hx-swap-oob` need it.
            return `<lt-field id="rad-${k}"><label class="lt-label" for="merknad-${k}">${n}</label><input class="lt-input" id="merknad-${k}" name="merknad-${k}"></lt-field>`
          })
          .join("")
      await mount(liste(["Bergen", "Oslo"]))
      const bergen = document.getElementById(
        "merknad-bergen",
      ) as HTMLInputElement
      const rad = document.getElementById("rad-bergen")
      bergen.focus()
      bergen.value = "Vestland"

      await oppdater(maate, liste(["Arendal", "Bergen", "Oslo"]))

      expect(
        (document.getElementById("merknad-arendal") as HTMLInputElement).value,
      ).toBe("")
      expect(document.getElementById("merknad-bergen")).toBe(bergen)
      expect(document.getElementById("rad-bergen")).toBe(rad)
      expect(bergen.value).toBe("Vestland")
    })
  }

  it("writes for on a label without one, from the field's id", async () => {
    // The mutation: take the `for` write out of the component.
    await mount(FELT.replace(' for="name"', ""))
    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.htmlFor).toBe("name")
  })

  it("reports once when the recipe has no id on the field", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    await mount(FELT.replace(' id="name"', ""))
    await stille()
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0][0])).toContain("not connected")
  })
})

describe("the recipes without JavaScript", () => {
  /*
   * A sandboxed iframe without `allow-scripts` runs no scripts, so the web
   * components do not exist, and the markup has to manage by itself. The
   * stylesheets are inlined as text; `@import` is not resolved in a
   * `srcdoc`, so each stylesheet the recipe links to is included
   * separately.
   */
  let dokument: Document

  beforeAll(async () => {
    const iframe = document.createElement("iframe")
    iframe.sandbox.add("allow-same-origin")
    const stil = [
      tokensCss,
      labelCss,
      inputCss,
      helpTextCss,
      errorTextCss,
      checkboxCss,
      srOnlyCss,
      suggestionCss.replace(/@import[^;]*;/g, ""),
    ].join("\n")
    iframe.srcdoc = `<!doctype html><meta charset="utf-8"><style>${stil}</style>
      <script>document.documentElement.dataset.skript = "kjorte"</script>
      ${FELT}
      <div id="ugyldig">${FELT.replace(" hidden>", ">").replaceAll('"name"', '"name-invalid"')}</div>
      ${FORSLAG}
      ${AVKRYSSING(false)}`
    await new Promise((r) => {
      iframe.onload = r
      document.body.append(iframe)
    })
    dokument = iframe.contentDocument as Document
  })

  it("runs no scripts", () => {
    // The script in the sandbox would have set a marker. It is not there.
    expect(dokument.documentElement.dataset.skript).toBeUndefined()
    expect(dokument.defaultView?.customElements.get("lt-field")).toBeUndefined()
  })

  it("every field has a name from the label", () => {
    for (const input of dokument.querySelectorAll("input")) {
      expect(input.labels?.length, input.outerHTML).toBe(1)
      expect(input.labels?.[0]?.htmlFor).toBe(input.id)
    }
  })

  it("the required marker is visible", () => {
    const label = dokument.querySelector("label[for='name']") as HTMLElement
    const etter = dokument.defaultView?.getComputedStyle(label, "::after")
    expect(etter?.content).toContain("*")
  })

  it("the error text from the server is visible, and the hidden one is not", () => {
    const vindu = dokument.defaultView as Window
    const skjult = dokument.querySelector(
      ".lt-error-text[hidden]",
    ) as HTMLElement
    const synlig = dokument.querySelector(
      "#ugyldig .lt-error-text",
    ) as HTMLElement
    expect(vindu.getComputedStyle(skjult).display).toBe("none")
    expect(vindu.getComputedStyle(synlig).display).toBe("block")
  })

  it("the list in the suggestion field is not open", () => {
    const liste = dokument.querySelector(".lt-suggestion__list") as HTMLElement
    expect(dokument.defaultView?.getComputedStyle(liste).display).toBe("none")
  })
})

/*
 * The popover: the component never writes an id on the panel. With an id
 * from the template, as in the recipe, and without one, Datastar and
 * idiomorph recognise the panel, so it stays open with focus where it was.
 * When the component wrote an id itself, the panel was replaced.
 * `innerHTML` replaces everything, the host included.
 */
const SPRETT = oppskrift(sprettSide, "lt-popover")
const SPRETT_BAR = SPRETT.replace(' id="actions"', "")

describe("the popover through a server update", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("reads the recipe from the component page, with an id on the panel", () => {
    expect(SPRETT).toContain('class="lt-popover" id="actions"')
    expect(SPRETT_BAR).not.toContain('id="actions"')
  })

  for (const [navn, markup] of [
    ["the recipe", SPRETT],
    ["bare markup without an id", SPRETT_BAR],
  ] as const) {
    for (const maate of MAATER) {
      it(`${navn}: ${maate}`, async () => {
        await mount(markup)
        const knapp = document.querySelector(
          "lt-popover > button",
        ) as HTMLElement
        const panel = document.querySelector(".lt-popover") as HTMLElement
        knapp.click()
        await roSeg()
        const valg = panel.querySelector("button") as HTMLElement
        valg.focus()
        expect(panel.matches(":popover-open")).toBe(true)

        await oppdater(maate, markup)

        const etter = document.querySelector(".lt-popover") as HTMLElement
        expect(etter.hasAttribute("id")).toBe(markup === SPRETT)
        if (maate === "innerHTML") {
          expect(etter).not.toBe(panel)
        } else {
          expect(etter).toBe(panel)
          expect(etter.matches(":popover-open")).toBe(true)
          expect(document.activeElement).toBe(valg)
        }
        ;(
          document.querySelector("lt-popover") as HTMLElement & { hide(): void }
        ).hide()
      })
    }
  }
})
