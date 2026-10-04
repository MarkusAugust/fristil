/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"

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
        <div ${attr(FORSLAG.field)}>
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
      valgt.push((hendelse as CustomEvent<{ value: string }>).detail.value)
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
     * Tommeldingen er en del av det lista viser, og det eier den som
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
        <div ${attr(tomt.field)}>
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
        <div ${attr(fra.field)}>
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
        <div ${attr(FORSLAG.field)}>
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
        <div ${attr(FORSLAG.field)}>
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
        <div ${attr(FORSLAG.field)}>
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
        <div ${attr(FORSLAG.field)}>
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
        <div ${attr(smalt.field)}>
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
 * Markup skrevet uten JavaScript: ledetekst, felt, liste med `<li>` og et
 * statuselement, uten roller, id-er eller kobling. Komponenten fyller inn
 * resten. Statuselementet må skrives: det er innhold serveren sender.
 */
const BAR = `
  <fs-suggestion>
    <label>Kommune</label>
    <div class="fs-suggestion__field">
      <input class="fs-input" name="kommune">
      <ul class="fs-suggestion__list">
        ${KOMMUNER.map((k) => `<li>${k}</li>`).join("")}
      </ul>
      <p class="fs-suggestion__empty" hidden>Ingen treff</p>
      <span class="fs-sr-only" role="status" aria-live="polite" data-ignore-morph></span>
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
    expect(input.id).not.toBe("")
    expect(label.htmlFor).toBe(input.id)
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
      BAR.replace(
        '<input class="fs-input" name="kommune">',
        '<input class="fs-input" name="kommune" id="egen" aria-expanded="true">',
      ).replace(
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
    for (const navn of [
      "role",
      "id",
      "aria-controls",
      "aria-expanded",
      "autocomplete",
      "aria-autocomplete",
    ]) {
      input.removeAttribute(navn)
    }
    label.removeAttribute("for")
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
        <div ${attr(FORSLAG.field)}>
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
        <div ${attr(forslag.field)}>
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
