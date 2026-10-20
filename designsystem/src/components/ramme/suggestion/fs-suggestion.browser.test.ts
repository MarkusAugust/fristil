/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineFsSuggestion, type FsSuggestion } from "./fs-suggestion"
import { suggestion } from "./suggestion"

import "../../../tokens/tokens.css"
import "./suggestion.css"
import "../../css/sr-only/sr-only.css"

const KOMMUNER = ["Bergen", "Bodø", "Oslo", "Tromsø"]

/** Markupen serveren sender. Feltet og lista finnes før skriptet har kjørt. */
const FORSLAG = suggestion({
  id: "kommune",
  count: KOMMUNER.length,
  help: true,
})

async function tegn() {
  await customElements.whenDefined("fs-suggestion")
  await ventPaTegning()
  return document.querySelector("fs-suggestion") as FsSuggestion
}

function skriv(felt: FsSuggestion, tekst: string) {
  const input = felt.querySelector("input") as HTMLInputElement
  input.value = tekst
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("fs-suggestion", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(async () => {
    monter(`
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(FORSLAG.empty)} hidden>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
        <p class="fs-help-text" ${attr(FORSLAG.help)}>Begynn å skrive</p>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("er et ekte felt før skriptet har kjørt", () => {
    // Komponenten rendret tidligere hele feltet selv. Da fantes det ikke noe
    // å fylle ut, og ingenting ble med i innsendingen.
    const input = document.querySelector("input") as HTMLInputElement
    const label = document.querySelector("label") as HTMLLabelElement

    expect(input.name).toBe("kommune")
    expect(label.htmlFor).toBe(input.id)
    expect(input.getAttribute("role")).toBe("combobox")
    expect(input.getAttribute("aria-autocomplete")).toBe("list")
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(document.querySelectorAll("[role='option']")).toHaveLength(4)
  })

  it("ber ikke malen frede noe", () => {
    // Det lista viser og hva som er markert er brukerens, og komponenten
    // setter det tilbake selv etter en patch. Kommer `data-preserve-attr`
    // tilbake her, har noen gjenopptatt kontrakten malen måtte skrive av fra
    // dokumentasjonen.
    const input = document.querySelector("input") as HTMLInputElement
    const liste = document.querySelector("[role='listbox']") as HTMLElement
    const valg = document.querySelectorAll("[role='option']")

    expect(input.hasAttribute("data-preserve-attr")).toBe(false)
    expect(liste.hasAttribute("data-preserve-attr")).toBe(false)
    for (const v of valg)
      expect(v.hasAttribute("data-preserve-attr")).toBe(false)
  })

  it("snevrer inn forslagene mens brukeren skriver", async () => {
    const felt = await tegn()
    skriv(felt, "bo")
    await tegn()

    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)

    expect(synlige.map((o) => o.textContent?.trim())).toEqual(["Bodø"])
  })

  it("melder antall treff til skjermlesere", async () => {
    const felt = await tegn()
    skriv(felt, "bod")
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("Ett treff")
  })

  it("flytter markeringen med piltastene og peker på den med aria", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await tegn()

    const aktiv = felt.querySelector("[aria-selected='true']") as HTMLElement
    expect(aktiv.textContent?.trim()).toBe("Bergen")
    // Fokus blir i feltet. aria-activedescendant er det som gjør at
    // skjermleseren likevel leser opp alternativet.
    expect(input.getAttribute("aria-activedescendant")).toBe(aktiv.id)
  })

  it("velger med Enter og melder fra", async () => {
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

  it("sier fra når ingenting passer", async () => {
    const felt = await tegn()
    skriv(felt, "xyz")
    await tegn()

    const tom = felt.querySelector(".fs-suggestion__empty") as HTMLElement
    expect(tom.hidden).toBe(false)
    expect(
      (felt.querySelector("[role='status']") as HTMLElement).textContent,
    ).toBe("Ingen treff")
  })

  it("lukker lista på Escape", async () => {
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

  it("filtrerer ikke når noen andre alt har gjort det", async () => {
    const felt = await tegn()
    felt.setAttribute("prefiltered", "")
    skriv(felt, "xyz")
    await tegn()

    // Serveren eller React har alt bestemt hva som vises. Da skal komponenten
    // holde fingrene av fatet.
    const synlige = [
      ...felt.querySelectorAll<HTMLElement>("[role='option']"),
    ].filter((o) => !o.hidden)
    expect(synlige).toHaveLength(4)
  })

  it("kan settes som egenskap, slik React 19 gjør det", async () => {
    /*
     * React skriver egenskapen framfor attributtet når en web
     * component har en med det navnet. Med bare en getter kastet skrivingen
     * «Cannot set property», attributtet landet aldri, og komponenten skjulte
     * det React nettopp hadde rendret.
     */
    const felt = await tegn()

    felt.prefiltered = true
    expect(felt.hasAttribute("prefiltered")).toBe(true)

    felt.prefiltered = false
    expect(felt.hasAttribute("prefiltered")).toBe(false)
  })

  it("melder antall treff når den som filtrerte har rendret lista", async () => {
    /*
     * Beskjeden følger lista, ikke tastetrykket. `prefiltered` slår av
     * skjulingen, ikke opplesningen: første utgave returnerte med en gang, og
     * da satt en Datastar-app igjen uten beskjed om hvor mange treff som var
     * igjen. Det sto ikke noe sted, og den som ikke ser skjermen merket det.
     */
    const felt = await tegn()
    felt.prefiltered = true
    const status = felt.querySelector("[role='status']") as HTMLElement

    skriv(felt, "b")
    await tegn()
    expect(
      status.textContent,
      "leste opp et antall før den som filtrerte hadde svart",
    ).toBe("")

    // Slik en server eller React ville gjort det: alt utenom ett skjules.
    const valg = [...felt.querySelectorAll<HTMLElement>("[role='option']")]
    for (const [i, alternativ] of valg.entries()) alternativ.hidden = i !== 0
    await tegn()

    expect(status.textContent).toBe("Ett treff")
  })

  it("lar tommeldingen være i fred når noen andre filtrerte", async () => {
    /*
     * Tommeldingen er en del av det lista viser, og det bestemmer den som
     * filtrerte. Komponenten kan ikke se forskjell på «søket ga ingenting» og
     * «svaret er ikke kommet ennå», og satte derfor meldingen synlig igjen
     * midt i et asynkront søk, uten at det fantes en vei utenom.
     */
    const felt = await tegn()
    felt.prefiltered = true
    const tom = felt.querySelector(".fs-suggestion__empty") as HTMLElement

    // Appen venter på svar: ingen alternativer, og meldingen holdes skjult.
    for (const alternativ of felt.querySelectorAll("[role='option']"))
      alternativ.remove()
    skriv(felt, "xyz")
    await tegn()
    expect(tom.hidden, "komponenten viste «Ingen treff» selv").toBe(true)

    // Appen svarer med at ingenting passet, og viser meldingen selv.
    tom.hidden = false
    skriv(felt, "xyzæ")
    await tegn()
    expect(tom.hidden, "komponenten skjulte appens «Ingen treff»").toBe(false)
  })

  it("har ingen tilgjengelighetsbrudd med lista åpen", async () => {
    const felt = await tegn()
    skriv(felt, "o")
    await tegn()

    await forventIngenTilgjengelighetsbrudd()
  })
})

/**
 * Et prefiltrert felt som ennå ikke har fått noe å vise.
 *
 * Dette er markupen fra Datastar-fanen i dokumentasjonen: lista er tom til
 * serveren har sendt noe. Talte komponenten ved fokus, meldte feltet «Ingen
 * treff» før brukeren hadde skrevet et tegn, altså til nettopp den som ikke
 * ser skjermen, og tommeldingen sto synlig på et felt ingen hadde søkt i.
 */
describe("fs-suggestion som venter på det første svaret", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(async () => {
    const tomt = suggestion({ id: "kommune", count: 0 })

    monter(`
      <fs-suggestion prefiltered>
        <label ${attr(tomt.label)}>Kommune</label>
        <div>
          <input ${attr(tomt.control)} name="kommune">
          <ul ${attr(tomt.list)}></ul>
          <p ${attr(tomt.empty)}>Ingen treff</p>
          <span ${attr(tomt.status)}></span>
        </div>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("sier ingenting ved fokus", async () => {
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement

    input.dispatchEvent(new FocusEvent("focus"))
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("")
    // Byggefunksjonen skriver ikke `hidden` på en tom liste lenger. Det
    // som holder meldingen borte er at en tom liste under et tomt felt
    // ikke åpnes, og at stilarket skjuler meldingen etter en lukket liste.
    const liste = felt.querySelector("ul") as HTMLElement
    const tom = felt.querySelector(".fs-suggestion__empty") as HTMLElement
    expect(liste.hidden, "en tom liste åpnet seg ved fokus").toBe(true)
    expect(
      getComputedStyle(tom).display,
      "viste «Ingen treff» før noen hadde søkt",
    ).toBe("none")
  })

  it("melder fra når serveren har sendt lista", async () => {
    const felt = await tegn()
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    // Slik en patch ville gjort det.
    liste.innerHTML = `
      <li class="fs-suggestion__option" id="kommune-option-0" role="option">Bergen</li>
      <li class="fs-suggestion__option" id="kommune-option-1" role="option">Bodø</li>
    `
    await tegn()

    const status = felt.querySelector("[role='status']") as HTMLElement
    expect(status.textContent).toBe("2 treff")
  })
})

/**
 * Serveren kan også bestemme hvilket alternativ som er aktivt.
 *
 * `fs.suggestion({ activeIndex })` skriver `aria-selected="true"` på ett av
 * dem. Holdt komponenten en egen teller ved siden av, ville første piltast
 * hoppe til toppen av lista i stedet for til neste alternativ, og
 * markeringen serveren nettopp sendte var borte.
 */
describe("fs-suggestion med markeringen fra serveren", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(async () => {
    const fra = suggestion({
      id: "kommune",
      count: KOMMUNER.length,
      open: true,
      activeIndex: 2,
    })

    monter(`
      <fs-suggestion>
        <label ${attr(fra.label)}>Kommune</label>
        <div>
          <input ${attr(fra.control)} name="kommune">
          <ul ${attr(fra.list)}>
            ${fra.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(fra.empty)}>Ingen treff</p>
          <span ${attr(fra.status)}></span>
        </div>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("går videre fra det serveren markerte", async () => {
    const felt = document.querySelector("fs-suggestion") as FsSuggestion
    const input = felt.querySelector("input") as HTMLInputElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    expect(valg[2].getAttribute("aria-selected")).toBe("true")

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await ventPaTegning()

    expect(
      valg[3].getAttribute("aria-selected"),
      "piltasten hoppet ikke til alternativet etter det serveren markerte",
    ).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[3].id)
  })
})

describe("fs-suggestion med pil opp", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(async () => {
    monter(`
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n            ")}
          </ul>
          <p ${attr(FORSLAG.empty)}>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </fs-suggestion>
    `)
    await tegn()
  })

  it("åpner lista og går til det siste alternativet", async () => {
    const felt = document.querySelector("fs-suggestion") as FsSuggestion
    const input = felt.querySelector("input") as HTMLInputElement
    const liste = felt.querySelector("[role='listbox']") as HTMLElement
    const valg = [...felt.querySelectorAll("[role='option']")] as HTMLElement[]

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    )
    await ventPaTegning()

    // Uten åpningen pekte aria-activedescendant inn i en liste feltet
    // samtidig meldte som lukket.
    expect(liste.hidden, "lista ble ikke åpnet").toBe(false)
    expect(input.getAttribute("aria-expanded")).toBe("true")

    const siste = valg[valg.length - 1]
    expect(
      siste.getAttribute("aria-selected"),
      "pil opp gikk ikke til det siste alternativet",
    ).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe(siste.id)
  })
})

describe("fs-suggestion lukker og rydder", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  function markup(ekstraVert = "") {
    return `
      <fs-suggestion ${ekstraVert}>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
          </ul>
          <p ${attr(FORSLAG.empty)}>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </fs-suggestion>
      <input id="neste-felt" />
    `
  }

  const tast = (input: HTMLInputElement, key: string) =>
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))

  it("lukker lista når fokus forlater feltet", async () => {
    // Tab gikk videre til neste felt, og lista ble stående over det med
    // `aria-expanded="true"` på et felt som ikke lenger hadde fokus.
    monter(markup())
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

  it("lukker lista når fokus går ut av komponenten via en knapp inni den", async () => {
    // En knapp ved siden av feltet er inne i komponenten, så lista står når
    // fokus går dit. Går fokus videre ut derfra, skal lista lukkes da også.
    monter(`
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <button type="button" id="tom-knapp">Tøm</button>
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
          </ul>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </fs-suggestion>
      <input id="neste-felt" />
    `)
    const felt = await tegn()
    const liste = felt.querySelector("[role='listbox']") as HTMLElement

    ;(felt.querySelector("input") as HTMLInputElement).focus()
    await tegn()
    ;(document.getElementById("tom-knapp") as HTMLElement).focus()
    await tegn()
    expect(liste.hidden, "lista lukket seg for en knapp inni").toBe(false)
    ;(document.getElementById("neste-felt") as HTMLElement).focus()
    await tegn()

    expect(liste.hidden).toBe(true)
  })

  it("holder lista åpen når brukeren klikker i feltet inne i en skyggerot", async () => {
    // Dokumentasjonens forhåndsvisninger ligger i en skyggerot. Lytteren på
    // `document` så `event.target` omdirigert til skyggeverten, regnet
    // klikket som utenfor, og lukket lista i samme klikk som åpnet den.
    const vert = document.createElement("div")
    document.body.append(vert)
    const rot = vert.attachShadow({ mode: "open" })
    rot.innerHTML = markup()
    await customElements.whenDefined("fs-suggestion")
    await ventPaTegning()

    const input = rot.querySelector("input") as HTMLInputElement
    const liste = rot.querySelector("[role='listbox']") as HTMLElement
    input.focus()
    input.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    )
    await ventPaTegning()

    expect(liste.hidden, "lista ble lukket av klikket i feltet").toBe(false)
    vert.remove()
  })

  it("skjuler «Ingen treff» sammen med lista", async () => {
    // Tommeldingen er søsken til lista, ikke barn, så `hidden` på lista
    // skjulte den ikke, og den ble stående under et lukket felt.
    monter(markup())
    const felt = await tegn()
    const input = felt.querySelector("input") as HTMLInputElement
    const tom = felt.querySelector(".fs-suggestion__empty") as HTMLElement

    skriv(felt, "xyz")
    await tegn()
    expect(tom.hidden).toBe(false)

    tast(input, "Escape")
    await tegn()
    expect(tom.hidden).toBe(true)
    expect(getComputedStyle(tom).display).toBe("none")
  })

  it("rydder markeringen når det markerte filtreres bort, også med server-controlled", async () => {
    monter(markup("server-controlled"))
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

  it("finner alternativene på rollen, ikke på klassen", async () => {
    monter(`
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            <li id="egen-0" role="option">Bergen</li>
            <li id="egen-1" role="option">Oslo</li>
          </ul>
          <span ${attr(FORSLAG.status)}></span>
        </div>
      </fs-suggestion>
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

  it("lar et smalere filter i appen stå", async () => {
    /*
     * Appen rendrer bare treffene av et `startsWith`-søk, uten `prefiltered`.
     * Alt den beholder inneholder også søkeordet, så komponentens filter
     * skjuler ingenting av det. Påstanden står i dokumentasjonen, og her.
     */
    const smalt = suggestion({ id: "sted", count: 2 })
    monter(`
      <fs-suggestion>
        <label ${attr(smalt.label)}>Sted</label>
        <div>
          <input ${attr(smalt.control)} value="o">
          <ul ${attr(smalt.list)}>
            <li ${attr(smalt.options[0])}>Oslo</li>
            <li ${attr(smalt.options[1])}>Odda</li>
          </ul>
          <span ${attr(smalt.status)}></span>
        </div>
      </fs-suggestion>
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
    ).toBe("2 treff")
  })
})

describe("fs.suggestion() skriver det komponenten ellers ville skrevet", () => {
  it("skriver hidden på tommeldingen når det finnes treff eller svaret er underveis", () => {
    // At lista er lukket, står ikke her lenger: stilarket skjuler meldingen
    // etter en lukket liste, og «tommeldingen når appen filtrerer selv»
    // etterprøver at den faktisk ikke vises ved sidelasting.
    expect(suggestion({ id: "k", count: 0 }).empty.hidden).toBe(undefined)
    expect(suggestion({ id: "k", count: 0, pending: true }).empty.hidden).toBe(
      true,
    )
    expect(suggestion({ id: "k", count: 2, open: true }).empty.hidden).toBe(
      true,
    )
  })

  it("skriver markeringen bare når lista er åpen, begge halvdelene sammen", () => {
    const lukket = suggestion({ id: "k", count: 3, activeIndex: 1 })
    expect(lukket.options[1]["aria-selected"]).toBe("false")
    expect(lukket.control["aria-activedescendant"]).toBeUndefined()

    const apen = suggestion({ id: "k", count: 3, activeIndex: 1, open: true })
    expect(apen.options[1]["aria-selected"]).toBe("true")
    expect(apen.control["aria-activedescendant"]).toBe("k-option-1")
  })
})

/*
 * Markup skrevet uten JavaScript: ledetekst med `for`, felt med `id`, liste
 * med `<li>` og et statuselement, uten roller eller kobling ellers. `for` og
 * `id` er det HTML krever for at feltet skal ha navn uten JavaScript, og
 * komponenten skriver aldri id på feltet. Den fyller inn resten.
 * Statuselementet må skrives: det er innhold serveren sender.
 */
const BAR = `
  <fs-suggestion>
    <label for="kommune">Kommune</label>
    <div>
      <input class="fs-input" id="kommune" name="kommune">
      <ul class="fs-suggestion__list">
        ${KOMMUNER.map((k) => `<li>${k}</li>`).join("")}
      </ul>
      <p class="fs-suggestion__empty" hidden>Ingen treff</p>
      <span class="fs-sr-only" role="status"></span>
    </div>
  </fs-suggestion>`

describe("fs-suggestion kobler fra bar struktur", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  function deler() {
    return {
      felt: document.querySelector("fs-suggestion") as FsSuggestion,
      label: document.querySelector("label") as HTMLLabelElement,
      input: document.querySelector("input") as HTMLInputElement,
      liste: document.querySelector("ul") as HTMLElement,
      valg: [...document.querySelectorAll<HTMLElement>("li")],
    }
  }

  it("setter roller, id-er og kobling, og holder lista lukket", async () => {
    monter(BAR)
    await tegn()
    const { felt, label, input, liste, valg } = deler()

    expect(input.getAttribute("role")).toBe("combobox")
    expect(input.getAttribute("autocomplete")).toBe("off")
    expect(input.getAttribute("aria-autocomplete")).toBe("list")
    expect(input.id).toBe("kommune")
    expect(label.htmlFor).toBe("kommune")
    expect(label.classList.contains("fs-label")).toBe(true)
    expect(liste.getAttribute("role")).toBe("listbox")
    expect(liste.id).not.toBe("")
    expect(input.getAttribute("aria-controls")).toBe(liste.id)
    expect(input.getAttribute("aria-expanded")).toBe("false")
    expect(liste.hidden).toBe(true)
    for (const v of valg) {
      expect(v.getAttribute("role")).toBe("option")
      expect(v.id).not.toBe("")
      expect(v.classList.contains("fs-suggestion__option")).toBe(true)
    }

    skriv(felt, "b")
    await ventPaTegning()
    expect(liste.hidden).toBe(false)
    expect(valg.filter((v) => !v.hidden).map((v) => v.textContent)).toEqual([
      "Bergen",
      "Bodø",
    ])
    expect(document.querySelector("[role='status']")?.textContent).toBe(
      "2 treff",
    )

    await forventIngenTilgjengelighetsbrudd()
  })

  it("lar det serveren skrev stå", async () => {
    monter(
      BAR.replace('<label for="kommune">', '<label for="egen">')
        .replace(
          '<input class="fs-input" id="kommune" name="kommune">',
          '<input class="fs-input" name="kommune" id="egen" aria-expanded="true">',
        )
        .replace(
          '<ul class="fs-suggestion__list">',
          '<ul class="fs-suggestion__list" id="egen-liste">',
        ),
    )
    await tegn()
    const { label, input, liste } = deler()

    expect(input.id).toBe("egen")
    expect(label.htmlFor).toBe("egen")
    expect(liste.id).toBe("egen-liste")
    expect(input.getAttribute("aria-controls")).toBe("egen-liste")
    // Serveren sa at lista er åpen, og da står den åpen.
    expect(input.getAttribute("aria-expanded")).toBe("true")
    expect(liste.hidden).toBe(false)
  })

  it("setter koblingen tilbake med de samme id-ene etter en patch", async () => {
    monter(BAR)
    await tegn()
    const { label, input, liste, valg } = deler()
    const ider = [input.id, liste.id, valg[0].id]

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    // Feltets id og ledetekstens `for` sto der, og blir stående.
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
    await ventPaTegning()

    expect([input.id, liste.id, valg[0].id]).toEqual(ider)
    expect(label.htmlFor).toBe(ider[0])
    expect(input.getAttribute("aria-controls")).toBe(ider[1])
    expect(valg[0].getAttribute("role")).toBe("option")
    expect(liste.hidden).toBe(true)
  })

  it("skriver ingenting på markup fra fs.suggestion()", async () => {
    // Den direkte påstanden bak «det serveren skrev står»: null
    // mutasjonsposter fra komponentens første runde.
    const omslag = document.createElement("div")
    omslag.innerHTML = `
      <fs-suggestion>
        <label ${attr(FORSLAG.label)}>Kommune</label>
        <div>
          <input ${attr(FORSLAG.control)} name="kommune">
          <ul ${attr(FORSLAG.list)}>
            ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("")}
          </ul>
          <p ${attr(FORSLAG.empty)} hidden>Ingen treff</p>
          <span ${attr(FORSLAG.status)}></span>
        </div>
        <p class="fs-help-text" ${attr(FORSLAG.help)}>Begynn å skrive</p>
      </fs-suggestion>`
    const vert = omslag.querySelector("fs-suggestion") as HTMLElement
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

describe("tommeldingen når appen filtrerer selv", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  /** Slik en React-app rendrer feltet: bare treffene, og `prefiltered`. */
  async function felt(valg: { count: number; pending?: boolean }) {
    const forslag = suggestion({ id: "kommune", ...valg })
    monter(`
      <fs-suggestion prefiltered>
        <label ${attr(forslag.label)}>Kommune</label>
        <div>
          <input ${attr(forslag.control)} name="kommune">
          <ul ${attr(forslag.list)}>${forslag.options
            .map((valg, i) => `<li ${attr(valg)}>Treff ${i}</li>`)
            .join("")}</ul>
          <p ${attr(forslag.empty)}>Ingen treff</p>
          <span ${attr(forslag.status)}></span>
        </div>
      </fs-suggestion>
    `)
    const vert = await tegn()
    return {
      input: vert.querySelector("input") as HTMLInputElement,
      liste: vert.querySelector("ul") as HTMLElement,
      tom: vert.querySelector(".fs-suggestion__empty") as HTMLElement,
    }
  }

  const synlig = (element: HTMLElement) =>
    getComputedStyle(element).display !== "none"

  it("viser ikke meldingen mens lista er lukket, selv uten treff", async () => {
    // Appen vet ikke om lista er åpen: den tilstanden er komponentens.
    // Stilarket skjuler meldingen etter en liste med `hidden`.
    const { liste, tom } = await felt({ count: 0 })

    expect(liste.hidden).toBe(true)
    expect(tom.hasAttribute("hidden")).toBe(false)
    expect(synlig(tom)).toBe(false)
  })

  it("viser meldingen når lista åpnes og søket ga ingenting", async () => {
    const { input, liste, tom } = await felt({ count: 0 })

    input.focus()
    input.value = "xyz"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await tegn()

    expect(liste.hidden, "lista åpnet seg ikke").toBe(false)
    expect(synlig(tom)).toBe(true)
  })

  it("holder meldingen skjult mens svaret er underveis", async () => {
    const { input, liste, tom } = await felt({ count: 0, pending: true })

    input.focus()
    input.value = "xyz"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await tegn()

    expect(liste.hidden).toBe(false)
    expect(synlig(tom)).toBe(false)
  })

  it("skjuler meldingen når det finnes treff", async () => {
    const { tom } = await felt({ count: 2 })
    expect(tom.hasAttribute("hidden")).toBe(true)
  })
})

describe("fs-suggestion når en patch bytter ut feltet eller lista", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  it("skriver aldri id på et nytt felt, og gir lista den id-en feltet peker på", async () => {
    /*
     * Komponenten fant før opp en id til et nytt felt uten id. Det var nettopp
     * den id-en som gjorde at neste oppdatering fra serveren byttet ut feltet,
     * med fokus og det brukeren hadde skrevet. Lista har ingen tilstand
     * brukeren mister, og får fortsatt id-en feltet alt peker på.
     */
    monter(`
      <fs-suggestion>
        <label>Kommune
          <input class="fs-input">
        </label>
        <div>
          <ul class="fs-suggestion__list"><li>Oslo</li></ul>
          <p class="fs-suggestion__empty">Ingen treff</p>
          <span class="fs-suggestion__status" role="status"></span>
        </div>
      </fs-suggestion>
    `)
    const vert = await tegn()
    const listepeker = (
      vert.querySelector("input") as HTMLElement
    ).getAttribute("aria-controls")

    const nyttFelt = document.createElement("input")
    nyttFelt.className = "fs-input"
    nyttFelt.setAttribute("aria-controls", listepeker ?? "")
    vert.querySelector("input")?.replaceWith(nyttFelt)
    const nyListe = document.createElement("ul")
    nyListe.className = "fs-suggestion__list"
    nyListe.innerHTML = "<li>Bergen</li>"
    vert.querySelector("ul")?.replaceWith(nyListe)
    await tegn()

    expect(nyttFelt.hasAttribute("id")).toBe(false)
    expect(nyListe.id, "aria-controls peker på ingenting").toBe(listepeker)
  })
})

describe("fs-suggestion leser opp antallet på sidens språk", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  /** Forslagsfeltet på en side med `lang`, og tekstene som attributter. */
  async function felt(lang: string, attributter: string) {
    monter(`
      <div lang="${lang}">
        <fs-suggestion ${attributter}>
          <label ${attr(FORSLAG.label)}>Municipality</label>
          <div>
            <input ${attr(FORSLAG.control)} name="kommune">
            <ul ${attr(FORSLAG.list)}>
              ${FORSLAG.options.map((o, i) => `<li ${attr(o)}>${KOMMUNER[i]}</li>`).join("\n")}
            </ul>
            <span ${attr(FORSLAG.status)}></span>
          </div>
        </fs-suggestion>
      </div>
    `)
    return tegn()
  }

  async function opplest(element: FsSuggestion, tekst: string) {
    skriv(element, tekst)
    await tegn()
    return (element.querySelector("[role='status']") as HTMLElement).textContent
  }

  it("bruker formen språket krever, med tallet satt inn", async () => {
    const element = await felt(
      "en",
      'count-none="No results" count-one="{n} result" count-other="{n} results"',
    )

    expect(await opplest(element, "bod")).toBe("1 result")
    expect(await opplest(element, "o")).toBe("3 results")
    expect(await opplest(element, "xyz")).toBe("No results")
  })

  it("faller tilbake på count-other når en form mangler", async () => {
    // Engelsk har formen `one`. Står bare `count-other`, skal den gjelde
    // også for ett treff, framfor at opplesningen blir norsk.
    const element = await felt("en", 'count-other="{n} results"')

    expect(await opplest(element, "bod")).toBe("1 results")
    expect(await opplest(element, "xyz")).toBe("0 results")
  })

  it("velger bøyningen etter språket, ikke etter tallet alene", async () => {
    // Polsk har fire former. 2, 3 og 4 er `few`, og 1 er `one`.
    const element = await felt(
      "pl",
      'count-one="{n} wynik" count-few="{n} wyniki" count-many="{n} wyników" count-other="{n} wyniku"',
    )

    expect(await opplest(element, "o")).toBe("3 wyniki")
    expect(await opplest(element, "bod")).toBe("1 wynik")
  })

  it("er norsk når ingen tekst er satt", async () => {
    const element = await felt("en", "")

    expect(await opplest(element, "bod")).toBe("Ett treff")
    expect(await opplest(element, "o")).toBe("3 treff")
  })
})

/**
 * Etterligner verdisporingen React legger på et kontrollert felt: en egen
 * `value` på noden som husker siste verdi satt gjennom den, og `onChange`
 * bare når verdien fra prototypen er en annen.
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

describe("fs-suggestion med et felt React styrer", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  for (const kontroll of [
    '<input id="kommune" role="combobox" aria-controls="kommune-liste" aria-expanded="false" aria-autocomplete="list">',
    '<textarea id="kommune" role="combobox" aria-controls="kommune-liste" aria-expanded="false" aria-autocomplete="list"></textarea>',
  ]) {
    it(`gir onChange det valgte (${kontroll.slice(1, 6)})`, async () => {
      // Satt rett på noden så React ingen endring, og skrev den gamle teksten
      // tilbake ved neste rendring.
      monter(`
        <fs-suggestion>
          <label for="kommune">Kommune</label>
          <div>
            ${kontroll}
            <ul class="fs-suggestion__list" role="listbox" id="kommune-liste" hidden>
              <li role="option" id="kommune-0">Bergen</li>
              <li role="option" id="kommune-1">Oslo</li>
            </ul>
          </div>
        </fs-suggestion>`)
      const felt = document.getElementById("kommune") as
        | HTMLInputElement
        | HTMLTextAreaElement
      const endringer = kontrollertAvReact(felt)
      await customElements.whenDefined("fs-suggestion")
      await ventPaTegning()

      felt.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      )
      await ventPaTegning()
      felt.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      )
      await ventPaTegning()

      expect(felt.value).toBe("Bergen")
      expect(endringer).toEqual(["Bergen"])
    })
  }
})

/*
 * Markup slik en mal skriver den når skjemaet skal sende koden: alternativene
 * har `data-value`, og et skjult `.fs-suggestion__value` får koden.
 */
const MED_KODE = `
  <fs-suggestion>
    <label for="kommune">Kommune</label>
    <div>
      <input class="fs-input" id="kommune" name="kommune-tekst">
      <input type="hidden" class="fs-suggestion__value" name="kommune">
      <ul class="fs-suggestion__list">
        <li data-value="4601">Bergen</li>
        <li data-value="1804">Bodø</li>
        <li data-value="0301">Oslo</li>
      </ul>
      <span class="fs-sr-only" role="status"></span>
    </div>
  </fs-suggestion>`

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

describe("fs-suggestion velger riktig", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  function deler() {
    return {
      input: document.getElementById("kommune") as HTMLInputElement,
      kode: document.querySelector(".fs-suggestion__value") as HTMLInputElement,
      liste: document.querySelector("ul") as HTMLElement,
      valg: [...document.querySelectorAll<HTMLElement>("li")],
    }
  }

  it("viser teksten i feltet og legger koden i verdifeltet og hendelsen", async () => {
    monter(MED_KODE)
    const vert = await tegn()
    const { input, kode, valg } = deler()
    const detaljer: unknown[] = []
    vert.addEventListener("suggestion-select", (e) =>
      detaljer.push((e as CustomEvent).detail),
    )

    input.focus()
    valg[0].click()
    await ventPaTegning()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4601")
    expect(detaljer).toEqual([{ value: "4601", label: "Bergen" }])
  })

  it("tømmer verdifeltet når brukeren endrer teksten etter et valg", async () => {
    // Ellers ville skjemaet sendt koden for Bergen med «Bodø» i feltet.
    monter(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()

    input.focus()
    valg[0].click()
    await ventPaTegning()
    input.value = "Berge"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()

    expect(kode.value).toBe("")
  })

  it("setter koden tilbake når en oppdatering tømmer verdifeltet", async () => {
    // Verdifeltets `value` er et attributt, og en morfing skriver serverens
    // tomme verdi over koden brukeren valgte.
    monter(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()

    input.focus()
    valg[2].click()
    await ventPaTegning()
    kode.removeAttribute("value")
    await ventPaTegning()

    expect(input.value).toBe("Oslo")
    expect(kode.value).toBe("0301")
  })

  it("lar en annen kode fra serveren stå", async () => {
    // Bare en tømt verdi settes tilbake. En kode serveren sender, som etter å
    // ha slått opp et tvetydig navn, er serverens ord.
    monter(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()

    input.focus()
    valg[0].click()
    await ventPaTegning()
    kode.setAttribute("value", "4602")
    await ventPaTegning()
    await ventPaTegning()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4602")
  })

  it("sender input og change på verdifeltet når koden skrives og tømmes", async () => {
    // Ellers ser verken `data-bind` i Datastar eller tilstanden i React koden.
    monter(MED_KODE)
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

  it("lukker en åpen liste når feltet blir readonly", async () => {
    // Reparasjonen holdt den åpen, og Escape gjør ingenting i et låst felt.
    monter(MED_KODE)
    await tegn()
    const { input, liste } = deler()
    input.focus()
    tast(input, "ArrowDown")
    await ventPaTegning()
    expect(liste.hidden).toBe(false)

    input.setAttribute("readonly", "")
    await ventPaTegning()
    await ventPaTegning()

    expect(liste.hidden).toBe(true)
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })

  it("velger på click alene, og ikke på mousedown alene", async () => {
    /*
     * Hjelpemidler som aktiverer et element, sender `click`. Valget skjedde
     * før på `mousedown`, og en `click` alene valgte ingenting. `mousedown`
     * holder fortsatt fokus i feltet.
     */
    monter(MED_KODE)
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

  it("hopper over et alternativ med aria-disabled, med tastatur og mus", async () => {
    monter(
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

  it("åpner ikke lista og endrer ikke verdien i et readonly-felt", async () => {
    monter(
      MED_KODE.replace('name="kommune-tekst"', 'name="kommune-tekst" readonly'),
    )
    await tegn()
    const { input, liste, valg } = deler()

    input.focus()
    tast(input, "ArrowDown")
    tast(input, "Enter")
    valg[0].click()
    await ventPaTegning()

    expect(liste.hidden).toBe(true)
    expect(input.value).toBe("")
  })

  it("lar tastene under en IME-komposisjon være", async () => {
    // Enter bekrefter tegnene i komposisjonen, og skal ikke velge noe.
    monter(MED_KODE)
    await tegn()
    const { input } = deler()

    input.focus()
    tast(input, "ArrowDown")
    const enter = tast(input, "Enter", { isComposing: true })

    expect(enter.defaultPrevented).toBe(false)
    expect(input.value).toBe("")
  })

  it("går til første og siste alternativ med PgUp og PgDn, og rører ikke Home og End", async () => {
    monter(MED_KODE)
    await tegn()
    const { input, valg } = deler()

    input.focus()
    tast(input, "ArrowDown")
    tast(input, "PageDown")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[2].id)
    tast(input, "PageUp")
    expect(input.getAttribute("aria-activedescendant")).toBe(valg[0].id)

    // Home og End flytter markøren i teksten. Komponenten tar dem ikke.
    expect(tast(input, "Home").defaultPrevented).toBe(false)
    expect(tast(input, "End").defaultPrevented).toBe(false)
  })

  it("finner det markerte alternativet igjen på teksten når lista byttes ut", async () => {
    // Lista og alternativene får id av komponenten, og en oppdatering som
    // sender lista på nytt bytter dem ut. Markeringen følger teksten.
    monter(MED_KODE)
    await tegn()
    const { input, liste } = deler()
    input.focus()
    tast(input, "ArrowDown")
    tast(input, "ArrowDown")
    await ventPaTegning()
    expect(deler().valg[1].getAttribute("aria-selected")).toBe("true")

    const ny = document.createElement("ul")
    ny.className = "fs-suggestion__list"
    ny.innerHTML = `<li data-value="4601">Bergen</li><li data-value="1804">Bodø</li><li data-value="0301">Oslo</li>`
    liste.replaceWith(ny)
    await ventPaTegning()
    await ventPaTegning()

    const bodoe = [...ny.querySelectorAll("li")].find(
      (li) => li.textContent === "Bodø",
    ) as HTMLElement
    expect(bodoe.getAttribute("aria-selected")).toBe("true")
    expect(bodoe.id).not.toBe("")
    expect(input.getAttribute("aria-activedescendant")).toBe(bodoe.id)
  })

  it("skriver antall treff på nytt når en oppdatering tømmer statuselementet", async () => {
    // Teksten finnes ikke i serverens utgave, så uten dette måtte malen
    // skrive Datastars `data-ignore-morph`, som ikke betyr noe for htmx.
    monter(MED_KODE)
    await tegn()
    const { input } = deler()
    const status = document.querySelector("[role='status']") as HTMLElement
    input.focus()
    input.value = "B"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()
    const lest = status.textContent
    expect(lest).not.toBe("")

    status.textContent = ""
    await ventPaTegning()
    await ventPaTegning()

    expect(status.textContent).toBe(lest)
  })

  it("legger lista rett under feltet også når hjelpeteksten står etter", async () => {
    // Verten er posisjonsboksen. Uten egen `inset-block-start` får lista sin
    // statiske plass, rett etter feltet i flyten, og ikke under hjelpeteksten.
    monter(
      MED_KODE.replace(
        "</fs-suggestion>",
        '<p class="fs-help-text">Vi fyller ut resten av adressen for deg.</p></fs-suggestion>',
      ),
    )
    await tegn()
    const { input, liste } = deler()
    const hjelp = document.querySelector(".fs-help-text") as HTMLElement
    input.focus()
    tast(input, "ArrowDown")
    await ventPaTegning()

    const felt = input.getBoundingClientRect()
    const boks = liste.getBoundingClientRect()
    expect(liste.hidden).toBe(false)
    expect(boks.top).toBeGreaterThanOrEqual(felt.bottom)
    expect(boks.top - felt.bottom).toBeLessThan(12)
    expect(hjelp.getBoundingClientRect().top).toBeLessThan(boks.bottom)
  })

  it("skiller to alternativer med samme tekst på koden når lista byttes ut", async () => {
    monter(
      MED_KODE.replace(
        '<li data-value="0301">Oslo</li>',
        '<li data-value="3018">Våler</li><li data-value="3419">Våler</li>',
      ),
    )
    await tegn()
    const { input, liste } = deler()
    input.focus()
    for (let i = 0; i < 4; i += 1) tast(input, "ArrowDown")
    await ventPaTegning()
    expect(deler().valg[3].getAttribute("aria-selected")).toBe("true")

    const ny = liste.cloneNode(true) as HTMLElement
    for (const li of ny.querySelectorAll("li")) {
      li.removeAttribute("id")
      li.removeAttribute("aria-selected")
    }
    liste.replaceWith(ny)
    await ventPaTegning()
    await ventPaTegning()

    const valgt = ny.querySelector('[aria-selected="true"]') as HTMLElement
    expect(valgt.getAttribute("data-value")).toBe("3419")
  })

  it("setter koden tilbake til serverens når skjemaet tilbakestilles", async () => {
    // Et skjult felt har ingen standardverdi å gå tilbake til, siden koden
    // skrives som attributt. Uten dette sendte skjemaet koden for Bodø med
    // tom tekst etter en tilbakestilling.
    monter(
      `<form>${MED_KODE.replace('name="kommune-tekst"', 'name="kommune-tekst" value="Bergen"').replace('class="fs-suggestion__value" name="kommune"', 'class="fs-suggestion__value" name="kommune" value="4601"')}</form>`,
    )
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[1].click()
    await ventPaTegning()
    expect(input.value).toBe("Bodø")
    expect(kode.value).toBe("1804")

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await ventPaTegning()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4601")

    // Og uten kode fra serveren: tomt.
    monter(`<form>${MED_KODE}</form>`)
    await tegn()
    const andre = deler()
    andre.input.focus()
    andre.valg[0].click()
    await ventPaTegning()
    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await ventPaTegning()
    expect(andre.input.value).toBe("")
    expect(andre.kode.value).toBe("")
  })

  it("skriver for fra feltets id, og sier fra, når ledeteksten pekte et annet sted", async () => {
    // Samme regel som i <fs-field>: `for` og `id` er den samme opplysningen.
    // Men uten JavaScript sto feltet uten ledetekst, så det skal sies fra.
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    monter(MED_KODE.replace('for="kommune"', 'for="feil"'))
    await tegn()
    await new Promise((r) => setTimeout(r, 300))
    expect((document.querySelector("label") as HTMLLabelElement).htmlFor).toBe(
      "kommune",
    )
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0][0])).toContain("pekte på en annen id")
    advarsel.mockRestore()
  })

  it("lar ikke hendelsene på verdifeltet boble til verten", async () => {
    // Oppskriften henter forslag med `data-on:input` på <fs-suggestion>.
    // Fyrte koden den, ble det et søk på «4601» ved hvert valg.
    monter(MED_KODE)
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
    await ventPaTegning()

    expect(paaVerten).toEqual(["kommune-tekst", "kommune-tekst"])
  })

  it("beholder koden ved tilbakestilling når serveren har sendt valget tilbake", async () => {
    // Med htmx sender serveren teksten og koden tilbake. Da er det valgte
    // også skjemaets standardverdi, og en tilbakestilling skal lande der.
    monter(`<form>${MED_KODE}</form>`)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[0].click()
    await ventPaTegning()
    // Serverens svar: begge verdiene som attributter, slik en morfing skriver.
    input.setAttribute("value", "Bergen")
    kode.setAttribute("value", "4601")
    await ventPaTegning()
    await ventPaTegning()

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await ventPaTegning()

    expect(input.value).toBe("Bergen")
    expect(kode.value).toBe("4601")
  })

  it("finner koden fra alternativet når teksten etter tilbakestilling er et annet valg", async () => {
    // Serveren sendte Bodø tilbake etter at brukeren valgte det, og brukeren
    // skrev videre. Tilbakestillingen gir «Bodø», og koden følger alternativet.
    monter(`<form>${MED_KODE}</form>`)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[1].click()
    await ventPaTegning()
    input.setAttribute("value", "Bodø")
    kode.setAttribute("value", "1804")
    await ventPaTegning()
    input.value = "Bod"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()
    expect(kode.value).toBe("")

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await ventPaTegning()

    expect(input.value).toBe("Bodø")
    expect(kode.value).toBe("1804")
  })

  it("skriver ikke antallet tilbake når noen andre filtrerer", async () => {
    // En patch er da svaret på et tastetrykk, og det nye antallet leses
    // opp av `announceFiltered` rett etter. To tall på rad er støy.
    monter(MED_KODE.replace("<fs-suggestion>", "<fs-suggestion prefiltered>"))
    await tegn()
    const { input, liste } = deler()
    const status = document.querySelector("[role='status']") as HTMLElement
    input.focus()
    liste.removeChild(liste.children[2])
    await ventPaTegning()
    await ventPaTegning()
    expect(status.textContent).not.toBe("")

    status.textContent = ""
    await ventPaTegning()
    await ventPaTegning()

    expect(status.textContent).toBe("")
  })

  it("sier ingenting når ledeteksten står rundt hele elementet", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    monter(
      `<label>Kommune <fs-suggestion><input class="fs-input" name="kommune"><ul class="fs-suggestion__list"><li>Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion></label>`,
    )
    await tegn()
    await new Promise((r) => setTimeout(r, 300))
    expect(
      (document.querySelector("input") as HTMLInputElement).labels?.length,
    ).toBe(1)
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })

  it("følger skjemaet når form på feltet peker på et annet", async () => {
    // Lytteren på `reset` hører til skjemaet feltet tilhører nå. `form` på
    // feltet kan peke på et annet skjema uten at noe flyttes, og en patch
    // kan endre det.
    monter(`<form id="a">${MED_KODE}</form><form id="b"></form>`)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[0].click()
    await ventPaTegning()
    expect(kode.value).toBe("4601")

    input.setAttribute("form", "b")
    await ventPaTegning()
    await ventPaTegning()
    input.value = "Berg"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()
    expect(kode.value).toBe("")
    input.value = "Bergen"
    kode.setAttribute("value", "4601")
    await ventPaTegning()
    ;(document.getElementById("b") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await ventPaTegning()

    // Teksten går tilbake til tom, og koden følger.
    expect(input.value).toBe("")
    expect(kode.value).toBe("")
  })

  it("skriver ikke antallet tilbake når lista er lukket", async () => {
    // Hver patch av området ville ellers lest det gamle antallet opp igjen.
    monter(MED_KODE)
    await tegn()
    const { input } = deler()
    const status = document.querySelector("[role='status']") as HTMLElement
    input.focus()
    input.value = "B"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()
    expect(status.textContent).not.toBe("")
    tast(input, "Escape")
    await ventPaTegning()

    status.textContent = ""
    await ventPaTegning()
    await ventPaTegning()

    expect(status.textContent).toBe("")
  })

  it("gir koden tilbake i det brukeren skriver det valgte på nytt", async () => {
    // Etter at en morfing tømte både tekst og kode, som idiomorph gjør uten
    // ignoreActiveValue, skal ikke koden vente på en tilfeldig neste patch.
    monter(MED_KODE)
    await tegn()
    const { input, kode, valg } = deler()
    input.focus()
    valg[0].click()
    await ventPaTegning()
    input.value = ""
    kode.setAttribute("value", "")
    await ventPaTegning()
    await ventPaTegning()
    expect(kode.value).toBe("")

    input.value = "Bergen"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(kode.value).toBe("4601")
  })

  it("sier ingenting om et felt uten id som har navn fra aria-labelledby", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    monter(
      `<fs-suggestion><label id="l">Kommune</label><input class="fs-input" name="kommune" aria-labelledby="l"><ul class="fs-suggestion__list"><li>Bergen</li></ul><span class="fs-sr-only" role="status"></span></fs-suggestion>`,
    )
    await tegn()
    await new Promise((r) => setTimeout(r, 300))
    expect(advarsel).not.toHaveBeenCalled()
    advarsel.mockRestore()
  })

  it("går tilbake til serverens Våler når brukeren hadde valgt det andre", async () => {
    // To alternativer med samme tekst: ved tilbakestilling er teksten
    // serverens, og da gjelder serverens kode, ikke det brukeren valgte.
    monter(
      `<form>${MED_KODE.replace(
        'name="kommune-tekst"',
        'name="kommune-tekst" value="Våler"',
      )
        .replace(
          'class="fs-suggestion__value" name="kommune"',
          'class="fs-suggestion__value" name="kommune" value="3419"',
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
    await ventPaTegning()
    expect(kode.value).toBe("3018")

    ;(document.querySelector("form") as HTMLFormElement).reset()
    await new Promise((r) => setTimeout(r, 20))
    await ventPaTegning()

    expect(input.value).toBe("Våler")
    expect(kode.value).toBe("3419")
  })
})
