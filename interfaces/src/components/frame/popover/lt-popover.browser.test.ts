/// <reference path="../../../types/css.d.ts" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { defineLtPopover, type LtPopover } from "./lt-popover"
import { popover, popoverPlacements } from "./popover"

import "../../../tokens/tokens.css"
import "./popover.css"
import "../../css/button/button.css"
import "../../css/list/list.css"

/** Markupen serveren sender, bygget med byggefunksjonen og ikke for hånd. */
const BOKS = popover({ id: "panel" })

async function tegn() {
  await customElements.whenDefined("lt-popover")
  await waitForPaint()
}

describe("lt-popover", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  beforeEach(async () => {
    mount(`
      <lt-popover placement="bottom-end" ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} class="lt-button" id="utloser">Handlinger</button>
        <ul ${attr(BOKS.panel)} data-variant="plain">
          <li><button class="lt-button" data-variant="ghost" type="button">Arkiver</button></li>
          <li><button class="lt-button" data-variant="ghost" type="button">Slett</button></li>
        </ul>
      </lt-popover>
    `)
    await tegn()
  })

  it("får koblingen fra serveren, ikke fra komponenten", () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(utloser.getAttribute("aria-expanded")).toBe("false")
    expect(utloser.getAttribute("aria-controls")).toBe("panel")
    expect(panel.getAttribute("popover")).toBe("manual")
    expect(panel.classList.contains("lt-popover")).toBe(true)
  })

  it("ber ikke malen frede noe", () => {
    // Tilstanden er brukerens, og komponenten setter den tilbake selv etter
    // en patch. Kommer `data-preserve-attr` tilbake her, har noen gjenopptatt
    // kontrakten malen måtte skrive av fra dokumentasjonen.
    const vert = document.querySelector("lt-popover") as HTMLElement
    const knapp = document.querySelector("button") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(vert.hasAttribute("data-preserve-attr")).toBe(false)
    expect(knapp.hasAttribute("data-preserve-attr")).toBe(false)
    expect(panel.hasAttribute("data-preserve-attr")).toBe(false)
  })

  it("åpner og lukker på klikk", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    utloser.click()
    await tegn()
    expect(panel.matches(":popover-open")).toBe(true)
    expect(utloser.getAttribute("aria-expanded")).toBe("true")

    utloser.click()
    await tegn()
    expect(panel.matches(":popover-open")).toBe(false)
    expect(utloser.getAttribute("aria-expanded")).toBe("false")
  })

  it("lukker på Escape og gir fokus tilbake til knappen", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement

    utloser.click()
    await tegn()

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await tegn()

    const panel = document.getElementById("panel") as HTMLElement
    expect(panel.matches(":popover-open")).toBe(false)
    expect(document.activeElement).toBe(utloser)
  })

  it("lukker ved klikk utenfor", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    await tegn()

    const panel = document.getElementById("panel") as HTMLElement
    expect(panel.matches(":popover-open")).toBe(false)
  })

  it("melder fra når panelet åpnes og lukkes", async () => {
    const boks = document.querySelector("lt-popover") as HTMLElement
    const meldinger: boolean[] = []
    boks.addEventListener("popover-toggle", (event) => {
      meldinger.push(event.detail.open)
    })

    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()
    utloser.click()
    await tegn()

    expect(meldinger).toEqual([true, false])
  })

  it("har ingen tilgjengelighetsbrudd når panelet er åpent", async () => {
    const utloser = document.getElementById("utloser") as HTMLElement
    utloser.click()
    await tegn()

    await expectNoAccessibilityViolations()
  })
})

/**
 * Hvordan komponenten kjenner igjen delene sine.
 *
 * Knappen var tidligere merket med `slot="trigger"`, et levn fra den gangen
 * komponenten hadde shadow DOM. Uten en skyggerot gjør `slot` ingenting i
 * HTML, så attributtet så ut som noe annet enn det var. Nå leses koblingen
 * som uansett må være der: panelet har `popover`, og knappen peker på det
 * med `aria-controls`.
 */
