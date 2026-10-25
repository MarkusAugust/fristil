/**
 * At felt og forslagsfelt, slik oppskriftene viser dem, virker uten
 * JavaScript og overlever at serveren sender området på nytt, på hver av
 * de tre måtene en side oppdateres på.
 *
 * Markupen leses rett fra «Ren HTML»-fanen på komponentsidene, så testen
 * og dokumentasjonen ikke kan si to ulike ting. Datastar og idiomorph, som
 * htmx morfer med, kjenner igjen et element på id. Et element uten id
 * beholdes, og et element med en id serveren ikke sendte, byttes ut.
 * Komponentene skriver derfor aldri id på feltet: `for` og `id` kommer fra
 * malen, eller så står ledeteksten rundt feltet. Det som gjelder for hver
 * måte:
 *
 * - Datastar beholder feltet, fokus og teksten.
 * - idiomorph beholder feltet og fokus, men setter teksten og `checked` fra
 *   serverens HTML. Unntaket er feltet med fokus når `ignoreActiveValue` er
 *   slått på, som htmx-brukere gjør med
 *   `hx-swap="morph:{ignoreActiveValue:true}"`; den er av fra før. Serveren
 *   må altså sende verdiene tilbake.
 * - `innerHTML` bytter ut alt. Det nye feltet skal være koblet på nytt.
 * - Uten JavaScript finnes ingen oppdatering, og markupen må stå på egne
 *   bein: hvert felt har et navn, påkrevd-merket og feilmeldingen fra
 *   serveren synes, og lista i forslagsfeltet står ikke åpen.
 *
 * Mutasjonene som skal felle den: en id skrevet på feltet av komponenten
 * (tilfellene med ledeteksten rundt), `for`-skrivingen tatt ut av
 * komponenten (tilfellet med ledetekst uten `for`), og id tatt ut av
 * oppskriften (advarselen).
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
import { defineFsField } from "./components/ramme/field/fs-field"
import { defineFsPopover } from "./components/ramme/popover/fs-popover"
import { defineFsSuggestion } from "./components/ramme/suggestion/fs-suggestion"
import suggestionCss from "./components/ramme/suggestion/suggestion.css?inline"
import { ventPaTegning } from "./testing/a11y"
import { Idiomorph } from "./testing/idiomorph/idiomorph-v0.8.0.js"
import tokensCss from "./tokens/tokens.css?inline"

import "./testing/datastar/datastar-v1.0.4.js"

type Maate = "Datastar" | "idiomorph" | "innerHTML"
const MAATER: Maate[] = ["Datastar", "idiomorph", "innerHTML"]

/**
 * Oppskriften i «Ren HTML»-fanen på en komponentside: den første
 * html-blokken med elementet i, uten skriptene.
 */
function oppskrift(side: string, tag: string): string {
  const fane = side.slice(side.indexOf('<TabItem label="Ren HTML">'))
  const blokker = [...fane.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1])
  const blokk = blokker.find((b) => b.includes(`<${tag}`))
  if (!blokk) throw new Error(`fant ingen oppskrift med <${tag}> på siden`)
  return blokk.replace(/<script[\s\S]*?<\/script>/g, "")
}

const FELT = oppskrift(feltSide, "fs-field")
const FORSLAG = oppskrift(forslagSide, "fs-suggestion")
/** Oppskriften «Tekst og kode», med det skjulte feltet for koden. */
const KODE = oppskrift(forslagSide, 'input class="fs-suggestion__value"')

/** Oppskriften med ledeteksten rundt feltet, og ingen id. */
const FELT_RUNDT = `
  <fs-field>
    <label class="fs-label">Fullt navn <input class="fs-input" name="navn" type="text"></label>
    <p class="fs-help-text">Slik det står i passet.</p>
  </fs-field>`

const FORSLAG_RUNDT = `
  <fs-suggestion>
    <label class="fs-label">Kommune <input class="fs-input" name="kommune" type="text"></label>
    <ul class="fs-suggestion__list"><li>Bergen</li><li>Bodø</li><li>Oslo</li></ul>
    <span class="fs-sr-only" role="status"></span>
  </fs-suggestion>`

