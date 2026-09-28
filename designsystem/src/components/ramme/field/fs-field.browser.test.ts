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

  it("tar tilbake feilmeldingen når invalid slås av igjen", async () => {
    /*
     * Komponenten leser `aria-invalid` fra kontrollen, fordi serveren kan ha
     * skrevet feltet med `fs.field()` og da står svaret allerede der. Uten et
     * skille mellom serverens attributt og komponentens eget leste den
     * tilbake sitt eget svar fra forrige runde, og feltet kunne aldri bli
     * gyldig igjen: den røde rammen og feilmeldingen ble stående for godt.
     */
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("true")

    const field = document.querySelector("fs-field") as FsField
    field.invalid = false

    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBeNull()
    expect(input.getAttribute("data-state")).toBeNull()
    expect(error.hidden).toBe(true)
  })

  it("lar serverens eget aria-invalid stå", async () => {
    // Skrev serveren feltet med `fs.field()`, står `aria-invalid` på
    // kontrollen uten at verten har `invalid`. Da er attributtet serverens,
    // og komponenten skal lese det, ikke fjerne det.
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" aria-invalid="true" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)
  })

  it("lar serverens aria-invalid stå, også når verten slår av sitt eget", async () => {
    /*
     * To kilder som sier hver sin ting, og serveren vinner.
     *
     * Står `aria-invalid` på kontrollen i markupen serveren sendte, er det
     * serverens ord om feltet. `felt.invalid = false` fjerner flagget på
     * verten, men kan ikke stryke det serveren skrev: da ville den samme
     * markupen gitt to ulike svar alt etter hva verten hadde vært innom, og
     * komponenten ville overkjørt serveren uten at noe sa fra.
     *
     * Skal feltet bli gyldig, må serveren si det, eller appen må bruke den
     * ene av de to kildene og ikke begge. Dokumentasjonen sier hvilken.
     */
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" aria-invalid="true" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    const field = document.querySelector("fs-field") as FsField
    field.invalid = false

    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(error.hidden).toBe(false)
  })

  it("gir samme svar på samme markup, uansett hva verten har vært innom", async () => {
    /*
     * Komponenten skal ikke være avhengig av historien sin.
     *
     * En tidligere utgave husket hva verten sa sist, og da ga nøyaktig den
     * samme markupen to ulike svar: et felt der `invalid` hadde vært innom på
     * verten mistet serverens `aria-invalid`, mens et ferskt felt beholdt det.
     * I en Datastar-app, der `data-attr:invalid` slår flagget av og på, sto
     * feltet grønt mens serveren sa det var feil.
     */
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" aria-invalid="true" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()
    const field = document.querySelector("fs-field") as FsField
    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement

    // Verten får flagget og mister det igjen, slik et signal ville gjort.
    field.setAttribute("invalid", "")
    await Promise.resolve()
    field.removeAttribute("invalid")
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(error.hidden).toBe(false)
  })

  it("følger serveren når en patch bytter ut kontrollen", async () => {
    /*
     * Serveren kan si det samme på to måter, og bytte mellom dem i en patch:
     * flagget på verten i én runde, og en ferdig skrevet kontroll i den
     * neste. Husker komponenten «dette attributtet er mitt eget ekko», og
     * knytter det til seg selv framfor til kontrollen, regner den feltet som
     * gyldig i det kontrollen byttes ut. Brukeren ser da et felt uten rød
     * ramme og uten feilmelding, mens serveren nettopp sa at det er feil.
     */
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()
    const felt = document.querySelector("fs-field") as FsField
    expect(document.querySelector("input")?.getAttribute("aria-invalid")).toBe(
      "true",
    )

    // Patchen: ny kontroll som selv sier ugyldig, og flagget bort fra verten.
    const gammel = document.querySelector("input") as HTMLInputElement
    const ny = document.createElement("input")
    ny.id = "epost"
    ny.className = "fs-input"
    ny.type = "email"
    ny.setAttribute("aria-invalid", "true")
    gammel.replaceWith(ny)
    felt.removeAttribute("invalid")

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(ny.getAttribute("aria-invalid")).toBe("true")
    expect(ny.getAttribute("data-state")).toBe("invalid")
    expect(error.hidden).toBe(false)
  })

  it("holder koblingen når en patch bytter ut kontrollen, med ledeteksten utenfor", async () => {
    /*
     * Ledeteksten utenfor elementet finnes bare gjennom kontrollens id, og
     * en patch fra en Kotlin- eller Go-server sender gjerne en kontroll uten
     * id. Da fant komponenten ingen ledetekst, laget en ny id, og
     * ledetekstens `for` pekte på et element som ikke fantes. Feltet sto uten
     * navn for en skjermleser, og det holdt seg til siden ble lastet på nytt.
     */
    document.body.innerHTML = `
      <div>
        <label class="fs-label" for="epost">E-post</label>
        <fs-field>
          <input id="epost" class="fs-input" type="email" />
        </fs-field>
      </div>
    `

    await Promise.resolve()

    const label = document.querySelector("label") as HTMLLabelElement
    const gammel = document.querySelector("input") as HTMLInputElement
    expect(label.htmlFor).toBe(gammel.id)

    const ny = document.createElement("input")
    ny.className = "fs-input"
    ny.type = "email"
    gammel.replaceWith(ny)

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(ny.id).toBe("epost")
    expect(label.htmlFor).toBe("epost")
    expect(document.getElementById(label.htmlFor)).toBe(ny)
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
  /*
   * `data-role` er veien inn for markup som ikke bruker systemets klassenavn.
   * Uten dekningen sto krokene bare i en `querySelector` i kilden, og kunne
   * blitt strøket i en opprydding uten at noe sa fra.
   */
  it("finds help and error text through data-role", async () => {
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="postnummer">Postnummer</label>
        <input id="postnummer" class="egen-kontroll" />
        <p class="egen-hjelp" data-role="help">Fire siffer</p>
        <p class="egen-feil" data-role="error">Postnummeret må ha fire siffer.</p>
      </fs-field>
    `

    await Promise.resolve()

    const input = document.getElementById("postnummer") as HTMLInputElement
    const help = document.querySelector(".egen-hjelp") as HTMLElement
    const error = document.querySelector(".egen-feil") as HTMLElement

    expect(help.id.length).toBeGreaterThan(0)
    expect(error.id.length).toBeGreaterThan(0)

    const describedBy = input.getAttribute("aria-describedby") || ""
    expect(describedBy).toContain(help.id)
    expect(describedBy).toContain(error.id)
    expect(error.hasAttribute("hidden")).toBe(false)
  })

  it("hides a data-role error until the field is invalid", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="postnummer">Postnummer</label>
        <input id="postnummer" class="egen-kontroll" />
        <p class="egen-feil" data-role="error">Postnummeret må ha fire siffer.</p>
      </fs-field>
    `

    await Promise.resolve()

    const felt = document.querySelector("fs-field") as FsField
    const error = document.querySelector(".egen-feil") as HTMLElement
    expect(error.hasAttribute("hidden")).toBe(true)

    felt.invalid = true
    await Promise.resolve()

    expect(error.hasAttribute("hidden")).toBe(false)
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

/**
 * Komponenten eier bare det den selv skrev.
 *
 * Tre attributter leses fra kontrollen og skrives dit igjen: `aria-invalid`,
 * `aria-describedby` og `disabled`. For hvert av dem må komponenten vite hva
 * den skrev sist, ellers leser den sitt eget ekko som serverens ord. Det var
 * løst for `aria-invalid` alene, og de to andre hadde nøyaktig samme feil:
 * `aria-describedby` krympet aldri, og `disabled` lot seg ikke slå av igjen.
 */
describe("fs-field eier bare det den selv skrev", () => {
  beforeAll(() => {
    defineFsField()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("tar feilmeldingen ut av aria-describedby når invalid slås av", async () => {
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-help-text" id="h">Hjelp</p>
        <p class="fs-error-text" id="x">Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("h x")

    const felt = document.querySelector("fs-field") as FsField
    felt.invalid = false
    await Promise.resolve()

    expect(input.getAttribute("aria-describedby")).toBe("h")
  })

  it("tar hjelpeteksten ut av aria-describedby når en patch fjerner den", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-help-text" id="h">Hjelp</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("h")

    document.querySelector(".fs-help-text")?.remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(input.getAttribute("aria-describedby")).toBeNull()
  })

  it("tar de ekstra id-ene ut igjen når described-by fjernes fra verten", async () => {
    document.body.innerHTML = `
      <p id="ekstra">Les vilkårene først.</p>
      <fs-field described-by="ekstra">
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("ekstra")

    const felt = document.querySelector("fs-field") as FsField
    felt.describedBy = undefined
    await Promise.resolve()

    expect(input.getAttribute("aria-describedby")).toBeNull()
  })

  it("beholder id-er serveren selv la i aria-describedby", async () => {
    // `fs.field({ describedBy: ["vilkar"] })` skriver id-en rett på
    // kontrollen. Den er serverens, og skal stå, også etter at komponenten
    // har skrevet attributtet på nytt for å ta bort feilmeldingen.
    document.body.innerHTML = `
      <p id="vilkar">Vilkår</p>
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email"
               aria-describedby="epost-help epost-error vilkar" />
        <p class="fs-help-text" id="epost-help">Hjelp</p>
        <p class="fs-error-text" id="epost-error">Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe(
      "epost-help epost-error vilkar",
    )

    const felt = document.querySelector("fs-field") as FsField
    felt.invalid = false
    await Promise.resolve()

    expect(input.getAttribute("aria-describedby")).toBe("epost-help vilkar")
  })

  it("slår disabled av igjen når verten slår det av", async () => {
    document.body.innerHTML = `
      <fs-field disabled>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement
    expect(input.disabled).toBe(true)
    expect(label.getAttribute("aria-disabled")).toBe("true")
    // Et ekte `disabled` trenger ingen kopi, og `fs.field()` skriver ingen.
    expect(input.hasAttribute("aria-disabled")).toBe(false)

    const felt = document.querySelector("fs-field") as FsField
    felt.disabled = false
    await Promise.resolve()

    expect(input.disabled).toBe(false)
    expect(label.hasAttribute("aria-disabled")).toBe(false)
  })

  it("lar et disabled serveren skrev på kontrollen stå", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" disabled="disabled" />
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement
    expect(input.getAttribute("disabled")).toBe("disabled")
    expect(label.getAttribute("aria-disabled")).toBe("true")

    // Verten har vært innom `disabled` og ut igjen. Serverens ord på
    // kontrollen står fortsatt.
    const felt = document.querySelector("fs-field") as FsField
    felt.disabled = true
    await Promise.resolve()
    felt.disabled = false
    await Promise.resolve()

    expect(input.getAttribute("disabled")).toBe("disabled")
  })

  it("rører ikke et aria-disabled konsumenten selv skrev", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" aria-disabled="true" />
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-disabled")).toBe("true")
  })

  it("husker hva den skrev også etter å ha blitt flyttet", async () => {
    /*
     * React kaster og lager noder på nytt ved en omstrukturering, og flytter
     * dem ved en `key`-endring. Glemte komponenten hva den hadde skrevet i det
     * den ble koblet fra, leste den sitt eget `aria-invalid="true"` som
     * serverens ord da den kom tilbake, og feltet kunne aldri bli gyldig.
     */
    document.body.innerHTML = `
      <div id="a"></div>
      <div id="b"></div>
    `
    const a = document.getElementById("a") as HTMLElement
    const b = document.getElementById("b") as HTMLElement
    a.innerHTML = `
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text">Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const felt = a.querySelector("fs-field") as FsField
    const input = felt.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("true")

    b.append(felt)
    await Promise.resolve()
    felt.invalid = false
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBeNull()
    expect(felt.querySelector(".fs-error-text")?.hasAttribute("hidden")).toBe(
      true,
    )
  })

  it("husker hva den skrev på en kontroll som forsvinner og kommer tilbake", async () => {
    document.body.innerHTML = `
      <fs-field invalid>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
      </fs-field>
    `
    await Promise.resolve()

    const felt = document.querySelector("fs-field") as FsField
    const input = felt.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("true")

    input.remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    felt.append(input)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    felt.invalid = false
    await Promise.resolve()

    expect(input.getAttribute("aria-invalid")).toBeNull()
  })

  it("lar serverens aria-invalid=false stå", async () => {
    // Gyldig og vanlig i håndskrevet HTML, altså nettopp markupen komponenten
    // finnes for. Den ble strøket, og hver patch som sendte den fikk den
    // strøket igjen.
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" aria-invalid="false" />
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("false")

    // Verten slår på og av igjen. Serverens «false» kommer tilbake.
    const felt = document.querySelector("fs-field") as FsField
    felt.invalid = true
    await Promise.resolve()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    felt.invalid = false
    await Promise.resolve()
    expect(input.getAttribute("aria-invalid")).toBe("false")
  })

  it("lar serverens aria-invalid=spelling stå, og regner feltet som ugyldig", async () => {
    // `grammar` og `spelling` er lovlige verdier og betyr ugyldig. De ble
    // lest som «ikke true», og strøket.
    document.body.innerHTML = `
      <fs-field>
        <label for="tekst">Tekst</label>
        <input id="tekst" class="fs-input" aria-invalid="spelling" />
        <p class="fs-error-text">Ordet finnes ikke.</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("spelling")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(error.hidden).toBe(false)
  })

  it("leser aria-invalid med tom streng som gyldig", async () => {
    // ARIA sier at tom streng skal leses som `false`, og hjelpemidlene gjør
    // det. Komponenten regnet den som ugyldig, og viste rød ramme og
    // feilmelding på et felt skjermleseren kalte gyldig.
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" aria-invalid="" />
        <p class="fs-error-text">Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.getAttribute("data-state")).toBeNull()
    expect(error.hidden).toBe(true)

    // Verten slår på og av igjen. Serverens tomme streng kommer tilbake.
    const felt = document.querySelector("fs-field") as FsField
    felt.invalid = true
    await Promise.resolve()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    felt.invalid = false
    await Promise.resolve()
    expect(input.getAttribute("aria-invalid")).toBe("")
    expect(error.hidden).toBe(true)
  })

  it("lar en id stå når serveren flytter hjelpeteksten ut og beholder den", async () => {
    // Id-en har vært komponentens å forvalte. Peker den fortsatt på et
    // element, er den serverens: eierskapet avgjøres av DOM-en, ikke av
    // hva komponenten har vært borti før.
    document.body.innerHTML = `
      <div id="ramme">
        <fs-field>
          <label for="epost">E-post</label>
          <input id="epost" class="fs-input" aria-describedby="epost-help" />
          <p class="fs-help-text" id="epost-help">Hjelp</p>
        </fs-field>
      </div>
    `
    await Promise.resolve()

    const felt = document.querySelector("fs-field") as FsField
    const hjelp = document.querySelector(".fs-help-text") as HTMLElement
    const ramme = document.getElementById("ramme") as HTMLElement
    ramme.append(hjelp)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(felt.contains(hjelp)).toBe(false)
    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("epost-help")
  })

  it("regner ikke en fjernet hjelpetekst som serverens ekstra id", async () => {
    // Serveren skrev `aria-describedby="epost-help"`. Et skript fjerner
    // hjelpeteksten uten å røre kontrollen. Id-en var komponentens å
    // forvalte, og skal ikke bli stående som om serveren la den til.
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" aria-describedby="epost-help" />
        <p class="fs-help-text" id="epost-help">Hjelp</p>
      </fs-field>
    `
    await Promise.resolve()

    document.querySelector(".fs-help-text")?.remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBeNull()
  })

  it("lar requiredMarker som egenskap bety det samme som attributtet", async () => {
    // `required-marker="none"` på verten overstyrer en `data-required`
    // serveren skrev på ledeteksten, så veien gjennom setteren må bety det
    // samme. Setteren fjernet attributtet for `none`, og markeringen kom
    // tilbake fra ledeteksten.
    document.body.innerHTML = `
      <fs-field>
        <label for="navn" data-required="symbol">Navn</label>
        <input id="navn" class="fs-input" />
      </fs-field>
    `
    await Promise.resolve()

    const felt = document.querySelector("fs-field") as FsField
    const label = document.querySelector("label") as HTMLLabelElement
    // Getteren leser markupen, ikke bare sitt eget attributt.
    expect(felt.requiredMarker).toBe("symbol")

    felt.requiredMarker = "none"
    await Promise.resolve()

    expect(felt.getAttribute("required-marker")).toBe("none")
    expect(label.hasAttribute("data-required")).toBe(false)
    expect(felt.requiredMarker).toBe("none")
  })
})
