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
   * kobling, og ingen `data-preserve-attr`.
   *
   * Koblingen mellom ledetekst, felt og hjelpetekst er noe komponenten
   * regner ut, ikke noe serveren sendte, så morfingen river den bort.
   * Løsningen var lenge at malen måtte liste opp attributtene i
   * `data-preserve-attr`, og en Go- eller Kotlin-mal måtte skrive lista av
   * fra dokumentasjonen. Endret Fristil hva komponenten setter, gikk malen
   * stille i stykker. Komponenten ser nå at attributtene er borte og setter
   * dem tilbake.
   */
  const FELT = `
    <fs-field>
      <label class="fs-label">E-post</label>
      <input class="fs-input" />
      <p class="fs-help-text">Vi sender aldri spam.</p>
      <p class="fs-error-text">Skriv en gyldig adresse.</p>
    </fs-field>`

  it("holder feltet koblet gjennom en patch, uten en bevaringsliste", async () => {
    const felt = monterMarkup(FELT)
    await customElements.whenDefined("fs-field")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    const label = felt.querySelector("label") as HTMLLabelElement
    const foer = kontroll.getAttribute("aria-describedby")
    expect(foer, "koblingen fantes ikke engang før patchen").toBeTruthy()
    expect(label.htmlFor).toBe(kontroll.id)

    morf(felt, FELT)
    // Reparasjonen skjer i en observatør, altså i neste omgang av løkka.
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const etter = kontroll.getAttribute("aria-describedby")
    expect(etter, "koblingen kom ikke tilbake etter patchen").toBe(foer)

    for (const id of (etter ?? "").split(/\s+/).filter(Boolean)) {
      expect(
        document.getElementById(id),
        `aria-describedby peker på «${id}», som ikke finnes etter patchen`,
      ).not.toBeNull()
    }

    expect(label.htmlFor, "ledeteksten mistet koblingen til feltet").toBe(
      kontroll.id,
    )
    expect(document.getElementById(label.htmlFor)).toBe(kontroll)
    expect(label.classList.contains("fs-label")).toBe(true)
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
   * og da er det bare fredningen som holder det der. Testen sender derfor
   * serverens `<dialog>` **uten** `open`. Gjorde den ikke det, hadde
   * morfingen latt attributtet stå uansett, siden den bare fjerner det
   * serverens node mangler, og testen kunne ikke feile.
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

  it("holder forslagslista åpen og markeringen gjennom en patch", async () => {
    /*
     * Alt brukeren har gjort i et forslagsfelt er komponentens eget: at lista
     * er utvidet, hva filtreringen skjuler, og hvilket alternativ hun har
     * blitt med piltastene. Ingenting av det står i serverens utgave, og
     * ingenting er fredet. Morfingen river det bort, og komponenten setter
     * det tilbake.
     */
    const felt = monterMarkup(FELT_MED_FORSLAG)
    await customElements.whenDefined("fs-suggestion")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    kontroll.focus()
    kontroll.dispatchEvent(new Event("input", { bubbles: true }))
    kontroll.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )

    expect(liste.hidden, "lista åpnet seg ikke").toBe(false)
    expect(kontroll.getAttribute("aria-expanded")).toBe("true")
    expect(valg[0].getAttribute("aria-selected")).toBe("true")

    morf(felt, FELT_MED_FORSLAG)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(liste.hidden, "lista lukket seg i patchen").toBe(false)
    expect(
      kontroll.getAttribute("aria-expanded"),
      "skjermleseren fikk beskjed om at lista var lukket mens den sto framme",
    ).toBe("true")
    expect(
      valg[0].getAttribute("aria-selected"),
      "markeringen forsvant i patchen",
    ).toBe("true")
    expect(kontroll.getAttribute("aria-activedescendant")).toBe(valg[0].id)
  })

  it("lar serveren styre forslagslista når den sier at den eier den", async () => {
    const SERVERENS = FELT_MED_FORSLAG.replace(
      "<fs-suggestion>",
      "<fs-suggestion server-controlled>",
    )
    const felt = monterMarkup(SERVERENS)
    await customElements.whenDefined("fs-suggestion")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    kontroll.focus()
    kontroll.dispatchEvent(new Event("input", { bubbles: true }))
    expect(liste.hidden).toBe(false)

    morf(felt, SERVERENS)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(
      liste.hidden,
      "serveren sa at den eier lista, men komponenten åpnet den igjen",
    ).toBe(true)
  })

  it("glemmer markeringen når serveren sender en helt ny liste", async () => {
    /*
     * Id-ene fra `fs.suggestion()` er posisjonelle, så en ny liste gjenbruker
     * dem. Husket komponenten bare id-en, satte den markeringen tilbake på
     * alternativ nummer to i en helt annen liste, og skjermleseren leste opp
     * en kommune brukeren aldri navigerte til. Teksten er identiteten.
     */
    const felt = monterMarkup(FELT_MED_FORSLAG)
    await customElements.whenDefined("fs-suggestion")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const kontroll = felt.querySelector("input") as HTMLInputElement
    kontroll.focus()
    kontroll.dispatchEvent(new Event("input", { bubbles: true }))
    kontroll.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    kontroll.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )

    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]
    expect(valg[1].getAttribute("aria-selected")).toBe("true")

    /*
     * `morf()` her etterligner Datastars attributtsynkronisering, og en ekte
     * patch bytter også teksten. Den delen settes derfor for hånd, slik at
     * lista faktisk blir en annen liste og ikke bare de samme navnene med
     * nye attributter.
     */
    const NY_LISTE = FELT_MED_FORSLAG.replace(">Bergen<", ">Alta<").replace(
      ">Bodø<",
      ">Asker<",
    )
    valg[0].textContent = "Alta"
    valg[1].textContent = "Asker"
    morf(felt, NY_LISTE)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const etter = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]
    expect(
      etter.map((o) => o.getAttribute("aria-selected")),
      "markeringen ble satt på et alternativ brukeren aldri navigerte til",
    ).toEqual(["false", "false"])
    expect(kontroll.hasAttribute("aria-activedescendant")).toBe(false)
  })

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
   * valget er noe brukeren har gjort, og ingen av dem er fredet: byggeren
   * skriver ingen `data-preserve-attr`. Morfingen river dem altså bort, og
   * komponenten setter dem tilbake.
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
    // Reparasjonen skjer i en observatør, altså i neste omgang av løkka.
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

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

  it("lar brukeren bytte fane i markup uten id-er", async () => {
    /*
     * Håndskrevet markup fra en Go- eller Kotlin-mal har ofte ingen id-er på
     * fanene, og det er lovlig: `aria-controls` er ikke et krav.
     *
     * Husket komponenten valget som en id, ble den tomme strengen en
     * identitet som traff den første fanen, og reparasjonen satte valget
     * tilbake i neste mikrooppgave. Brukeren fikk da ikke byttet fane i det
     * hele tatt, og ingenting sa fra.
     */
    const UTEN_IDER = `
      <fs-tabs>
        <div class="fs-tabs__list" role="tablist">
          <button role="tab" aria-selected="true" tabindex="0">Oversikt</button>
          <button role="tab" aria-selected="false" tabindex="-1">Vedlegg</button>
        </div>
        <div class="fs-tabs__panel" role="tabpanel" tabindex="0">Sammendrag</div>
        <div class="fs-tabs__panel" role="tabpanel" tabindex="0" hidden>Filer</div>
      </fs-tabs>`

    const felt = monterMarkup(UTEN_IDER)
    await customElements.whenDefined("fs-tabs")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const knapper = [...felt.querySelectorAll("[role='tab']")] as HTMLElement[]
    const paneler = [
      ...felt.querySelectorAll("[role='tabpanel']"),
    ] as HTMLElement[]

    knapper[1].click()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(
      knapper[1].getAttribute("aria-selected"),
      "valget hoppet tilbake til den første fanen",
    ).toBe("true")
    expect(paneler[1].hidden).toBe(false)

    morf(felt, UTEN_IDER)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(knapper[1].getAttribute("aria-selected")).toBe("true")
    expect(paneler[1].hidden).toBe(false)
  })

  it("lar fanene stå i takt når patchen fjerner den valgte", async () => {
    /*
     * Serveren kan sende en kortere rad. Komponenten glemmer da valget, for
     * fanen finnes ikke lenger, men markupen må henge sammen etterpå.
     *
     * Uten opprydningen sto raden igjen uten en eneste `aria-selected="true"`,
     * med alle panelene skjult, og et klikk på den ene fanen som var igjen
     * gjorde ingenting: `select(0)` sammenlignet mot en `selected` som svarer
     * 0 også når ingenting er markert. Brukeren fikk en fanerad som ikke
     * svarte.
     */
    const felt = monterMarkup(FANEMARKUP)
    await customElements.whenDefined("fs-tabs")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const knapper = [...felt.querySelectorAll("[role='tab']")] as HTMLElement[]
    knapper[1].click()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    expect(knapper[1].getAttribute("aria-selected")).toBe("true")

    const meldte: number[] = []
    felt.addEventListener("tab-select", (e) =>
      meldte.push((e as CustomEvent<{ index: number }>).detail.index),
    )

    // Patchen fjerner fanen brukeren valgte, og panelet dens.
    knapper[1].remove()
    ;(felt.querySelectorAll("[role='tabpanel']")[1] as HTMLElement).remove()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const igjen = [...felt.querySelectorAll("[role='tab']")] as HTMLElement[]
    const paneler = [
      ...felt.querySelectorAll("[role='tabpanel']"),
    ] as HTMLElement[]

    expect(
      igjen.map((k) => k.getAttribute("aria-selected")),
      "ingen fane var markert etter patchen",
    ).toEqual(["true"])
    expect(
      meldte,
      "opprydningen tok et nytt valg uten å si fra, så en app som laster panelinnhold fikk aldri vite det",
    ).toContain(0)
    expect(paneler[0].hidden, "ingen paneler var synlige etter patchen").toBe(
      false,
    )
  })

  it("lar serveren flytte fanen når den sier at den eier valget", async () => {
    /*
     * Det fredningen ga, og som reparasjonen måtte erstatte.
     *
     * «Gå videre til steg 2» er en ekte ting en server vil kunne gjøre. Med
     * `data-preserve-attr` kunne den aldri det: lista gjaldt begge veier.
     * `server-controlled` sier at serveren eier valget, og da bestemmer hver
     * patch.
     */
    const SERVERENS = FANEMARKUP.replace(
      "<fs-tabs>",
      "<fs-tabs server-controlled>",
    )
    const felt = monterMarkup(SERVERENS)
    await customElements.whenDefined("fs-tabs")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    const knapper = [...felt.querySelectorAll("[role='tab']")] as HTMLElement[]
    knapper[1].click()
    expect(knapper[1].getAttribute("aria-selected")).toBe("true")

    morf(felt, SERVERENS)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(
      knapper[0].getAttribute("aria-selected"),
      "serveren sa at den eier valget, men komponenten satte det tilbake",
    ).toBe("true")
    expect(knapper[1].getAttribute("aria-selected")).toBe("false")
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

  it("lar serveren lukke sprettoppvinduet når den sier at den eier det", async () => {
    const SERVERENS = SPRETTMARKUP.replace(
      "<fs-popover ",
      "<fs-popover server-controlled ",
    )
    const vindu = monterMarkup(SERVERENS) as HTMLElement & { show(): void }
    await customElements.whenDefined("fs-popover")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    vindu.show()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    expect(vindu.hasAttribute("open")).toBe(true)

    morf(vindu, SERVERENS)
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(
      vindu.hasAttribute("open"),
      "serveren sa at den eier vinduet, men komponenten åpnet det igjen",
    ).toBe(false)
  })

  it("lar en app lukke sprettoppvinduet med egenskapen", async () => {
    /*
     * Reparasjonen må ikke stå i veien for en app som styrer vinduet selv.
     * Første utgave husket bare «brukeren åpnet det», og satte da `open`
     * rett tilbake når appen fjernet det. Datastar-eksempelet i
     * dokumentasjonen lukker menyen fra en handling inne i panelet, og den
     * ble stående åpen.
     */
    const vindu = monterMarkup(SPRETTMARKUP) as HTMLElement & {
      show(): void
      open: boolean
    }
    await customElements.whenDefined("fs-popover")
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    vindu.show()
    await new Promise((ferdig) => requestAnimationFrame(ferdig))
    expect(vindu.hasAttribute("open")).toBe(true)

    vindu.open = false
    await new Promise((ferdig) => requestAnimationFrame(ferdig))

    expect(vindu.hasAttribute("open"), "vinduet lot seg ikke lukke").toBe(false)
    const panel = vindu.querySelector("[popover]") as HTMLElement
    expect(panel.matches(":popover-open")).toBe(false)
  })
})
