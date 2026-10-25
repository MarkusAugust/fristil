/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { computeFieldAttributes } from "./field-core"
import { defineLtField, type LtField } from "./lt-field"
import "../../../tokens/tokens.css"
import "./field.css"

/** The attribute names on an element, sorted. */
function navnene(element: Element): string[] {
  return [...element.attributes].map((a) => a.name).sort()
}

describe("lt-field", () => {
  beforeAll(() => {
    defineLtField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("wires label[for] to the control id", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label id="label">E-post</label>
        <input id="email" class="lt-input" type="email" />
      </lt-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.htmlFor).toBe("email")
  })

  it("adds ids and aria-describedby for help and error text", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="email">E-post</label>
        <input id="email" class="lt-input" type="email" />
        <p class="lt-help-text">Hjelp</p>
        <p class="lt-error-text">Feil</p>
      </lt-field>
    `

    await Promise.resolve()

    const field = document.querySelector("lt-field") as HTMLElement
    const input = field.querySelector("input") as HTMLInputElement
    const help = field.querySelector(".lt-help-text") as HTMLElement
    const error = field.querySelector(".lt-error-text") as HTMLElement

    expect(help.id.length).toBeGreaterThan(0)
    expect(error.id.length).toBeGreaterThan(0)
    expect(input.getAttribute("aria-invalid")).toBe("true")

    const describedBy = input.getAttribute("aria-describedby") || ""
    expect(describedBy).toContain(help.id)
    expect(describedBy).toContain(error.id)
  })

  it("treats the field as invalid when the error text is visible, and valid when it is hidden", async () => {
    /*
     * The visibility of the error text is the truth. A template renders it
     * when the field is invalid, and client code toggles `hidden`. The
     * component never touches it: it used to hide an error text the server
     * had rendered visible, because the host had no `invalid`.
     */
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-error-text" hidden>Skriv en gyldig e-post.</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".lt-error-text") as HTMLElement
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    expect(input.getAttribute("aria-describedby")).toBeNull()

    error.hidden = false
    await waitForPaint()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(input.getAttribute("aria-describedby")).toBe(error.id)

    error.hidden = true
    await waitForPaint()
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    expect(input.hasAttribute("data-state")).toBe(false)
    expect(input.getAttribute("aria-describedby")).toBeNull()
    expect(error.hidden).toBe(true)
  })

  it("does not touch hidden on the error text", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-error-text">Skriv en gyldig e-post.</p>
      </lt-field>
    `
    await waitForPaint()

    const error = document.querySelector(".lt-error-text") as HTMLElement
    expect(error.hidden).toBe(false)
    expect(error.hasAttribute("aria-hidden")).toBe(false)
  })

  it("leaves the server's aria-invalid alone", async () => {
    // If the server wrote the field with `lt.field()`, `aria-invalid` is on
    // the control. The attribute is then the server's, and the component
    // must read it, not remove it.
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" aria-invalid="true" />
        <p class="lt-error-text">Skriv en gyldig e-post.</p>
      </lt-field>
    `

    await Promise.resolve()
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".lt-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)
  })

  it("leaves the server's aria-invalid alone, also when the error text is hidden and shown again", async () => {
    /*
     * Two sources that say different things, and the server wins. If
     * `aria-invalid` is on the control in the markup the server sent, it is
     * the server's word about the field, and the same markup must give the
     * same answer whatever states the error text has been through.
     */
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" aria-invalid="true" />
        <p class="lt-error-text">Skriv en gyldig e-post.</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".lt-error-text") as HTMLElement
    error.hidden = true
    await waitForPaint()
    error.hidden = false
    await waitForPaint()
    error.hidden = true
    await waitForPaint()

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
  })

  it("follows the server when a patch replaces the control", async () => {
    /*
     * The server can say the same thing in two ways, and switch between them
     * in a patch: a visible error text in one round, and a fully written
     * control in the next. If the component ties "this attribute is my own
     * echo" to itself rather than to the control, it treats the field as
     * valid the moment the control is replaced.
     */
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-error-text">Skriv en gyldig e-post.</p>
      </lt-field>
    `

    await Promise.resolve()
    expect(document.querySelector("input")?.getAttribute("aria-invalid")).toBe(
      "true",
    )

    // The patch: a new control that itself says invalid, and the error text hidden.
    const gammel = document.querySelector("input") as HTMLInputElement
    const ny = document.createElement("input")
    ny.id = "epost"
    ny.className = "lt-input"
    ny.type = "email"
    ny.setAttribute("aria-invalid", "true")
    gammel.replaceWith(ny)
    const error = document.querySelector(".lt-error-text") as HTMLElement
    error.hidden = true

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(ny.getAttribute("aria-invalid")).toBe("true")
    expect(ny.getAttribute("data-state")).toBe("invalid")
    expect(error.hidden).toBe(true)
  })

  it("never writes an id on the control, not even when a patch replaces it", async () => {
    // The markup in the test has no label on purpose, and the warning about
    // it is expected. It must not show up as noise in the run.
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    /*
     * Datastar and idiomorph recognise a node by its id, and a control with
     * an id the server did not send is replaced on the next update, along
     * with focus and what the user has typed. The component used to invent an
     * id when the control had none, and that was exactly what made the field
     * get replaced. If the id is missing, the template has to write it.
     */
    document.body.innerHTML = `
      <div>
        <label class="lt-label" for="epost">E-post</label>
        <lt-field>
          <input id="epost" class="lt-input" type="email" />
        </lt-field>
      </div>
    `
    await Promise.resolve()

    const gammel = document.querySelector("input") as HTMLInputElement
    const ny = document.createElement("input")
    ny.className = "lt-input"
    ny.type = "email"
    gammel.replaceWith(ny)

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(ny.hasAttribute("id")).toBe(false)
    advarsel.mockRestore()
  })

  it("writes neither id nor for when the label wraps the control", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label>E-post <input class="lt-input" type="email" /></label>
        <p class="lt-help-text">Vi sender kvittering hit.</p>
      </lt-field>
    `
    await waitForPaint()

    const label = document.querySelector("label") as HTMLLabelElement
    const input = document.querySelector("input") as HTMLInputElement
    const help = document.querySelector(".lt-help-text") as HTMLElement

    expect(input.hasAttribute("id")).toBe(false)
    expect(label.hasAttribute("for")).toBe(false)
    expect(input.labels?.[0]).toBe(label)
    expect(input.getAttribute("aria-describedby")).toBe(help.id)
  })

  it("leaves the data-required the server wrote, and marks optional fields", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label id="label" for="navn" data-required="text">Navn</label>
        <input id="navn" class="lt-input" required />
      </lt-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.getAttribute("data-required")).toBe("text")

    document.body.innerHTML = `
      <lt-field optional>
        <label id="label-2" for="telefon">Telefon</label>
        <input id="telefon" class="lt-input" />
      </lt-field>
    `

    await Promise.resolve()

    const label2 = document.getElementById("label-2") as HTMLLabelElement
    expect(label2.hasAttribute("data-optional")).toBe(true)
  })
})

describe("lt-field accessibility", () => {
  it("has no violations for a field with help text and error text", async () => {
    mount(`
      <lt-field>
        <label for="epost" data-required="symbol">E-postadresse</label>
        <input id="epost" class="lt-input" type="email" value="ola@" required />
        <p class="lt-help-text">Vi sender kvittering til denne adressen.</p>
        <p class="lt-error-text">Skriv en e-postadresse med krøllalfa.</p>
      </lt-field>

      <lt-field optional>
        <label for="melding">Melding til saksbehandler</label>
        <textarea id="melding" class="lt-textarea" rows="3"></textarea>
        <p class="lt-help-text">Du kan skrive opptil 500 tegn.</p>
      </lt-field>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })

  it("has no violations for a field without help text", async () => {
    mount(`
      <lt-field>
        <label>Fullt navn <input class="lt-input" type="text" /></label>
      </lt-field>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})

describe("lt-field label", () => {
  it("gives the label lt-label, so the required marker actually shows", async () => {
    mount(`
      <lt-field>
        <label for="epost" data-required="text">E-postadresse</label>
        <input id="epost" class="lt-input" type="email" />
      </lt-field>
    `)

    await waitForPaint()

    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.classList.contains("lt-label")).toBe(true)
    expect(label.getAttribute("data-required")).toBe("text")

    // The attribute alone does nothing without the class. The marker comes from ::after
    const markering = getComputedStyle(label, "::after").content
    expect(markering).toContain("required")
  })

  it("marks optional fields the same way", async () => {
    mount(`
      <lt-field optional>
        <label for="adresse">Adresse</label>
        <input id="adresse" class="lt-input" type="text" />
      </lt-field>
    `)

    await waitForPaint()

    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.classList.contains("lt-label")).toBe(true)
    expect(getComputedStyle(label, "::after").content).toContain("optional")
  })
})

describe("lt-field does not fight the server", () => {
  /**
   * The demo apps caught this, not the unit tests.
   *
   * If the server wrote the field with `lt.field()`, the component computed
   * its own answer from the attributes on the host, found no `invalid` and
   * no `required-marker`, and removed what the server had just written. In
   * React it became a hydration error, in Datastar an error text that
   * appeared on a valid field on the next patch.
   *
   * The component therefore reads the state from the markup, not from a
   * parallel attribute.
   */
  it("leaves the attributes the server wrote", async () => {
    const felt = computeFieldAttributes({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
      required: "symbol",
    })

    mount(`
      <lt-field>
        <label ${attr(felt.label)}>E-postadresse</label>
        <input class="lt-input" type="email" ${attr(felt.control)} />
        <p class="lt-help-text" ${attr(felt.help)}>Vi sender kvittering hit.</p>
        <p class="lt-error-text" ${attr(felt.error)}>Skriv en gyldig adresse.</p>
      </lt-field>
    `)

    await waitForPaint()

    const input = document.getElementById("epost") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement
    const feilmelding = document.querySelector(".lt-error-text") as HTMLElement

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("aria-describedby")).toBe(
      "epost-help epost-error",
    )
    expect(label.getAttribute("data-required")).toBe("symbol")
    expect(feilmelding.hidden).toBe(false)
  })

  it("does not set aria-hidden on a hidden error text", async () => {
    // `hidden` already takes it out of the accessibility tree, and an
    // attribute the server does not write gives a hydration error in React.
    mount(`
      <lt-field>
        <label for="epost">E-postadresse</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-error-text" hidden>Skriv en gyldig adresse.</p>
      </lt-field>
    `)

    await waitForPaint()

    const feilmelding = document.querySelector(".lt-error-text") as HTMLElement
    expect(feilmelding.hidden).toBe(true)
    expect(feilmelding.hasAttribute("aria-hidden")).toBe(false)
  })
})

/**
 * The documentation shows what the server sends and what is on the page
 * afterwards. That list was wrong: `aria-describedby` was missing the error
 * text's id, and nothing said so, because no test read it. Now the claim is
 * here.
 */
describe("lt-field connects markup that has only structure", () => {
  beforeAll(() => {
    defineLtField()
  })

  it("gives the full wiring from for, id and a visible error text", async () => {
    mount(`
      <lt-field>
        <label data-required="symbol">E-post</label>
        <input id="epost" class="lt-input" type="email">
        <p class="lt-help-text">Vi sender aldri spam.</p>
        <p class="lt-error-text">Skriv en gyldig adresse.</p>
      </lt-field>
    `)

    await waitForPaint()

    const label = document.querySelector("label") as HTMLLabelElement
    const input = document.querySelector("input") as HTMLInputElement
    const hjelp = document.querySelector(".lt-help-text") as HTMLElement
    const feilmelding = document.querySelector(".lt-error-text") as HTMLElement

    expect(label.getAttribute("class")).toBe("lt-label")
    expect(label.getAttribute("for")).toBe("epost")
    expect(label.getAttribute("data-required")).toBe("symbol")
    expect(input.id).toBe("epost")
    expect(hjelp.id).toMatch(/^lt-field-help-/)
    expect(feilmelding.id).toMatch(/^lt-field-error-/)
    expect(input.getAttribute("aria-describedby")).toBe(
      `${hjelp.id} ${feilmelding.id}`,
    )
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(feilmelding.hidden).toBe(false)
  })

  /*
   * The component looks for the help text and the error text by the
   * system's classes, and only there. It once also read `[data-role='help']`
   * and `[data-role='error']`, a hook no documentation mentioned.
   * `data-role` is unprefixed, and in practice used by others: an app that
   * used it for something else inside a field had its paragraph adopted as
   * the error text, without anything saying so.
   */
  it("does not adopt a paragraph that only has a role on it", async () => {
    mount(`
      <lt-field>
        <label for="postnummer">Postnummer</label>
        <input id="postnummer" class="lt-input" aria-invalid="true">
        <p class="egen-feil" data-role="error">Postnummeret må ha fire siffer.</p>
      </lt-field>
    `)

    await waitForPaint()

    const input = document.querySelector("input") as HTMLInputElement
    const avsnitt = document.querySelector(".egen-feil") as HTMLElement

    // One positive anchor. Without it the test would also pass if `sync()`
    // gave up before getting that far, and then it only claims that nothing
    // happened.
    expect(input.getAttribute("aria-invalid")).toBe("true")

    expect(navnene(avsnitt)).toEqual(["class", "data-role"])
    expect(input.hasAttribute("aria-describedby")).toBe(false)
  })
})

describe("lt-field is a block element", () => {
  beforeAll(() => {
    defineLtField()
  })

  it("declares itself a block", async () => {
    // Without this the element is `display: inline`, and spacing set on the
    // outside does nothing. The children are blocks, so the bug does not
    // show until someone puts the field in a grid or gives it a margin.
    mount(`
      <lt-field>
        <label class="lt-label">E-post</label>
        <input class="lt-input" type="email" />
      </lt-field>
    `)

    await waitForPaint()

    const felt = document.querySelector("lt-field") as HTMLElement
    expect(getComputedStyle(felt).display).toBe("block")
  })
})

/**
 * The component only controls what it wrote itself.
 *
 * Three attributes are read from the control and written back to it:
 * `aria-invalid`, `aria-describedby` and `disabled`. For each of them the
 * component must know what it wrote last, or it reads its own echo as the
 * server's word. That was fixed for `aria-invalid` alone, and the other two
 * had exactly the same bug: `aria-describedby` never shrank, and `disabled`
 * could not be turned off again.
 */
describe("lt-field only controls what it wrote itself", () => {
  beforeAll(() => {
    defineLtField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("takes the error text out of aria-describedby when it is hidden", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-help-text" id="h">Hjelp</p>
        <p class="lt-error-text" id="x">Feil</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("h x")

    const error = document.getElementById("x") as HTMLElement
    error.hidden = true
    await waitForPaint()

    expect(input.getAttribute("aria-describedby")).toBe("h")
  })

  it("takes the help text out of aria-describedby when a patch removes it", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-help-text" id="h">Hjelp</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("h")

    document.querySelector(".lt-help-text")?.remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(input.getAttribute("aria-describedby")).toBeNull()
  })

  it("takes the extra ids out again when described-by is removed from the host", async () => {
    document.body.innerHTML = `
      <p id="ekstra">Les vilkårene først.</p>
      <lt-field described-by="ekstra">
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("ekstra")

    const felt = document.querySelector("lt-field") as LtField
    felt.describedBy = undefined
    await Promise.resolve()

    expect(input.getAttribute("aria-describedby")).toBeNull()
  })

  it("keeps ids the server put in aria-describedby", async () => {
    // `lt.field({ describedBy: ["vilkar"] })` writes the id straight on the
    // control. It is the server's, and must stay, also after the component
    // has rewritten the attribute to remove the error text.
    document.body.innerHTML = `
      <p id="vilkar">Vilkår</p>
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email"
               aria-describedby="epost-help epost-error vilkar" />
        <p class="lt-help-text" id="epost-help">Hjelp</p>
        <p class="lt-error-text" id="epost-error">Feil</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe(
      "epost-help epost-error vilkar",
    )

    const error = document.getElementById("epost-error") as HTMLElement
    error.hidden = true
    await waitForPaint()

    expect(input.getAttribute("aria-describedby")).toBe("epost-help vilkar")
  })

  it("turns disabled off again when the host turns it off", async () => {
    document.body.innerHTML = `
      <lt-field disabled>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement
    expect(input.disabled).toBe(true)
    expect(label.getAttribute("aria-disabled")).toBe("true")
    // A real `disabled` needs no copy, and `lt.field()` writes none.
    expect(input.hasAttribute("aria-disabled")).toBe(false)

    const felt = document.querySelector("lt-field") as LtField
    felt.disabled = false
    await Promise.resolve()

    expect(input.disabled).toBe(false)
    expect(label.hasAttribute("aria-disabled")).toBe(false)
  })

  it("leaves a disabled the server wrote on the control", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" disabled="disabled" />
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement
    expect(input.getAttribute("disabled")).toBe("disabled")
    expect(label.getAttribute("aria-disabled")).toBe("true")

    // The host has had `disabled` and lost it again. The server's word on
    // the control still stands.
    const felt = document.querySelector("lt-field") as LtField
    felt.disabled = true
    await Promise.resolve()
    felt.disabled = false
    await Promise.resolve()

    expect(input.getAttribute("disabled")).toBe("disabled")
  })

  it("does not touch an aria-disabled the consumer wrote", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" aria-disabled="true" />
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-disabled")).toBe("true")
  })

  it("remembers what it wrote also after being moved", async () => {
    /*
     * React throws away and recreates nodes on a restructure, and moves them
     * on a `key` change. If the component forgot what it had written the
     * moment it was disconnected, it read its own `aria-invalid="true"` as
     * the server's word when it came back, and the field could never become
     * valid.
     */
    document.body.innerHTML = `
      <div id="a"></div>
      <div id="b"></div>
    `
    const a = document.getElementById("a") as HTMLElement
    const b = document.getElementById("b") as HTMLElement
    a.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-error-text">Feil</p>
      </lt-field>
    `
    await Promise.resolve()

    const felt = a.querySelector("lt-field") as LtField
    const input = felt.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("true")

    b.append(felt)
    await Promise.resolve()
    ;(felt.querySelector(".lt-error-text") as HTMLElement).hidden = true
    await waitForPaint()

    expect(input.getAttribute("aria-invalid")).toBeNull()
  })

  it("remembers what it wrote on a control that disappears and comes back", async () => {
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" />
        <p class="lt-error-text">Feil</p>
      </lt-field>
    `
    await Promise.resolve()

    const felt = document.querySelector("lt-field") as LtField
    const input = felt.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("true")

    input.remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    felt.append(input)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    ;(felt.querySelector(".lt-error-text") as HTMLElement).hidden = true
    await waitForPaint()

    expect(input.getAttribute("aria-invalid")).toBeNull()
  })

  it("leaves the server's aria-invalid=false alone", async () => {
    // Valid and common in handwritten HTML, which is exactly the markup the
    // component exists for. It was removed, and every patch that sent it had
    // it removed again.
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" type="email" aria-invalid="false" />
        <p class="lt-error-text" hidden>Feil</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".lt-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("false")

    // The error text is shown and hidden again. The server's "false" comes back.
    error.hidden = false
    await waitForPaint()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    error.hidden = true
    await waitForPaint()
    expect(input.getAttribute("aria-invalid")).toBe("false")
  })

  it("leaves the server's aria-invalid=spelling alone, and treats the field as invalid", async () => {
    // `grammar` and `spelling` are valid values and mean invalid. They were
    // read as "not true", and removed.
    document.body.innerHTML = `
      <lt-field>
        <label for="tekst">Tekst</label>
        <input id="tekst" class="lt-input" aria-invalid="spelling" />
        <p class="lt-error-text">Ordet finnes ikke.</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".lt-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("spelling")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(error.hidden).toBe(false)
  })

  it("reads aria-invalid with an empty string as valid", async () => {
    // ARIA says the empty string is read as `false`, and assistive
    // technology does so. The component treated it as invalid, and showed a
    // red border and an error text on a field the screen reader called
    // valid.
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" aria-invalid="" />
        <p class="lt-error-text" hidden>Feil</p>
      </lt-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".lt-error-text") as HTMLElement
    expect(input.getAttribute("data-state")).toBeNull()

    // The error text is shown and hidden again. The server's empty string
    // comes back.
    error.hidden = false
    await waitForPaint()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    error.hidden = true
    await waitForPaint()
    expect(input.getAttribute("aria-invalid")).toBe("")
    expect(input.getAttribute("data-state")).toBeNull()
  })

  it("leaves an id when the server moves the help text out and keeps it", async () => {
    // The id has been managed by the component. If it still points to an
    // element, it is the server's: the DOM decides that, not what the
    // component has dealt with before.
    document.body.innerHTML = `
      <div id="frame">
        <lt-field>
          <label for="epost">E-post</label>
          <input id="epost" class="lt-input" aria-describedby="epost-help" />
          <p class="lt-help-text" id="epost-help">Hjelp</p>
        </lt-field>
      </div>
    `
    await Promise.resolve()

    const felt = document.querySelector("lt-field") as LtField
    const hjelp = document.querySelector(".lt-help-text") as HTMLElement
    const ramme = document.getElementById("frame") as HTMLElement
    ramme.append(hjelp)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(felt.contains(hjelp)).toBe(false)
    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("epost-help")
  })

  it("does not treat a removed help text as an extra id from the server", async () => {
    // The server wrote `aria-describedby="epost-help"`. A script removes the
    // help text without touching the control. The id was managed by the
    // component, and must not stay as if the server had added it.
    document.body.innerHTML = `
      <lt-field>
        <label for="epost">E-post</label>
        <input id="epost" class="lt-input" aria-describedby="epost-help" />
        <p class="lt-help-text" id="epost-help">Hjelp</p>
      </lt-field>
    `
    await Promise.resolve()

    document.querySelector(".lt-help-text")?.remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBeNull()
  })
})

describe("lt-field does not read its own echo from the label", () => {
  beforeAll(() => {
    defineLtField()
  })

  async function felt(
    vert: string,
    kontroll = '<input id="navn" class="lt-input" />',
  ) {
    mount(
      `<lt-field ${vert}><label for="navn">Navn</label>${kontroll}</lt-field>`,
    )
    await customElements.whenDefined("lt-field")
    await waitForPaint()
    return {
      vert: document.querySelector("lt-field") as LtField,
      ledetekst: document.querySelector("label") as HTMLLabelElement,
      kontroll: document.querySelector("input") as HTMLInputElement,
    }
  }

  it("removes data-optional when optional is removed from the host", async () => {
    const { vert, ledetekst } = await felt("optional")
    expect(ledetekst.hasAttribute("data-optional")).toBe(true)

    vert.removeAttribute("optional")
    await waitForPaint()

    expect(ledetekst.hasAttribute("data-optional")).toBe(false)
  })

  it("leaves the markers the server wrote on the label", async () => {
    mount(
      `<lt-field><label for="navn" data-required="text">Navn</label><input id="navn" class="lt-input" /></lt-field>`,
    )
    await customElements.whenDefined("lt-field")
    await waitForPaint()
    const ledetekst = document.querySelector("label") as HTMLLabelElement
    const vert = document.querySelector("lt-field") as LtField

    // One more round, as a patch would trigger.
    vert.setAttribute("described-by", "annet")
    await waitForPaint()

    expect(ledetekst.getAttribute("data-required")).toBe("text")
  })

  it("removes disabled and optional when the property is set to undefined", async () => {
    // This is how React 19 writes a prop that is gone. `toggleAttribute`
    // with `undefined` toggles, and the attribute came back.
    const { vert } = await felt("")
    const egenskaper = vert as unknown as Record<string, boolean | undefined>

    for (const navn of ["disabled", "optional"]) {
      egenskaper[navn] = undefined
      expect(vert.hasAttribute(navn), `${navn} på et felt uten`).toBe(false)

      egenskaper[navn] = true
      egenskaper[navn] = undefined
      expect(vert.hasAttribute(navn), `${navn} på et felt med`).toBe(false)
    }
  })

  it("leaves a data-state the template wrote by hand", async () => {
    const { kontroll } = await felt(
      "",
      '<input id="navn" class="lt-input" data-state="invalid" />',
    )
    expect(kontroll.getAttribute("data-state")).toBe("invalid")
  })

  it("still removes the data-state it wrote when the field becomes valid", async () => {
    const { kontroll } = await felt(
      "",
      '<input id="navn" class="lt-input" /><p class="lt-error-text">Feil</p>',
    )
    expect(kontroll.getAttribute("data-state")).toBe("invalid")

    ;(document.querySelector(".lt-error-text") as HTMLElement).hidden = true
    await waitForPaint()

    expect(kontroll.hasAttribute("data-state")).toBe(false)
  })

  it("connects only its own parts when a field is inside another", async () => {
    /*
     * A search field in a popover inside the field, or a field in a field, is
     * ordinary markup. `querySelector` over the whole subtree found the
     * innermost field's control first, and the outer field wrote `for`,
     * `aria-describedby` and `id` on it. Each field must see only its own
     * parts.
     */
    document.body.innerHTML = `
      <lt-field id="ytre">
        <label id="ytre-label">Kommune</label>
        <div popover>
          <lt-field id="indre">
            <label id="indre-label">Søk i lista</label>
            <input id="indre-input" class="lt-input" type="search" />
            <p class="lt-help-text" id="indre-help">Skriv minst to bokstaver.</p>
            <p class="lt-error-text" id="indre-error">Ingen treff.</p>
          </lt-field>
        </div>
        <input id="ytre-input" class="lt-input" type="text" />
        <p class="lt-help-text" id="ytre-help">Kommunen du bor i.</p>
      </lt-field>
    `
    await waitForPaint()

    const ytreLabel = document.getElementById("ytre-label") as HTMLLabelElement
    const ytreInput = document.getElementById("ytre-input") as HTMLInputElement
    const indreLabel = document.getElementById(
      "indre-label",
    ) as HTMLLabelElement
    const indreInput = document.getElementById(
      "indre-input",
    ) as HTMLInputElement

    expect(ytreLabel.htmlFor).toBe("ytre-input")
    expect(ytreInput.getAttribute("aria-describedby")).toBe("ytre-help")
    expect(ytreInput.hasAttribute("aria-invalid")).toBe(false)

    expect(indreLabel.htmlFor).toBe("indre-input")
    expect(indreInput.getAttribute("aria-describedby")).toBe(
      "indre-help indre-error",
    )
    expect(indreInput.getAttribute("aria-invalid")).toBe("true")
  })

  it("treats an error text hidden with a class as hidden", async () => {
    // `display: none` from a class, such as a utility class in the app, is
    // just as hidden as `hidden`. Only the inline style used to be read.
    document.body.innerHTML = `
      <style>.borte { display: none }</style>
      <lt-field>
        <label class="lt-label" for="e">E-post</label>
        <input class="lt-input" id="e">
        <p class="lt-error-text borte">Skriv en gyldig adresse.</p>
      </lt-field>`
    await waitForPaint()
    const input = document.getElementById("e") as HTMLInputElement
    expect(input.hasAttribute("aria-invalid")).toBe(false)

    ;(document.querySelector(".lt-error-text") as HTMLElement).classList.remove(
      "borte",
    )
    await waitForPaint()
    expect(input.getAttribute("aria-invalid")).toBe("true")
  })

  it("says nothing when the label wraps the whole element", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    document.body.innerHTML = `<label>Navn <lt-field><input class="lt-input" name="navn"></lt-field></label>`
    await waitForPaint()
    await new Promise((r) => setTimeout(r, 300))
    expect(
      (document.querySelector("input") as HTMLInputElement).labels?.length,
    ).toBe(1)
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })

  it("rewrites for, and reports it, when the label pointed to another id", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    document.body.innerHTML = `<lt-field><label class="lt-label" for="feil">Navn</label><input class="lt-input" id="navn"></lt-field>`
    await waitForPaint()
    await new Promise((r) => setTimeout(r, 300))
    expect((document.querySelector("label") as HTMLLabelElement).htmlFor).toBe(
      "navn",
    )
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0][0])).toContain(
      "pointed to a different id",
    )
    advarsel.mockRestore()
  })

  it("says nothing about a control without an id that is named by aria-labelledby", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    document.body.innerHTML = `<lt-field><label id="l">Navn</label><input class="lt-input" name="navn" aria-labelledby="l"></lt-field>`
    await waitForPaint()
    await new Promise((r) => setTimeout(r, 300))
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })

  it("does not point aria-describedby to a hidden error text even when the server says invalid", async () => {
    document.body.innerHTML = `<lt-field>
      <label class="lt-label" for="e">E-post</label>
      <input class="lt-input" id="e" aria-invalid="true">
      <p class="lt-error-text" hidden>Skriv en gyldig adresse.</p>
    </lt-field>`
    await waitForPaint()
    const input = document.getElementById("e") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("aria-describedby")).toBeNull()
  })
})