const AVKRYSSING = (checked: boolean) => `
  <div>
    <input class="fs-checkbox" type="checkbox" id="vilkar" name="vilkar"${checked ? " checked" : ""}>
    <label class="fs-label" for="vilkar">Jeg godtar vilkårene</label>
  </div>`

/**
 * Området serveren sender, med id så Datastar finner det. En oppdatering
 * har et merke i seg, så hvert tilfelle kan se at patchen faktisk kom fram
 * og ikke bare at ingenting skjedde.
 */
const omraade = (innhold: string, oppdatert = false) =>
  `<div id="omraade">${oppdatert ? "<span hidden data-oppdatert></span>" : ""}${innhold}</div>`

async function oppdater(maate: Maate, innhold: string): Promise<void> {
  const rot = document.getElementById("omraade") as HTMLElement
  // Merket fra forrige oppdatering tas bort, så det er denne som må bringe det.
  rot.querySelector("[data-oppdatert]")?.remove()
  if (maate === "Datastar") {
    // Som en `datastar-patch-elements` uten selektor: `outer` på id-en.
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
    `oppdateringen med ${maate} kom ikke fram`,
  ).not.toBeNull()
}

/** Venter til observatørene har kjørt. */
async function roSeg() {
  await ventPaTegning()
  await ventPaTegning()
}

/** Venter til `warnAboutMarkup` har sett siden falle til ro. */
/*
 * 300 ms holder når tegningene kommer. I en skjult fane faller
 * `whenSettled` tilbake på ett sekund, og en stillhetstest ville da bestått
 * uten å ha sett noe; men «sier fra én gang når oppskriften mangler id»
 * venter like lenge og ville feilet, så kjøringen som helhet kan ikke bestå
 * tomt.
 */
const stille = () => new Promise((r) => setTimeout(r, 300))

async function monter(innhold: string) {
  document.body.innerHTML = omraade(innhold)
  await roSeg()
}

const felt = () =>
  document.querySelector("input:not([type='checkbox'])") as HTMLInputElement

