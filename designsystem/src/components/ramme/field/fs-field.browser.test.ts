/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { computeFieldAttributes } from "./field-core"
import { defineFsField, type FsField } from "./fs-field"
import "../../../tokens/tokens.css"
import "./field.css"

describe("fs-field", () => {
  beforeAll(() => {
    defineFsField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("wires label[for] to the control id", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label id="label">E-post</label>
        <input id="email" class="fs-input" type="email" />
      </fs-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.htmlFor).toBe("email")
  })

  it("adds ids and aria-describedby for help and error text", async () => {
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="email">E-post</label>
        <input id="email" class="fs-input" type="email" />
        <p class="fs-help-text">Hjelp</p>
        <p class="fs-error-text">Feil</p>
      </fs-field>
    `

    await Promise.resolve()

    const field = document.querySelector("fs-field") as HTMLElement
    const input = field.querySelector("input") as HTMLInputElement
    const help = field.querySelector(".fs-help-text") as HTMLElement
    const error = field.querySelector(".fs-error-text") as HTMLElement

    expect(help.id.length).toBeGreaterThan(0)
    expect(error.id.length).toBeGreaterThan(0)
    expect(input.getAttribute("aria-invalid")).toBe("true")

    const describedBy = input.getAttribute("aria-describedby") || ""
    expect(describedBy).toContain(help.id)
    expect(describedBy).toContain(error.id)
  })

  it("hides error text until invalid is true", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="email">E-post</label>
        <input id="email" class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()

    const error = document.querySelector(".fs-error-text") as HTMLElement
    // `hidden` alene: et skjult element er allerede ute av
    // tilgjengelighetstreet, og `aria-hidden` ga hydreringsfeil i React.
    expect(error.hidden).toBe(true)

    const field = document.querySelector("fs-field") as FsField
    field.invalid = true

    await Promise.resolve()

    expect(error.hidden).toBe(false)
  })

  it("applies required marker and optional marker on label", async () => {
    document.body.innerHTML = `
      <fs-field required-marker="text">
        <label id="label">Navn</label>
        <input class="fs-input" />
      </fs-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.getAttribute("data-required")).toBe("text")

    document.body.innerHTML = `
      <fs-field optional>
        <label id="label-2">Telefon</label>
        <input class="fs-input" />
      </fs-field>
    `

    await Promise.resolve()

    const label2 = document.getElementById("label-2") as HTMLLabelElement
    expect(label2.hasAttribute("data-optional")).toBe(true)
  })
})