describe("lt-popover finner delene sine", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  it("sender ikke ut slot i det hele tatt", () => {
    expect(Object.keys(popover({ id: "x" }).trigger)).not.toContain("slot")
  })

  it("virker på markup helt uten slot", async () => {
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} class="lt-button" id="bare-aria">Handlinger</button>
        <ul ${attr(BOKS.panel)}><li>Arkiver</li></ul>
      </lt-popover>
    `)
    await tegn()

    const knapp = document.getElementById("bare-aria") as HTMLButtonElement
    const panel = document.querySelector("[popover]") as HTMLElement

    expect(document.querySelectorAll("[slot]")).toHaveLength(0)

    knapp.click()
    await waitForPaint()

    expect(panel.matches(":popover-open")).toBe(true)
    expect(knapp.getAttribute("aria-expanded")).toBe("true")
  })

  it("lar et gammelt slot-attributt stå uten å ta skade", async () => {
    // En server som ennå ikke er oppdatert sender fortsatt `slot="trigger"`.
    // Det skal ikke hindre noe: attributtet er inert uten en skyggerot.
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} slot="trigger" class="lt-button" id="med-slot">Handlinger</button>
        <ul ${attr(BOKS.panel)}><li>Arkiver</li></ul>
      </lt-popover>
    `)
    await tegn()

    const knapp = document.getElementById("med-slot") as HTMLButtonElement
    const panel = document.querySelector("[popover]") as HTMLElement

    knapp.click()
    await waitForPaint()

    expect(panel.matches(":popover-open")).toBe(true)
  })
})

