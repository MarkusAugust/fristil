/**
 * At felt og forslagsfelt overlever at serveren sender området på nytt, på
 * hver av de tre måtene en side oppdateres på.
 *
 * Datastar og idiomorph, som htmx morfer med, kjenner igjen et element på id.
 * Et element uten id beholdes, og et element med en id serveren ikke sendte,
 * byttes ut. Komponentene skriver derfor aldri id på feltet: `for` og `id`
 * kommer fra malen, eller så står ledeteksten rundt feltet. Testen kjører den
 * markupen dokumentasjonen viser gjennom ekte Datastar, ekte idiomorph og et
 * vanlig `innerHTML`-bytte, og krever det som gjelder for hver av dem:
 *
 * - Datastar og idiomorph beholder feltet, fokus og teksten. Idiomorph kjøres
 *   med `ignoreActiveValue`, slik htmx-brukere setter den; uten den setter
 *   idiomorph verdien fra serverens HTML også i feltet med fokus.
 * - `innerHTML` bytter ut alt. Det nye feltet skal være koblet på nytt.
 *
 * Skriver en komponent igjen en id på feltet, byttes feltet ut av begge
 * morferne, og testene for bar markup feller.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineFsField } from "./components/ramme/field/fs-field"
import { defineFsSuggestion } from "./components/ramme/suggestion/fs-suggestion"
import { ventPaTegning } from "./testing/a11y"
import { Idiomorph } from "./testing/idiomorph/idiomorph-v0.8.0.js"

import "./testing/datastar/datastar-v1.0.4.js"

type Maate = "Datastar" | "idiomorph" | "innerHTML"
const MAATER: Maate[] = ["Datastar", "idiomorph", "innerHTML"]

/** Området serveren sender, med id så Datastar finner det. */
const omraade = (innhold: string) => `<div id="omraade">${innhold}</div>`

function oppdater(maate: Maate, innhold: string): void {
  const rot = document.getElementById("omraade") as HTMLElement
  if (maate === "Datastar") {
    // Som en `datastar-patch-elements` uten selektor: `outer` på id-en.
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-elements",
          el: document.body,
          argsRaw: { elements: omraade(innhold) },
        },
      }),
    )
  } else if (maate === "idiomorph") {
    Idiomorph.morph(rot, omraade(innhold), {
      morphStyle: "outerHTML",
      ignoreActiveValue: true,
    })
  } else {
    rot.innerHTML = innhold
  }
}

/** Venter til observatørene og `warnAboutMarkup` har kjørt. */
async function roSeg() {
  await ventPaTegning()
  await ventPaTegning()
}

const FELT_FOR_ID = `
  <fs-field>
    <label class="fs-label" for="navn">Fullt navn</label>
    <input class="fs-input" id="navn" name="navn" type="text">
    <p class="fs-help-text">Slik det står i passet.</p>
  </fs-field>`

const FELT_RUNDT = `
  <fs-field>
    <label class="fs-label">Fullt navn <input class="fs-input" name="navn" type="text"></label>
    <p class="fs-help-text">Slik det står i passet.</p>
  </fs-field>`

const FORSLAG = `
  <fs-suggestion>
    <label class="fs-label" for="kommune">Kommune</label>
    <div class="fs-suggestion__field">
      <input class="fs-input" id="kommune" name="kommune" type="text">
      <ul class="fs-suggestion__list"><li>Bergen</li><li>Bodø</li><li>Oslo</li></ul>
      <span class="fs-sr-only" role="status"></span>
    </div>
  </fs-suggestion>`

const FORSLAG_RUNDT = `
  <fs-suggestion>
    <div class="fs-suggestion__field">
      <label class="fs-label">Kommune <input class="fs-input" name="kommune" type="text"></label>
      <ul class="fs-suggestion__list"><li>Bergen</li><li>Bodø</li><li>Oslo</li></ul>
      <span class="fs-sr-only" role="status"></span>
    </div>
  </fs-suggestion>`

describe("felt og forslagsfelt gjennom en oppdatering fra serveren", () => {
  beforeAll(() => {
    defineFsField()
    defineFsSuggestion()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  async function monter(innhold: string) {
    document.body.innerHTML = omraade(innhold)
    await roSeg()
  }

  for (const maate of MAATER) {
    for (const [navn, markup] of [
      ["for og id fra malen", FELT_FOR_ID],
      ["ledeteksten rundt feltet, ingen id", FELT_RUNDT],
    ] as const) {
      it(`felt med ${navn}: ${maate}`, async () => {
        const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
        await monter(markup)
        const foer = document.querySelector("input") as HTMLInputElement
        foer.focus()
        foer.value = "Kari"

        oppdater(maate, markup)
        await roSeg()

        const etter = document.querySelector("input") as HTMLInputElement
        const hjelp = document.querySelector(".fs-help-text") as HTMLElement
        if (maate === "innerHTML") {
          // Alt er nytt. Det nye feltet skal være koblet, og ingen id fra
          // komponenten skal ha kommet på det.
          expect(etter).not.toBe(foer)
        } else {
          expect(etter).toBe(foer)
          expect(etter.value).toBe("Kari")
          expect(document.activeElement).toBe(etter)
        }
        expect(etter.getAttribute("aria-describedby")).toBe(hjelp.id)
        expect(etter.id).toBe(markup === FELT_FOR_ID ? "navn" : "")
        expect(etter.labels?.[0]?.textContent).toContain("Fullt navn")
        expect(advarsel).not.toHaveBeenCalled()
      })
    }

    for (const [navn, markup] of [
      ["for og id fra malen", FORSLAG],
      ["ledeteksten rundt feltet, ingen id", FORSLAG_RUNDT],
    ] as const) {
      it(`forslagsfelt med ${navn}: ${maate}`, async () => {
        const advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
        await monter(markup)
        const foer = document.querySelector("input") as HTMLInputElement
        foer.focus()
        foer.value = "B"
        foer.dispatchEvent(new Event("input", { bubbles: true }))
        await roSeg()

        oppdater(maate, markup)
        await roSeg()

        const etter = document.querySelector("input") as HTMLInputElement
        expect(etter.id).toBe(markup === FORSLAG ? "kommune" : "")
        if (maate === "innerHTML") {
          expect(etter).not.toBe(foer)
        } else {
          expect(etter).toBe(foer)
          expect(etter.value).toBe("B")
          expect(document.activeElement).toBe(etter)
        }
        expect(etter.getAttribute("role")).toBe("combobox")
        expect(etter.getAttribute("aria-controls")).toBe(
          document.querySelector("ul")?.id,
        )
        expect(advarsel).not.toHaveBeenCalled()
      })
    }
  }

  for (const maate of ["Datastar", "idiomorph"] as const) {
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
            return `<fs-field><label class="fs-label" for="merknad-${k}">${n}</label><input class="fs-input" id="merknad-${k}" name="merknad-${k}"></fs-field>`
          })
          .join("")
      await monter(liste(["Bergen", "Oslo"]))
      const bergen = document.getElementById(
        "merknad-bergen",
      ) as HTMLInputElement
      bergen.focus()
      bergen.value = "Vestland"

      oppdater(maate, liste(["Arendal", "Bergen", "Oslo"]))
      await roSeg()

      expect(
        (document.getElementById("merknad-arendal") as HTMLInputElement).value,
      ).toBe("")
      expect(document.getElementById("merknad-bergen")).toBe(bergen)
      expect(bergen.value).toBe("Vestland")
    })
  }
})
