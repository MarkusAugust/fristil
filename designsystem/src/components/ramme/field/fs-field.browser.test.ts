/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
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

/** Attributtnavnene på et element, sortert. */
function navnene(element: Element): string[] {
  return [...element.attributes].map((a) => a.name).sort()
}

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
      <fs-field>
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

  it("regner feltet som ugyldig når feilmeldingen synes, og gyldig når den er skjult", async () => {
    /*
     * Feilmeldingens synlighet er sannheten. En mal rendrer den når feltet er
     * ugyldig, og klientkode slår `hidden` av og på. Komponenten rører den
     * aldri: før skjulte den en feilmelding serveren hadde rendret synlig,
     * fordi verten manglet `invalid`.
     */
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text" hidden>Skriv en gyldig e-post.</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    expect(input.getAttribute("aria-describedby")).toBeNull()

    error.hidden = false
    await ventPaTegning()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
    expect(input.getAttribute("aria-describedby")).toBe(error.id)

    error.hidden = true
    await ventPaTegning()
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    expect(input.hasAttribute("data-state")).toBe(false)
    expect(input.getAttribute("aria-describedby")).toBeNull()
    expect(error.hidden).toBe(true)
  })

  it("rører ikke hidden på feilmeldingen", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `
    await ventPaTegning()

    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(error.hidden).toBe(false)
    expect(error.hasAttribute("aria-hidden")).toBe(false)
  })

  it("lar serverens eget aria-invalid stå", async () => {
    // Skrev serveren feltet med `fs.field()`, står `aria-invalid` på
    // kontrollen. Da er attributtet serverens, og komponenten skal lese det,
    // ikke fjerne det.
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

  it("lar serverens aria-invalid stå, også når feilmeldingen skjules og vises igjen", async () => {
    /*
     * To kilder som sier hver sin ting, og serveren vinner. Står
     * `aria-invalid` på kontrollen i markupen serveren sendte, er det
     * serverens ord om feltet, og den samme markupen skal gi det samme svaret
     * uansett hva feilmeldingen har vært innom.
     */
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" aria-invalid="true" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    error.hidden = true
    await ventPaTegning()
    error.hidden = false
    await ventPaTegning()
    error.hidden = true
    await ventPaTegning()

    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("data-state")).toBe("invalid")
  })

  it("følger serveren når en patch bytter ut kontrollen", async () => {
    /*
     * Serveren kan si det samme på to måter, og bytte mellom dem i en patch:
     * en synlig feilmelding i én runde, og en ferdig skrevet kontroll i den
     * neste. Knytter komponenten «dette attributtet er mitt eget ekko» til seg
     * selv framfor til kontrollen, regner den feltet som gyldig i det
     * kontrollen byttes ut.
     */
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text">Skriv en gyldig e-post.</p>
      </fs-field>
    `

    await Promise.resolve()
    expect(document.querySelector("input")?.getAttribute("aria-invalid")).toBe(
      "true",
    )

    // Patchen: ny kontroll som selv sier ugyldig, og feilmeldingen skjult.
    const gammel = document.querySelector("input") as HTMLInputElement
    const ny = document.createElement("input")
    ny.id = "epost"
    ny.className = "fs-input"
    ny.type = "email"
    ny.setAttribute("aria-invalid", "true")
    gammel.replaceWith(ny)
    const error = document.querySelector(".fs-error-text") as HTMLElement
    error.hidden = true

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(ny.getAttribute("aria-invalid")).toBe("true")
    expect(ny.getAttribute("data-state")).toBe("invalid")
    expect(error.hidden).toBe(true)
  })

  it("skriver aldri id på kontrollen, heller ikke når en patch bytter den ut", async () => {
    /*
     * Datastar og idiomorph kjenner igjen en node på id, og en kontroll med en
     * id serveren ikke sendte, blir byttet ut ved neste oppdatering, med fokus
     * og det brukeren har skrevet. Komponenten fant før opp en id når
     * kontrollen manglet en, og det var nettopp den som gjorde at feltet ble
     * byttet ut. Mangler id-en, er det malens å skrive.
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

    const gammel = document.querySelector("input") as HTMLInputElement
    const ny = document.createElement("input")
    ny.className = "fs-input"
    ny.type = "email"
    gammel.replaceWith(ny)

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(ny.hasAttribute("id")).toBe(false)
  })

  it("skriver verken id eller for når ledeteksten står rundt kontrollen", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label>E-post <input class="fs-input" type="email" /></label>
        <p class="fs-help-text">Vi sender kvittering hit.</p>
      </fs-field>
    `
    await ventPaTegning()

    const label = document.querySelector("label") as HTMLLabelElement
    const input = document.querySelector("input") as HTMLInputElement
    const help = document.querySelector(".fs-help-text") as HTMLElement

    expect(input.hasAttribute("id")).toBe(false)
    expect(label.hasAttribute("for")).toBe(false)
    expect(input.labels?.[0]).toBe(label)
    expect(input.getAttribute("aria-describedby")).toBe(help.id)
  })

  it("lar data-required serveren skrev stå, og markerer valgfrie felt", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label id="label" for="navn" data-required="text">Navn</label>
        <input id="navn" class="fs-input" required />
      </fs-field>
    `

    await Promise.resolve()

    const label = document.getElementById("label") as HTMLLabelElement
    expect(label.getAttribute("data-required")).toBe("text")

    document.body.innerHTML = `
      <fs-field optional>
        <label id="label-2" for="telefon">Telefon</label>
        <input id="telefon" class="fs-input" />
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
      <fs-field>
        <label for="epost" data-required="symbol">E-postadresse</label>
        <input id="epost" class="fs-input" type="email" value="ola@" required />
        <p class="fs-help-text">Vi sender kvittering til denne adressen.</p>
        <p class="fs-error-text">Skriv en e-postadresse med krøllalfa.</p>
      </fs-field>

      <fs-field optional>
        <label for="melding">Melding til saksbehandler</label>
        <textarea id="melding" class="fs-textarea" rows="3"></textarea>
        <p class="fs-help-text">Du kan skrive opptil 500 tegn.</p>
      </fs-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })

  it("gir ingen brudd for et felt uten hjelpetekst", async () => {
    monter(`
      <fs-field>
        <label>Fullt navn <input class="fs-input" type="text" /></label>
      </fs-field>
    `)

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("fs-field ledetekst", () => {
  it("gir ledeteksten fs-label, slik at påkrevd-markeringen faktisk vises", async () => {
    monter(`
      <fs-field>
        <label for="epost" data-required="text">E-postadresse</label>
        <input id="epost" class="fs-input" type="email" />
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
        <label for="adresse">Adresse</label>
        <input id="adresse" class="fs-input" type="text" />
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

  it("setter ikke aria-hidden på en skjult feilmelding", async () => {
    // `hidden` tar den allerede ut av tilgjengelighetstreet, og et attributt
    // serveren ikke skriver gir hydreringsfeil i React.
    monter(`
      <fs-field>
        <label for="epost">E-postadresse</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text" hidden>Skriv en gyldig adresse.</p>
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

  it("gir hele koblingen av for, id og en synlig feilmelding", async () => {
    monter(`
      <fs-field>
        <label data-required="symbol">E-post</label>
        <input id="epost" class="fs-input" type="email">
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
    expect(label.getAttribute("for")).toBe("epost")
    expect(label.getAttribute("data-required")).toBe("symbol")
    expect(input.id).toBe("epost")
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
   * Komponenten leter etter hjelpetekst og feilmelding på systemets egne
   * klasser, og bare der. Den leste en gang også `[data-role='help']` og
   * `[data-role='error']`, en krok ingen dokumentasjon nevnte. `data-role` er
   * uprefikset, og eies i praksis av andre: en app som bruker det til noe
   * annet inne i et felt fikk sitt eget avsnitt adoptert som feilmelding,
   * uten at noe sa fra.
   */
  it("adopterer ikke et avsnitt som bare har en rolle på seg", async () => {
    monter(`
      <fs-field>
        <label for="postnummer">Postnummer</label>
        <input id="postnummer" class="fs-input" aria-invalid="true">
        <p class="egen-feil" data-role="error">Postnummeret må ha fire siffer.</p>
      </fs-field>
    `)

    await ventPaTegning()

    const input = document.querySelector("input") as HTMLInputElement
    const avsnitt = document.querySelector(".egen-feil") as HTMLElement

    // Ett positivt anker. Uten det ville testen bestått også om `sync()` ga
    // opp før den kom så langt, og da påstår den bare at ingenting skjedde.
    expect(input.getAttribute("aria-invalid")).toBe("true")

    expect(navnene(avsnitt)).toEqual(["class", "data-role"])
    expect(input.hasAttribute("aria-describedby")).toBe(false)
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

  it("tar feilmeldingen ut av aria-describedby når den skjules", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-help-text" id="h">Hjelp</p>
        <p class="fs-error-text" id="x">Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.getAttribute("aria-describedby")).toBe("h x")

    const error = document.getElementById("x") as HTMLElement
    error.hidden = true
    await ventPaTegning()

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
      <fs-field>
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

    const error = document.getElementById("epost-error") as HTMLElement
    error.hidden = true
    await ventPaTegning()

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
      <fs-field>
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
    ;(felt.querySelector(".fs-error-text") as HTMLElement).hidden = true
    await ventPaTegning()

    expect(input.getAttribute("aria-invalid")).toBeNull()
  })

  it("husker hva den skrev på en kontroll som forsvinner og kommer tilbake", async () => {
    document.body.innerHTML = `
      <fs-field>
        <label for="epost">E-post</label>
        <input id="epost" class="fs-input" type="email" />
        <p class="fs-error-text">Feil</p>
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

    ;(felt.querySelector(".fs-error-text") as HTMLElement).hidden = true
    await ventPaTegning()

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
        <p class="fs-error-text" hidden>Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.getAttribute("aria-invalid")).toBe("false")

    // Feilmeldingen vises og skjules igjen. Serverens «false» kommer tilbake.
    error.hidden = false
    await ventPaTegning()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    error.hidden = true
    await ventPaTegning()
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
        <p class="fs-error-text" hidden>Feil</p>
      </fs-field>
    `
    await Promise.resolve()

    const input = document.querySelector("input") as HTMLInputElement
    const error = document.querySelector(".fs-error-text") as HTMLElement
    expect(input.getAttribute("data-state")).toBeNull()

    // Feilmeldingen vises og skjules igjen. Serverens tomme streng kommer
    // tilbake.
    error.hidden = false
    await ventPaTegning()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    error.hidden = true
    await ventPaTegning()
    expect(input.getAttribute("aria-invalid")).toBe("")
    expect(input.getAttribute("data-state")).toBeNull()
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
})

describe("fs-field leser ikke sitt eget ekko fra ledeteksten", () => {
  beforeAll(() => {
    defineFsField()
  })

  async function felt(
    vert: string,
    kontroll = '<input id="navn" class="fs-input" />',
  ) {
    monter(
      `<fs-field ${vert}><label for="navn">Navn</label>${kontroll}</fs-field>`,
    )
    await customElements.whenDefined("fs-field")
    await ventPaTegning()
    return {
      vert: document.querySelector("fs-field") as FsField,
      ledetekst: document.querySelector("label") as HTMLLabelElement,
      kontroll: document.querySelector("input") as HTMLInputElement,
    }
  }

  it("tar bort data-optional når optional fjernes fra verten", async () => {
    const { vert, ledetekst } = await felt("optional")
    expect(ledetekst.hasAttribute("data-optional")).toBe(true)

    vert.removeAttribute("optional")
    await ventPaTegning()

    expect(ledetekst.hasAttribute("data-optional")).toBe(false)
  })

  it("lar markeringene serveren skrev på ledeteksten stå", async () => {
    monter(
      `<fs-field><label for="navn" data-required="text">Navn</label><input id="navn" class="fs-input" /></fs-field>`,
    )
    await customElements.whenDefined("fs-field")
    await ventPaTegning()
    const ledetekst = document.querySelector("label") as HTMLLabelElement
    const vert = document.querySelector("fs-field") as FsField

    // En runde til, slik en patch ville utløst.
    vert.setAttribute("described-by", "annet")
    await ventPaTegning()

    expect(ledetekst.getAttribute("data-required")).toBe("text")
  })

  it("fjerner disabled og optional når egenskapen settes til undefined", async () => {
    // Slik React 19 skriver en prop som er borte. `toggleAttribute` med
    // `undefined` veksler, og attributtet kom tilbake.
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

  it("lar en data-state malen skrev for hånd stå", async () => {
    const { kontroll } = await felt(
      "",
      '<input id="navn" class="fs-input" data-state="invalid" />',
    )
    expect(kontroll.getAttribute("data-state")).toBe("invalid")
  })

  it("fjerner fortsatt sin egen data-state når feltet blir gyldig", async () => {
    const { kontroll } = await felt(
      "",
      '<input id="navn" class="fs-input" /><p class="fs-error-text">Feil</p>',
    )
    expect(kontroll.getAttribute("data-state")).toBe("invalid")

    ;(document.querySelector(".fs-error-text") as HTMLElement).hidden = true
    await ventPaTegning()

    expect(kontroll.hasAttribute("data-state")).toBe(false)
  })

  it("kobler bare sine egne deler når et felt står inni et annet", async () => {
    /*
     * Et søkefelt i et sprettoppvindu inni feltet, eller et felt i et felt,
     * er vanlig markup. `querySelector` over hele undertreet fant det
     * innerste feltets kontroll først, og det ytre feltet skrev `for`,
     * `aria-describedby` og `id` på den. Hvert felt skal se bare sine egne.
     */
    document.body.innerHTML = `
      <fs-field id="ytre">
        <label id="ytre-label">Kommune</label>
        <div popover>
          <fs-field id="indre">
            <label id="indre-label">Søk i lista</label>
            <input id="indre-input" class="fs-input" type="search" />
            <p class="fs-help-text" id="indre-help">Skriv minst to bokstaver.</p>
            <p class="fs-error-text" id="indre-error">Ingen treff.</p>
          </fs-field>
        </div>
        <input id="ytre-input" class="fs-input" type="text" />
        <p class="fs-help-text" id="ytre-help">Kommunen du bor i.</p>
      </fs-field>
    `
    await ventPaTegning()

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

  it("regner en feilmelding skjult med en klasse som skjult", async () => {
    // `display: none` fra en klasse, som en hjelpeklasse i appen, er like
    // skjult som `hidden`. Bare inline-stilen ble lest før.
    document.body.innerHTML = `
      <style>.borte { display: none }</style>
      <fs-field>
        <label class="fs-label" for="e">E-post</label>
        <input class="fs-input" id="e">
        <p class="fs-error-text borte">Skriv en gyldig adresse.</p>
      </fs-field>`
    await ventPaTegning()
    const input = document.getElementById("e") as HTMLInputElement
    expect(input.hasAttribute("aria-invalid")).toBe(false)

    ;(document.querySelector(".fs-error-text") as HTMLElement).classList.remove(
      "borte",
    )
    await ventPaTegning()
    expect(input.getAttribute("aria-invalid")).toBe("true")
  })

  it("sier ingenting når ledeteksten står rundt hele elementet", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    document.body.innerHTML = `<label>Navn <fs-field><input class="fs-input" name="navn"></fs-field></label>`
    await ventPaTegning()
    await new Promise((r) => setTimeout(r, 300))
    expect(
      (document.querySelector("input") as HTMLInputElement).labels?.length,
    ).toBe(1)
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })
})