describe("lt-popover plasserer panelet", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  function markup(id: string, vert = "", panel = 'popover="manual"') {
    return `
      <lt-popover ${vert}>
        <button aria-controls="${id}" aria-expanded="false" class="lt-button" id="${id}-knapp">Handlinger</button>
        <ul class="lt-popover" id="${id}" ${panel}><li>Arkiver saken</li><li>Slett saken</li></ul>
      </lt-popover>
    `
  }

  async function apne(id: string) {
    ;(document.getElementById(`${id}-knapp`) as HTMLElement).click()
    await tegn()
    return {
      knapp: (
        document.getElementById(`${id}-knapp`) as HTMLElement
      ).getBoundingClientRect(),
      panel: (
        document.getElementById(id) as HTMLElement
      ).getBoundingClientRect(),
    }
  }

  it("henger under knappen, med samme venstrekant", async () => {
    mount(markup("p1"))
    await tegn()
    const { knapp, panel } = await apne("p1")

    expect(Math.abs(panel.left - knapp.left)).toBeLessThan(1.5)
    expect(Math.abs(panel.top - (knapp.bottom + 4))).toBeLessThan(1.5)
  })

  it("høyrekanter med bottom-end", async () => {
    mount(markup("p2", 'placement="bottom-end"'))
    await tegn()
    const { knapp, panel } = await apne("p2")

    expect(Math.abs(panel.right - knapp.right)).toBeLessThan(1.5)
  })

  it("lar start være høyre kant i høyre-til-venstre", async () => {
    // Posisjonen er fysisk, men `start` og `end` følger leseretningen. Med
    // logisk `inset-inline-start` og en fysisk verdi lå panelet på motsatt
    // side av knappen.
    mount(`<div dir="rtl">${markup("p3")}</div>`)
    await tegn()
    const { knapp, panel } = await apne("p3")

    expect(Math.abs(panel.right - knapp.right)).toBeLessThan(1.5)
    expect(Math.abs(panel.top - (knapp.bottom + 4))).toBeLessThan(1.5)
  })

  it("faller ned under knappen når det ikke er plass over", async () => {
    // `top-start` klemte ikke, og et panel ved toppen av siden lå helt
    // utenfor skjermen, uten å kunne rulles fram.
    mount(markup("p4", 'placement="top-start"'))
    await tegn()
    const { knapp, panel } = await apne("p4")

    expect(panel.top).toBeGreaterThanOrEqual(4)
    expect(Math.abs(panel.top - (knapp.bottom + 4))).toBeLessThan(1.5)
  })

  it("følger med når nettleseren selv lukker et auto-popover", async () => {
    // Håndskrevet markup med bare `popover` er `auto`, og da lukker
    // nettleseren panelet selv. Verten sto igjen med `open`, og neste klikk
    // på knappen gjorde ingenting synlig.
    mount(markup("p5", "", "popover"))
    await tegn()
    const vert = document.querySelector("lt-popover") as HTMLElement
    const knapp = document.getElementById("p5-knapp") as HTMLElement
    const panel = document.getElementById("p5") as HTMLElement
    const meldinger: boolean[] = []
    vert.addEventListener("popover-toggle", (e) =>
      meldinger.push(e.detail.open),
    )

    knapp.click()
    await tegn()
    expect(vert.hasAttribute("open")).toBe(true)

    // Slik nettleseren gjør det ved lett avvisning.
    panel.hidePopover()
    await tegn()

    expect(vert.hasAttribute("open")).toBe(false)
    expect(knapp.getAttribute("aria-expanded")).toBe("false")
    expect(meldinger).toEqual([true, false])

    knapp.click()
    await tegn()
    expect(panel.matches(":popover-open")).toBe(true)
  })

  it("setter posisjonen igjen etter en patch som river style bort", async () => {
    mount(markup("p6"))
    await tegn()
    await apne("p6")
    const panel = document.getElementById("p6") as HTMLElement
    // Attributtet leses direkte: WebKit gir tom streng fra
    // `style.getPropertyValue` for en egendefinert egenskap.
    const posisjon = () => panel.getAttribute("style") ?? ""
    expect(posisjon()).toContain("--lt-popover-top")

    panel.removeAttribute("style")
    await tegn()

    expect(posisjon()).toContain("--lt-popover-top")
  })

  it("lar byggefunksjonen sette placement på verten", () => {
    expect(popover({ id: "x" }).host.placement).toBeUndefined()
    expect(popover({ id: "x", placement: "top-end" }).host.placement).toBe(
      "top-end",
    )
    expect(popoverPlacements).toEqual([
      "bottom-start",
      "bottom-end",
      "top-start",
      "top-end",
    ])
    expect(popover.isPlacement("top-end")).toBe(true)
    expect(popover.isPlacement("midt")).toBe(false)
  })
})

/*
 * Markup skrevet uten JavaScript: en knapp og et panel med klassen, uten
 * `popover`, id eller `aria-controls`. Komponenten fyller inn `popover`, men
 * aldri id: et panel med en id serveren ikke sendte, byttes ut ved neste
 * oppdatering. `MED_ID` er det oppskriften viser, med id fra malen.
 */
const BAR = `
  <lt-popover>
    <button class="lt-button" id="bar-knapp">Handlinger</button>
    <ul class="lt-popover" data-variant="plain">
      <li><button class="lt-button" data-variant="ghost" type="button">Arkiver</button></li>
    </ul>
  </lt-popover>`

const MED_ID = BAR.replace(
  '<ul class="lt-popover"',
  '<ul class="lt-popover" id="meny"',
)

