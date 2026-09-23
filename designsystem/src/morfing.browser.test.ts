/**
 * At en morfing fra serveren ikke river bort det komponenten har satt.
 *
 * Datastar synkroniserer attributter slik, der `r` står i siden og `s` er
 * serverens node:
 *
 * ```js
 * for (let {name: l} of Array.from(r.attributes))
 *   !s.hasAttribute(l) && !o.includes(l) && r.removeAttribute(l)
 * ```
 *
 * `o` er lista fra `data-preserve-attr`, og den leses fra serverens node.
 * Setter en komponent et attributt som ikke står der, forsvinner det ved
 * hver patch. Testen her kjører nøyaktig den løkka mot ekte markup, etter at
 * komponenten har gjort jobben sin, og krever at tilstanden står igjen.
 */

import { beforeEach, describe, expect, it } from "vitest"
import { dialog } from "./components/ramme/dialog/dialog"
import { defineFsDialog } from "./components/ramme/dialog/fs-dialog"
import { FIELD_PRESERVED_ATTRIBUTES } from "./components/ramme/field/field-core"
import { defineFsField } from "./components/ramme/field/fs-field"
import { defineFsPopover } from "./components/ramme/popover/fs-popover"
import { popover } from "./components/ramme/popover/popover"
import { defineFsSuggestion } from "./components/ramme/suggestion/fs-suggestion"
import { suggestion } from "./components/ramme/suggestion/suggestion"
import { defineFsTabs } from "./components/ramme/tabs/fs-tabs"
import { tabs } from "./components/ramme/tabs/tabs"

import "./tokens/tokens.css"

defineFsField()
defineFsSuggestion()
defineFsPopover()
defineFsTabs()
defineFsDialog()

/** Datastars attributtsynkronisering, på ett element. */
function morfElement(live: Element, server: Element): void {
  const bevar = (server.getAttribute("data-preserve-attr") ?? "")
    .split(/\s+/)
    .filter(Boolean)

  for (const { name } of [...live.attributes]) {
    if (!server.hasAttribute(name) && !bevar.includes(name)) {
      live.removeAttribute(name)
    }
  }

  // Bare når verdien faktisk er en annen. En morfing som skriver hvert
  // attributt på nytt ville lukket et åpent `popover` av seg selv, og da
  // hadde testen etterprøvd sin egen skrivemåte framfor morfingen.
  for (const { name, value } of [...server.attributes]) {
    if (!bevar.includes(name) && live.getAttribute(name) !== value) {
      live.setAttribute(name, value)
    }
  }
}

/** Samme, gjennom hele treet. Nodene står i samme rekkefølge. */
function morf(live: Element, markup: string): void {
  const mal = document.createElement("div")
  mal.innerHTML = markup
  const rot = mal.firstElementChild
  if (!rot) throw new Error("Markupen har ingen rot")

  const levende = [live, ...live.querySelectorAll("*")]
  const sendte = [rot, ...rot.querySelectorAll("*")]

  if (levende.length !== sendte.length) {
    throw new Error(
      `Komponenten la til eller fjernet noder: ${levende.length} i siden mot ${sendte.length} fra serveren`,
    )
  }

  for (let i = 0; i < levende.length; i++) {
    // Uten dette kunne en komponent som setter inn en node forskyve hele
    // sammenligningen, og testen ville stilt krav til feil elementer uten å
    // si fra.
    if (levende[i].tagName !== sendte[i].tagName) {
      throw new Error(
        `Nodene står ikke i samme rekkefølge: ${levende[i].tagName} mot ${sendte[i].tagName}`,
      )
    }
    morfElement(levende[i], sendte[i])
  }
}

function monterMarkup(markup: string): HTMLElement {
  document.body.innerHTML = markup
  return document.body.firstElementChild as HTMLElement
}