describe("fs-field tilgjengelighet", () => {
  it("gir ingen brudd for et felt med hjelpetekst og feilmelding", async () => {
    monter(`
      <fs-field required-marker="symbol" invalid>
        <label>E-postadresse</label>
        <input class="fs-input" type="email" value="ola@" required />
        <p class="fs-help-text">Vi sender kvittering til denne adressen.</p>
        <p class="fs-error-text">Skriv en e-postadresse med krøllalfa.</p>
      </fs-field>

      <fs-field optional>
        <label>Melding til saksbehandler</label>
        <textarea class="fs-textarea" rows="3"></textarea>
        <p class="fs-help-text">Du kan skrive opptil 500 tegn.</p>
      </fs-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })

  it("gir ingen brudd for et felt uten hjelpetekst", async () => {
    monter(`
      <fs-field>
        <label>Fullt navn</label>
        <input class="fs-input" type="text" />
      </fs-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-field ledetekst", () => {
  it("gir ledeteksten fs-label, slik at required-marker faktisk vises", async () => {
    monter(`
      <fs-field required-marker="text">
        <label>E-postadresse</label>
        <input class="fs-input" type="email" />
      </fs-field>
    `)

    await ventPaTegning()

    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.classList.contains("fs-label")).toBe(true)
    expect(label.getAttribute("data-required")).toBe("text")

    // Attributtet alene er dødt uten klassen. Markeringen kommer fra ::after
    const markering = getComputedStyle(label, "::after").content
    expect(markering).toContain("påkrevd")
  })

  it("markerer valgfrie felt på samme måte", async () => {
    monter(`
      <fs-field optional>
        <label>Adresse</label>
        <input class="fs-input" type="text" />
      </fs-field>
    `)

    await ventPaTegning()

    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.classList.contains("fs-label")).toBe(true)
    expect(getComputedStyle(label, "::after").content).toContain("valgfri")
  })
})

describe("fs-field krangler ikke med serveren", () => {
  /**
   * Demoappene fanget dette, ikke enhetstestene.
   *
   * Skrev serveren feltet med `fs.field()`, regnet komponenten ut sitt eget
   * svar fra attributtene på verten, fant ingen `invalid` og ingen
   * `required-marker`, og fjernet det serveren nettopp hadde skrevet. I React
   * ble det en hydreringsfeil, i Datastar en feilmelding som dukket opp på et
   * gyldig felt ved neste patch.
   *
   * Komponenten leser derfor tilstanden fra markupen, ikke fra et parallelt
   * attributt.
   */
  it("lar attributtene serveren skrev stå", async () => {
    const felt = computeFieldAttributes({
      id: "epost",
      help: true,
      error: true,
      invalid: true,
      required: "symbol",
    })

    monter(`
      <fs-field>
        <label ${attr(felt.label)}>E-postadresse</label>
        <input class="fs-input" type="email" ${attr(felt.control)} />
        <p class="fs-help-text" ${attr(felt.help)}>Vi sender kvittering hit.</p>
        <p class="fs-error-text" ${attr(felt.error)}>Skriv en gyldig adresse.</p>
      </fs-field>
    `)

    await ventPaTegning()

    const input = document.getElementById("epost") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement
    const feilmelding = document.querySelector(".fs-error-text") as HTMLElement

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("aria-describedby")).toBe(
      "epost-help epost-error",
    )
    expect(label.getAttribute("data-required")).toBe("symbol")
    expect(feilmelding.hidden).toBe(false)
  })

  it("setter ikke aria-hidden på feilmeldingen", async () => {
    // `hidden` tar den allerede ut av tilgjengelighetstreet, og et attributt
    // serveren ikke skriver gir hydreringsfeil i React.
    monter(`
      <fs-field>
        <label>E-postadresse</label>
        <input class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig adresse.</p>
      </fs-field>
    `)

    await ventPaTegning()

    const feilmelding = document.querySelector(".fs-error-text") as HTMLElement
    expect(feilmelding.hidden).toBe(true)
    expect(feilmelding.hasAttribute("aria-hidden")).toBe(false)
  })
})

/**
 * Dokumentasjonen viser hva serveren sender og hva som står i siden etterpå.
 * Den lista var feil: `aria-describedby` manglet id-en til feilmeldingen,
 * og ingenting sa fra, for ingen test leste den. Nå står påstanden her.
 */
describe("fs-field kobler markup som bare har struktur", () => {
  beforeAll(() => {
    defineFsField()
  })

  it("gir hele koblingen av ett invalid på verten", async () => {
    monter(`
      <fs-field invalid required-marker="symbol">
        <label>E-post</label>
        <input class="fs-input" type="email">
        <p class="fs-help-text">Vi sender aldri spam.</p>
        <p class="fs-error-text">Skriv en gyldig adresse.</p>
      </fs-field>
    `)

    await ventPaTegning()

    const label = document.querySelector("label") as HTMLLabelElement
    const input = document.querySelector("input") as HTMLInputElement
    const hjelp = document.querySelector(".fs-help-text") as HTMLElement
    const feilmelding = document.querySelector(".fs-error-text") as HTMLElement

    expect(label.getAttribute("class")).toBe("fs-label")
    expect(label.getAttribute("for")).toBe(input.id)
    expect(label.getAttribute("data-required")).toBe("symbol")
    expect(input.id).toMatch(/^fs-field-control-/)
    expect(hjelp.id).toMatch(/^fs-field-help-/)
    expect(feilmelding.id).toMatch(/^fs-field-error-/)
    expect(input.getAttribute("aria-describedby")).toBe(
      `${hjelp.id} ${feilmelding.id}`,
    )
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(feilmelding.hidden).toBe(false)
  })
})

describe("fs-field er et blokkelement", () => {
  beforeAll(() => {
    defineFsField()
  })

  it("sier selv at det er en blokk", async () => {
    // Uten dette er elementet `display: inline`, og en avstand satt utenpå
    // det gjør ingenting. Barna er blokker, så feilen synes ikke før noen
    // legger feltet i et rutenett eller gir det en margin.
    monter(`
      <fs-field>
        <label class="fs-label">E-post</label>
        <input class="fs-input" type="email" />
      </fs-field>
    `)

    await ventPaTegning()

    const felt = document.querySelector("fs-field") as HTMLElement
    expect(getComputedStyle(felt).display).toBe("block")
  })
})