describe("lt-popover kobler fra bar struktur", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  function deler() {
    return {
      knapp: document.getElementById("bar-knapp") as HTMLButtonElement,
      panel: document.querySelector("ul.lt-popover") as HTMLElement,
    }
  }

  it("skriver aldri id på panelet, og åpner likevel på klikk", async () => {
    mount(BAR)
    await tegn()
    const { knapp, panel } = deler()

    expect(panel.getAttribute("popover")).toBe("manual")
    expect(panel.hasAttribute("id")).toBe(false)
    expect(knapp.hasAttribute("aria-controls")).toBe(false)
    expect(knapp.getAttribute("aria-expanded")).toBe("false")

    knapp.click()
    await waitForPaint()
    expect(panel.matches(":popover-open")).toBe(true)
    expect(knapp.getAttribute("aria-expanded")).toBe("true")
    ;(document.querySelector("lt-popover") as LtPopover).hide()
  })

  it("skriver aria-controls fra id-en malen ga panelet, og åpner på klikk", async () => {
    mount(MED_ID)
    await tegn()
    const { knapp, panel } = deler()

    expect(panel.getAttribute("popover")).toBe("manual")
    expect(panel.id).toBe("meny")
    expect(knapp.getAttribute("aria-controls")).toBe("meny")
    expect(knapp.getAttribute("aria-expanded")).toBe("false")

    knapp.click()
    await waitForPaint()
    expect(panel.matches(":popover-open")).toBe(true)
    expect(knapp.getAttribute("aria-expanded")).toBe("true")

    await expectNoAccessibilityViolations()
    ;(document.querySelector("lt-popover") as LtPopover).hide()
  })

  it("holder vinduet åpent når en patch tar både open og popover", async () => {
    /*
     * En morfing fra en mal uten `popover` tar `open` på verten og `popover`
     * på panelet i samme omgang. Komponenten lukker, gjenåpner i neste
     * mikrotask, og først etterpå kommer `toggle` med «closed» fra
     * lukkingen, som en egen oppgave. Den ble tatt som brukerens lukking, og
     * vinduet sto lukket etter en patch som ikke sa noe om det.
     */
    mount(BAR)
    await tegn()
    const { knapp, panel } = deler()
    const vert = document.querySelector("lt-popover") as LtPopover
    knapp.click()
    await waitForPaint()
    expect(panel.matches(":popover-open")).toBe(true)

    vert.removeAttribute("open")
    panel.removeAttribute("popover")
    await waitForPaint()
    await waitForPaint()

    expect(vert.open).toBe(true)
    expect(panel.getAttribute("popover")).toBe("manual")
    expect(panel.matches(":popover-open")).toBe(true)
    expect(knapp.getAttribute("aria-expanded")).toBe("true")
    vert.hide()
  })

  it("åpner ikke av seg selv når server-controlled settes og fjernes igjen", async () => {
    mount(BAR)
    await tegn()
    const { knapp, panel } = deler()
    const vert = document.querySelector("lt-popover") as LtPopover
    knapp.click()
    await waitForPaint()
    expect(panel.matches(":popover-open")).toBe(true)

    // Serveren overtar og lukker. Så slipper den igjen. Husket komponenten
    // at brukeren åpnet vinduet, spratt det opp i det attributtet ble fjernet.
    vert.setAttribute("server-controlled", "")
    vert.removeAttribute("open")
    await waitForPaint()
    vert.removeAttribute("server-controlled")
    await waitForPaint()
    await waitForPaint()

    expect(vert.open).toBe(false)
    expect(panel.matches(":popover-open")).toBe(false)
  })

  it("lar det serveren skrev stå", async () => {
    // `popover` uten verdi er `auto`, og det er en annen verdi enn
    // komponentens `manual`. Id-en er også serverens.
    mount(
      BAR.replace(
        '<ul class="lt-popover" data-variant="plain">',
        '<ul class="lt-popover" id="eget-panel" popover data-variant="plain">',
      ),
    )
    await tegn()
    const { knapp, panel } = deler()

    expect(panel.getAttribute("popover")).toBe("")
    expect(panel.id).toBe("eget-panel")
    expect(knapp.getAttribute("aria-controls")).toBe("eget-panel")
  })

  it("velger ikke en knapp som peker på noe annet", async () => {
    mount(
      MED_ID.replace(
        '<button class="lt-button" id="bar-knapp">',
        '<button class="lt-button" aria-controls="noe-annet" id="feil-knapp">Filter</button>' +
          '<button class="lt-button" id="bar-knapp">',
      ),
    )
    await tegn()
    const { knapp, panel } = deler()
    const feil = document.getElementById("feil-knapp") as HTMLElement

    expect(knapp.getAttribute("aria-controls")).toBe(panel.id)
    expect(feil.getAttribute("aria-controls")).toBe("noe-annet")
    expect(feil.hasAttribute("aria-expanded")).toBe(false)
  })

  it("setter koblingen tilbake etter en patch", async () => {
    mount(MED_ID)
    await tegn()
    const { knapp, panel } = deler()

    // Slik en morfing gjør det: alt som ikke sto i serverens HTML tas bort.
    // Id-en sto der, så den blir stående.
    panel.removeAttribute("popover")
    for (const navn of ["aria-controls", "aria-expanded"]) {
      knapp.removeAttribute(navn)
    }
    await waitForPaint()

    expect(panel.id).toBe("meny")
    expect(panel.getAttribute("popover")).toBe("manual")
    expect(knapp.getAttribute("aria-controls")).toBe("meny")
    expect(knapp.getAttribute("aria-expanded")).toBe("false")
  })

  it("gir panelet id-en når en patch fra serveren gir det en", async () => {
    mount(BAR)
    await tegn()
    const { knapp, panel } = deler()
    expect(knapp.hasAttribute("aria-controls")).toBe(false)

    panel.id = "meny"
    await waitForPaint()

    expect(knapp.getAttribute("aria-controls")).toBe("meny")
  })

  it("gjør knappen til en vanlig knapp, så den ikke sender skjemaet", async () => {
    mount(`
      <form id="skjema">
        <lt-popover>
          <button class="lt-button">Hva betyr dette?</button>
          <div class="lt-popover">Forklaring</div>
        </lt-popover>
      </form>`)
    await tegn()
    let sendt = 0
    document.getElementById("skjema")?.addEventListener("submit", (event) => {
      sendt++
      event.preventDefault()
    })
    const knapp = document.querySelector("button") as HTMLButtonElement

    knapp.click()
    await tegn()
    expect(sendt).toBe(0)
    expect(document.querySelector("lt-popover")?.hasAttribute("open")).toBe(
      true,
    )

    // En patch fra malen river `type` bort igjen.
    knapp.removeAttribute("type")
    await tegn()
    expect(knapp.getAttribute("type")).toBe("button")
  })

  it("retter en tom type, men lar en knapp som sier submit stå", async () => {
    mount(`
      <lt-popover id="tom">
        <button class="lt-button" type="">Hva betyr dette?</button>
        <div class="lt-popover">Forklaring</div>
      </lt-popover>
      <lt-popover id="send">
        <button class="lt-button" type="submit">Send</button>
        <div class="lt-popover">Forklaring</div>
      </lt-popover>`)
    await tegn()

    expect(document.querySelector("#tom button")?.getAttribute("type")).toBe(
      "button",
    )
    expect(document.querySelector("#send button")?.getAttribute("type")).toBe(
      "submit",
    )
  })

  it("skriver ingenting på markup fra lt.popover()", async () => {
    // Den direkte påstanden bak «det serveren skrev står»: null
    // mutasjonsposter fra komponentens første runde.
    const omslag = document.createElement("div")
    omslag.innerHTML = `
      <lt-popover ${attr(BOKS.host)}>
        <button ${attr(BOKS.trigger)} class="lt-button">Handlinger</button>
        <ul ${attr(BOKS.panel)}><li>Arkiver</li></ul>
      </lt-popover>`
    const vert = omslag.querySelector("lt-popover") as HTMLElement
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

describe("lt-popover når React skriver egenskapen", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  it("åpner ikke vinduet av at egenskapen settes til undefined", async () => {
    mount(
      `<lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}>Innhold</div>
      </lt-popover>`,
    )
    await customElements.whenDefined("lt-popover")
    await waitForPaint()
    const vert = document.querySelector("lt-popover") as LtPopover

    // Slik React 19 skriver en prop som er borte.
    ;(vert as unknown as { open: undefined }).open = undefined
    await waitForPaint()

    expect(vert.hasAttribute("open")).toBe(false)
    expect(document.getElementById("panel")?.matches(":popover-open")).toBe(
      false,
    )
  })

  it("sender ingen popover-toggle når open settes som egenskap eller attributt", async () => {
    /*
     * Hendelsen er brukerens og metodenes. Kom den også fra egenskapen og
     * attributtet, ville Datastar-oppskriften med `data-attr:open` og
     * `data-on:popover-toggle` fått sitt eget signal i retur.
     */
    mount(
      `<lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}>Innhold</div>
      </lt-popover>`,
    )
    await customElements.whenDefined("lt-popover")
    await waitForPaint()
    const vert = document.querySelector("lt-popover") as LtPopover
    const panel = document.getElementById("panel") as HTMLElement
    const logg: boolean[] = []
    vert.addEventListener("popover-toggle", (e) => logg.push(e.detail.open))

    vert.open = true
    await waitForPaint()
    expect(panel.matches(":popover-open")).toBe(true)
    vert.open = false
    await waitForPaint()
    vert.setAttribute("open", "")
    await waitForPaint()
    vert.removeAttribute("open")
    await waitForPaint()
    expect(panel.matches(":popover-open")).toBe(false)
    expect(logg).toEqual([])

    vert.show()
    vert.hide()
    expect(logg).toEqual([true, false])
  })
})

describe("lt-popover inne i en modal dialog", () => {
  beforeAll(() => {
    defineLtPopover()
  })

  it("lukker bare vinduet ved Escape, ikke dialogen", async () => {
    mount(`
      <dialog id="dialog">
        <lt-popover ${attr(BOKS.host)}>
          <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
          <div ${attr(BOKS.panel)}><button type="button">Arkiver</button></div>
        </lt-popover>
      </dialog>`)
    await customElements.whenDefined("lt-popover")
    const dialog = document.getElementById("dialog") as HTMLDialogElement
    const vert = document.querySelector("lt-popover") as LtPopover
    dialog.showModal()
    vert.show()
    await waitForPaint()
    expect(vert.open).toBe(true)

    // Et ekte tastetrykk: en syntetisk hendelse lukker aldri en dialog, så
    // bare dette viser at dialogen faktisk overlever.
    ;(document.querySelector("#panel button") as HTMLElement).focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()

    expect(vert.open, "vinduet ble ikke lukket").toBe(false)
    expect(dialog.open, "Escape lukket dialogen også").toBe(true)
    dialog.close()
  })

  it("lukker ved Escape i et annet felt, men lar fokus stå der", async () => {
    // Før hoppet fokus fra feltet brukeren sto i, til knappen.
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}>Innhold</div>
      </lt-popover>
      <input id="annet">`)
    await customElements.whenDefined("lt-popover")
    const vert = document.querySelector("lt-popover") as LtPopover
    vert.show()
    await waitForPaint()

    const annet = document.getElementById("annet") as HTMLInputElement
    annet.focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()

    expect(vert.open).toBe(false)
    expect(document.activeElement).toBe(annet)
  })

  it("lar en modal dialog åpnet oppå vinduet lukkes av sitt eget trykk", async () => {
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}>Innhold</div>
      </lt-popover>
      <dialog id="over"><button type="button" id="ok">Ok</button></dialog>`)
    await customElements.whenDefined("lt-popover")
    const vert = document.querySelector("lt-popover") as LtPopover
    vert.show()
    await waitForPaint()

    const over = document.getElementById("over") as HTMLDialogElement
    over.showModal()
    ;(document.getElementById("ok") as HTMLElement).focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()

    expect(over.open, "dialogen ble ikke lukket").toBe(false)
    expect(vert.open, "vinduet under ble lukket").toBe(true)
  })

  it("lukker vinduet, ikke dialogen, når fokus står på dialogen selv", async () => {
    // Et klikk på tekst i panelet gir dialogen fokus, ikke `body`. Før
    // lukket Escape da dialogen og lot vinduet stå åpent i den.
    mount(`
      <dialog id="dialog" tabindex="-1">
        <lt-popover ${attr(BOKS.host)}>
          <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
          <div ${attr(BOKS.panel)}>Innhold</div>
        </lt-popover>
      </dialog>`)
    await customElements.whenDefined("lt-popover")
    const dialog = document.getElementById("dialog") as HTMLDialogElement
    const vert = document.querySelector("lt-popover") as LtPopover
    dialog.showModal()
    vert.show()
    await waitForPaint()

    dialog.focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()

    expect(vert.open, "vinduet ble ikke lukket").toBe(false)
    expect(dialog.open, "Escape lukket dialogen").toBe(true)
    dialog.close()
  })

  it("lukker det innerste av to nøstede vinduer først", async () => {
    const indre = popover({ id: "indre" })
    mount(`
      <lt-popover ${attr(BOKS.host)} id="ytre">
        <button type="button" ${attr(BOKS.trigger)}>Meny</button>
        <div ${attr(BOKS.panel)}>
          <lt-popover ${attr(indre.host)} id="nost">
            <button type="button" ${attr(indre.trigger)}>Hjelp</button>
            <div ${attr(indre.panel)}><button type="button" id="inni">Ok</button></div>
          </lt-popover>
        </div>
      </lt-popover>`)
    await customElements.whenDefined("lt-popover")
    const ytre = document.getElementById("ytre") as LtPopover
    const nost = document.getElementById("nost") as LtPopover
    ytre.show()
    nost.show()
    await waitForPaint()

    ;(document.getElementById("inni") as HTMLElement).focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()
    // Før lukket det ytre seg og lot det indre stå åpent.
    expect(nost.open).toBe(false)
    expect(ytre.open).toBe(true)

    await userEvent.keyboard("{Escape}")
    await waitForPaint()
    expect(ytre.open).toBe(false)
  })

  it("lukker ved Escape fra et felt i en skyggerot i panelet", async () => {
    if (!customElements.get("skygge-felt")) {
      customElements.define(
        "skygge-felt",
        class extends HTMLElement {
          connectedCallback() {
            this.attachShadow({ mode: "open" }).innerHTML = "<input>"
          }
        },
      )
    }
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}><skygge-felt></skygge-felt></div>
      </lt-popover>`)
    await customElements.whenDefined("lt-popover")
    const vert = document.querySelector("lt-popover") as LtPopover
    vert.show()
    await waitForPaint()

    const felt = document
      .querySelector("skygge-felt")
      ?.shadowRoot?.querySelector("input") as HTMLInputElement
    felt.focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()

    expect(vert.open).toBe(false)
  })

  it("lar et trykk noe annet alt har brukt være", async () => {
    // En forslagsliste i vinduet lukker seg på Escape og kaller
    // `preventDefault`. Før tok samme trykk vinduet også.
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}><input id="felt"></div>
      </lt-popover>`)
    await customElements.whenDefined("lt-popover")
    const vert = document.querySelector("lt-popover") as LtPopover
    vert.show()
    await waitForPaint()

    const felt = document.getElementById("felt") as HTMLInputElement
    felt.addEventListener("keydown", (event) => event.preventDefault())
    felt.focus()
    await userEvent.keyboard("{Escape}")
    await waitForPaint()

    expect(vert.open).toBe(true)
    expect(document.activeElement).toBe(felt)
  })

  it("rører ikke Escape når vinduet er lukket", async () => {
    mount(`
      <lt-popover ${attr(BOKS.host)}>
        <button type="button" ${attr(BOKS.trigger)}>Handlinger</button>
        <div ${attr(BOKS.panel)}>Innhold</div>
      </lt-popover>
      <button type="button" id="annet">Annet</button>`)
    await customElements.whenDefined("lt-popover")
    await waitForPaint()
    const annet = document.getElementById("annet") as HTMLElement
    annet.focus()

    const trykk = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
    annet.dispatchEvent(trykk)

    expect(trykk.defaultPrevented).toBe(false)
    expect(document.activeElement, "fokus ble flyttet til knappen").toBe(annet)
  })
})