describe("morfing river ikke bort det komponenten setter", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  /*
   * Markupen er skrevet slik en Go-mal ville gjort det: ingen id-er, ingen
   * kobling. Da er det `<fs-field>` som lager dem, og nettopp de må lista
   * dekke.
   */
  const FELT = `
    <fs-field data-preserve-attr="">
      <label class="fs-label" data-preserve-attr="${FIELD_PRESERVED_ATTRIBUTES.label}">E-post</label>
      <input class="fs-input" data-preserve-attr="${FIELD_PRESERVED_ATTRIBUTES.control}" />
      <p class="fs-help-text" data-preserve-attr="${FIELD_PRESERVED_ATTRIBUTES.help}">Vi sender aldri spam.</p>
      <p class="fs-error-text" data-preserve-attr="${FIELD_PRESERVED_ATTRIBUTES.error}">Skriv en gyldig adresse.</p>
    </fs-field>`

  it("holder feltet koblet gjennom en patch", async () => {
    const felt = monterMarkup(FELT)
    await customElements.whenDefined("fs-field")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    const foer = kontroll.getAttribute("aria-describedby")
    expect(foer, "koblingen fantes ikke engang før patchen").toBeTruthy()

    morf(felt, FELT)

    const etter = kontroll.getAttribute("aria-describedby")
    expect(etter, "koblingen forsvant i patchen").toBe(foer)

    for (const id of (etter ?? "").split(/\s+/).filter(Boolean)) {
      expect(
        document.getElementById(id),
        `aria-describedby peker på «${id}», som ikke finnes etter patchen`,
      ).not.toBeNull()
    }

    const label = felt.querySelector("label") as HTMLLabelElement
    expect(label.htmlFor, "ledeteksten mistet koblingen til feltet").toBe(
      kontroll.id,
    )
  })

  it("kobler feltet på nytt når patchen byttet ut kontrollen", async () => {
    /*
     * Fredningen holder attributtene på en node som blir stående. Bytter
     * patchen ut selve kontrollen, finnes det ingen node å frede, og den nye
     * kommer uten id. Ledeteksten står igjen med sin `for`.
     *
     * Komponenten fant da ingen id, fant opp en ny, og skrev den bare på
     * kontrollen. `for` pekte etter det på et element som ikke fantes, og
     * ledeteksten var ikke lenger knyttet til feltet. Det ble funnet i
     * spilldemoen, i appen som sender HTML-biter fra en Kotlin-server, og
     * det holdt seg helt til siden ble lastet på nytt.
     */
    const felt = monterMarkup(FELT)
    await customElements.whenDefined("fs-field")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const label = felt.querySelector("label") as HTMLLabelElement
    const foer = label.htmlFor
    expect(foer, "koblingen fantes ikke engang før patchen").toBeTruthy()

    const gammel = felt.querySelector("input") as HTMLInputElement
    const ny = document.createElement("input")
    ny.className = "fs-input"
    ny.setAttribute("data-preserve-attr", FIELD_PRESERVED_ATTRIBUTES.control)
    gammel.replaceWith(ny)

    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    expect(kontroll.id, "kontrollen fikk ingen id").toBeTruthy()
    expect(label.htmlFor, "ledeteksten peker på en id som ikke finnes").toBe(
      kontroll.id,
    )
    expect(document.getElementById(label.htmlFor)).toBe(kontroll)
  })

  /*
   * Dialogen er serverens. `open` er derfor ikke fredet, i motsetning til på
   * sprettoppvinduet: hadde det vært det, kunne serveren aldri åpnet
   * dialogen igjen etter at brukeren hadde lukket den én gang.
   */
  it("lar serveren åpne en dialog brukeren har lukket", async () => {
    const boks = dialog({ titleId: "tittel", open: true })
    const MARKUP = `
      <fs-dialog ${attr(boks.host)}>
        <dialog ${attr(boks.dialog)}>
          <h2 ${attr(boks.title)}>Vedtaket er registrert</h2>
          <div ${attr(boks.body)}><p>Saken er ferdigbehandlet.</p></div>
        </dialog>
      </fs-dialog>`

    const vert = monterMarkup(MARKUP)
    await customElements.whenDefined("fs-dialog")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const d = vert.querySelector("dialog") as HTMLDialogElement
    expect(d.open, "dialogen åpnet seg ikke i det hele tatt").toBe(true)

    d.close()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    expect(vert.hasAttribute("open")).toBe(false)

    morf(vert, MARKUP)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(d.open, "patchen fikk ikke åpnet dialogen igjen").toBe(true)
    d.close()
  })

  /*
   * Og det `data-preserve-attr` på selve `<dialog>` finnes for: nettleseren
   * setter `open` der når `showModal()` kalles.
   *
   * Serveren skriver riktignok `open` selv når den vet at dialogen skal
   * vises, men den vet det ikke alltid. Åpnes dialogen av et signal i
   * nettleseren, eller av en bruker, står `open` bare i den levende siden,
   * og da er det bare fredningen som holder det der. Prøven sender derfor
   * serverens `<dialog>` **uten** `open`. Gjorde den ikke det, hadde
   * morfingen latt attributtet stå uansett, siden den bare fjerner det
   * serverens node mangler, og prøven kunne ikke feile.
   */
  it("lukker ikke en åpen dialog i en patch", async () => {
    const boks = dialog({ titleId: "tittel", open: true })
    const { open: _serverensOpen, ...dialogUtenOpen } = boks.dialog
    const MARKUP = `
      <fs-dialog ${attr(boks.host)}>
        <dialog ${attr(dialogUtenOpen)}>
          <h2 ${attr(boks.title)}>Vedtaket er registrert</h2>
          <div ${attr(boks.body)}><p>Saken er ferdigbehandlet.</p></div>
        </dialog>
      </fs-dialog>`

    const vert = monterMarkup(MARKUP)
    await customElements.whenDefined("fs-dialog")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const d = vert.querySelector("dialog") as HTMLDialogElement
    expect(d.matches(":modal"), "dialogen åpnet seg ikke modalt").toBe(true)

    // Serveren patcher området mens dialogen står åpen, for eksempel fordi
    // poengtavla ved siden av har endret seg.
    morf(vert, MARKUP)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    // `open` og `:modal` er ikke det samme her heller: fjernes attributtet
    // fra en modal dialog, forsvinner den fra skjermen mens `:modal`
    // fortsatt er sann. Det er attributtet som må stå igjen.
    expect(d.open, "patchen rev bort open og skjulte dialogen").toBe(true)
    expect(d.matches(":modal")).toBe(true)
    d.close()
  })

  /*
   * Forslagsfeltet skjuler «Ingen treff» når noe passer. Det gjør det med
   * `hidden`, og serveren sender ikke den tilstanden, for den følger av hva
   * brukeren har skrevet.
   */
  const FORSLAG = suggestion({ id: "kommune", count: 2 })
  const attr = (verdier: Record<string, unknown>) =>
    Object.entries(verdier)
      .map(([navn, verdi]) => (verdi === true ? navn : `${navn}="${verdi}"`))
      .join(" ")

  const FELT_MED_FORSLAG = `
    <fs-suggestion>
      <label ${attr(FORSLAG.label)}>Kommune</label>
      <div ${attr(FORSLAG.field)}>
        <input ${attr(FORSLAG.control)} name="kommune">
        <ul ${attr(FORSLAG.list)}>
          <li ${attr(FORSLAG.options[0])}>Bergen</li>
          <li ${attr(FORSLAG.options[1])}>Bodø</li>
        </ul>
        <p ${attr(FORSLAG.empty)}>Ingen treff</p>
        <span ${attr(FORSLAG.status)}></span>
      </div>
    </fs-suggestion>`

  it("lar «Ingen treff» bli skjult gjennom en patch", async () => {
    const felt = monterMarkup(FELT_MED_FORSLAG)
    await customElements.whenDefined("fs-suggestion")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    kontroll.value = "Be"
    kontroll.dispatchEvent(new Event("input", { bubbles: true }))

    const tom = felt.querySelector(".fs-suggestion__empty") as HTMLElement
    expect(tom.hidden, "«Ingen treff» sto framme selv om Bergen passet").toBe(
      true,
    )

    morf(felt, FELT_MED_FORSLAG)

    expect(tom.hidden, "«Ingen treff» dukket opp igjen i patchen").toBe(true)
  })

  /*
   * Fanene bærer valget i `aria-selected` og `tabindex` på knappene, og i
   * `hidden` på panelene. Ingen av delene finnes i serverens utgave, for
   * valget er noe brukeren har gjort.
   */
  const FANER = tabs({ id: "sak", count: 2 })

  const FANEMARKUP = `
    <fs-tabs>
      <div ${attr(FANER.list)}>
        <button ${attr(FANER.tabs[0])}>Oversikt</button>
        <button ${attr(FANER.tabs[1])}>Vedlegg</button>
      </div>
      <div ${attr(FANER.panels[0])}>Sammendrag</div>
      <div ${attr(FANER.panels[1])}>Filer</div>
    </fs-tabs>`

  it("holder på hvilken fane som er valgt gjennom en patch", async () => {
    const felt = monterMarkup(FANEMARKUP)
    await customElements.whenDefined("fs-tabs")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const knapper = [...felt.querySelectorAll("[role='tab']")] as HTMLElement[]
    const paneler = [
      ...felt.querySelectorAll("[role='tabpanel']"),
    ] as HTMLElement[]

    knapper[1].click()
    expect(knapper[1].getAttribute("aria-selected")).toBe("true")

    morf(felt, FANEMARKUP)

    expect(
      knapper[1].getAttribute("aria-selected"),
      "den valgte fanen ble den første igjen",
    ).toBe("true")
    expect(knapper[1].tabIndex, "tabbestoppet fulgte ikke med").toBe(0)
    expect(paneler[1].hidden, "panelet til den valgte fanen ble skjult").toBe(
      false,
    )
    expect(paneler[0].hidden).toBe(true)
  })

  /*
   * Sprettoppvinduet bærer tilstanden på verten, og posisjonen i `style` på
   * panelet. Patchen må utløses fra noe inne i vinduet; et klikk utenfor
   * lukker det, og da etterprøver man sin egen klikking.
   */
  const SPRETT = popover({ id: "meny" })

  const SPRETTMARKUP = `
    <fs-popover ${attr(SPRETT.host)}>
      <button ${attr(SPRETT.trigger)}>Handlinger</button>
      <ul ${attr(SPRETT.panel)}><li>Arkiver</li></ul>
    </fs-popover>`

  it("holder sprettoppvinduet åpent gjennom en patch", async () => {
    const felt = monterMarkup(SPRETTMARKUP)
    await customElements.whenDefined("fs-popover")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const knapp = felt.querySelector("button") as HTMLButtonElement
    const panel = felt.querySelector("ul") as HTMLElement

    knapp.click()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    expect(panel.matches(":popover-open"), "vinduet åpnet seg ikke").toBe(true)

    morf(felt, SPRETTMARKUP)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(felt.hasAttribute("open"), "verten mistet tilstanden sin").toBe(true)
    expect(
      knapp.getAttribute("aria-expanded"),
      "knappen meldte lukket til skjermleseren",
    ).toBe("true")
    expect(panel.matches(":popover-open"), "vinduet lukket seg i patchen").toBe(
      true,
    )
  })
})