describe("felt og forslagsfelt gjennom en oppdatering fra serveren", () => {
  beforeAll(() => {
    defineFsField()
    defineFsSuggestion()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("leser oppskriftene fra komponentsidene", () => {
    expect(FELT).toContain('for="navn"')
    expect(FELT).toContain('id="navn"')
    expect(FORSLAG).toContain('for="kommune"')
    expect(FORSLAG).toContain('id="kommune"')
    expect(KODE).toContain('data-value="4601"')
  })

  for (const maate of MAATER) {
    it(`et valgt forslag med kode: ${maate}`, async () => {
      // Planens 6.1: velg et forslag, så oppdatering. Serveren sender
      // verdifeltet tomt; med `innerHTML` må den sende begge verdiene tilbake.
      const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
      await monter(KODE)
      const input = felt()
      input.focus()
      ;(document.querySelector("li") as HTMLElement).click()
      await roSeg()
      const kode = () =>
        document.querySelector(".fs-suggestion__value") as HTMLInputElement
      expect(input.value).toBe("Bergen")
      expect(kode().value).toBe("4601")

      await oppdater(
        maate,
        maate === "innerHTML"
          ? KODE.replace('type="text"', 'type="text" value="Bergen"').replace(
              'type="hidden"',
              'type="hidden" value="4601"',
            )
          : KODE,
      )

      expect(felt().value).toBe("Bergen")
      expect(kode().value).toBe("4601")
      await stille()
      expect(advarsel).not.toHaveBeenCalled()
    })
  }

  const TILFELLER = [
    {
      navn: "felt fra oppskriften",
      markup: FELT,
      ledetekst: "Fullt navn",
      id: "navn",
    },
    {
      navn: "felt med ledeteksten rundt, ingen id",
      markup: FELT_RUNDT,
      ledetekst: "Fullt navn",
      id: "",
    },
    {
      navn: "forslagsfelt fra oppskriften",
      markup: FORSLAG,
      ledetekst: "Kommune",
      id: "kommune",
    },
    {
      navn: "forslagsfelt med ledeteksten rundt, ingen id",
      markup: FORSLAG_RUNDT,
      ledetekst: "Kommune",
      id: "",
    },
  ]

  for (const maate of MAATER) {
    for (const t of TILFELLER) {
      it(`${t.navn}: ${maate}`, async () => {
        const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
        await monter(t.markup)
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
        const hjelp = document.querySelector(".fs-help-text")
        if (hjelp) expect(etter.getAttribute("aria-describedby")).toBe(hjelp.id)
        if (etter.closest("fs-suggestion")) {
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

  it("idiomorph uten ignoreActiveValue setter også feltet med fokus fra serveren", async () => {
    // Standarden i idiomorph, og dermed i htmx uten eget valg i `hx-swap`.
    await monter(FELT)
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
    it(`et felt uten fokus: ${maate} og det serveren sender tilbake`, async () => {
      /*
       * Datastar lar teksten stå. idiomorph setter den fra serverens HTML, så
       * med htmx må serveren sende verdien tilbake. Det er den ene setningen
       * dokumentasjonen gir htmx-brukere, og den er etterprøvd her.
       */
      await monter(FELT)
      felt().value = "Kari"
      felt().blur()

      await oppdater(maate, FELT)
      expect(felt().value).toBe(maate === "Datastar" ? "Kari" : "")

      // Serveren sender en annen tekst enn den som står der. Begge morferne
      // setter egenskapen når attributtet er et annet: Datastar i
      // patchElements.ts (`oldElt.value = newValue`), idiomorph alltid.
      felt().value = "Ola"
      await oppdater(maate, FELT.replace('id="navn"', 'id="navn" value="Kari"'))
      expect(felt().value).toBe("Kari")
    })

    it(`avkryssing: ${maate} og det serveren sender tilbake`, async () => {
      await monter(AVKRYSSING(false))
      const boks = document.getElementById("vilkar") as HTMLInputElement
      boks.click()
      expect(boks.checked).toBe(true)

      await oppdater(maate, AVKRYSSING(false))
      expect(document.getElementById("vilkar")).toBe(boks)
      expect(boks.checked).toBe(maate === "Datastar")

      // Serveren sender `checked` mens boksen står tom etter at brukeren
      // rørte den. Begge morferne setter krysset fra serverens HTML.
      boks.checked = false
      await oppdater(maate, AVKRYSSING(true))
      expect(boks.checked).toBe(true)
    })

    it(`liste med id fra en nøkkel: teksten blir i riktig rad (${maate})`, async () => {
      /*
       * En id som følger plassen, flytter det brukeren skrev til feil rad når
       * serveren setter inn en ny øverst. En id fra en nøkkel i dataene holder
       * raden der den hører hjemme. Testen gjelder regelen dokumentasjonen gir
       * malene, ikke komponentene: alle id-ene kommer fra serveren.
       */
      const liste = (navn: string[]) =>
        navn
          .map((n) => {
            const k = n.toLowerCase()
            // Id på raden også, slik `hx-target` og `hx-swap-oob` trenger den.
            return `<fs-field id="rad-${k}"><label class="fs-label" for="merknad-${k}">${n}</label><input class="fs-input" id="merknad-${k}" name="merknad-${k}"></fs-field>`
          })
          .join("")
      await monter(liste(["Bergen", "Oslo"]))
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

  it("skriver for på en ledetekst uten, fra feltets id", async () => {
    // Mutasjonen: ta `for`-skrivingen ut av komponenten.
    await monter(FELT.replace(' for="navn"', ""))
    const label = document.querySelector("label") as HTMLLabelElement
    expect(label.htmlFor).toBe("navn")
  })

  it("sier fra én gang når oppskriften mangler id på feltet", async () => {
    const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
    await monter(FELT.replace(' id="navn"', ""))
    await stille()
    expect(advarsel).toHaveBeenCalledTimes(1)
    expect(String(advarsel.mock.calls[0][0])).toContain("ikke koblet")
  })
})

describe("oppskriftene uten JavaScript", () => {
  /*
   * En iframe i sandkasse uten `allow-scripts` kjører ingen skript, så
   * web-komponentene finnes ikke, og markupen må klare seg selv. Stilarkene
   * legges inn som tekst; `@import` løses ikke opp i en `srcdoc`, så hvert
   * stilark oppskriften lenker til, tas med for seg.
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
      <div id="ugyldig">${FELT.replace(" hidden>", ">").replaceAll('"navn"', '"navn-ugyldig"')}</div>
      ${FORSLAG}
      ${AVKRYSSING(false)}`
    await new Promise((r) => {
      iframe.onload = r
      document.body.append(iframe)
    })
    dokument = iframe.contentDocument as Document
  })

  it("kjører ingen skript", () => {
    // Skriptet i sandkassen ville satt et merke. Det står ikke der.
    expect(dokument.documentElement.dataset.skript).toBeUndefined()
    expect(dokument.defaultView?.customElements.get("fs-field")).toBeUndefined()
  })

  it("hvert felt har et navn fra ledeteksten", () => {
    for (const input of dokument.querySelectorAll("input")) {
      expect(input.labels?.length, input.outerHTML).toBe(1)
      expect(input.labels?.[0]?.htmlFor).toBe(input.id)
    }
  })

  it("påkrevd-merket synes", () => {
    const label = dokument.querySelector("label[for='navn']") as HTMLElement
    const etter = dokument.defaultView?.getComputedStyle(label, "::after")
    expect(etter?.content).toContain("*")
  })

  it("feilmeldingen fra serveren synes, og den skjulte ikke", () => {
    const vindu = dokument.defaultView as Window
    const skjult = dokument.querySelector(
      ".fs-error-text[hidden]",
    ) as HTMLElement
    const synlig = dokument.querySelector(
      "#ugyldig .fs-error-text",
    ) as HTMLElement
    expect(vindu.getComputedStyle(skjult).display).toBe("none")
    expect(vindu.getComputedStyle(synlig).display).toBe("block")
  })

  it("lista i forslagsfeltet står ikke åpen", () => {
    const liste = dokument.querySelector(".fs-suggestion__list") as HTMLElement
    expect(dokument.defaultView?.getComputedStyle(liste).display).toBe("none")
  })
})

/*
 * Sprettoppvinduet: komponenten skriver aldri id på panelet. Med id fra malen,
 * som oppskriften, og uten, kjenner Datastar og idiomorph panelet igjen, så
 * det står åpent med fokus der det var. Skrev komponenten en id selv, ble
 * panelet byttet ut. `innerHTML` bytter ut alt, også verten.
 */
const SPRETT = oppskrift(sprettSide, "fs-popover")
const SPRETT_BAR = SPRETT.replace(' id="handlinger"', "")

describe("sprettoppvinduet gjennom en oppdatering fra serveren", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("leser oppskriften fra komponentsiden, med id på panelet", () => {
    expect(SPRETT).toContain('class="fs-popover" id="handlinger"')
    expect(SPRETT_BAR).not.toContain("handlinger")
  })

  for (const [navn, markup] of [
    ["oppskriften", SPRETT],
    ["bar markup uten id", SPRETT_BAR],
  ] as const) {
    for (const maate of MAATER) {
      it(`${navn}: ${maate}`, async () => {
        await monter(markup)
        const knapp = document.querySelector(
          "fs-popover > button",
        ) as HTMLElement
        const panel = document.querySelector(".fs-popover") as HTMLElement
        knapp.click()
        await roSeg()
        const valg = panel.querySelector("button") as HTMLElement
        valg.focus()
        expect(panel.matches(":popover-open")).toBe(true)

        await oppdater(maate, markup)

        const etter = document.querySelector(".fs-popover") as HTMLElement
        expect(etter.hasAttribute("id")).toBe(markup === SPRETT)
        if (maate === "innerHTML") {
          expect(etter).not.toBe(panel)
        } else {
          expect(etter).toBe(panel)
          expect(etter.matches(":popover-open")).toBe(true)
          expect(document.activeElement).toBe(valg)
        }
        ;(
          document.querySelector("fs-popover") as HTMLElement & { hide(): void }
        ).hide()
      })
    }
  }
})
