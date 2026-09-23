/// <reference path="./types/css.d.ts" />

import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

import { monter, ventPaTegning } from "./testing/a11y"

import "./tokens/tokens.css"
import "./components/css/accordion/accordion.css"
import "./components/css/breadcrumbs/breadcrumbs.css"
import "./components/css/button/button.css"
import "./components/css/card/card.css"
import "./components/css/checkbox/checkbox.css"
import "./components/css/file-upload/file-upload.css"
import "./components/css/input/input.css"
import "./components/css/link/link.css"
import "./components/css/pagination/pagination.css"
import "./components/css/radio/radio.css"
import "./components/css/select/select.css"
import "./components/css/skip-link/skip-link.css"
import "./components/css/switch/switch.css"
import "./components/css/table/table.css"
import "./components/css/tag/tag.css"
import "./components/css/textarea/textarea.css"
import "./components/css/toggle-group/toggle-group.css"

/**
 * At alt som kan få tastaturfokus, viser det.
 *
 * WCAG 2.4.7 krever en synlig markering av hvor fokuset står, og 1.4.11 at
 * markeringen holder 3:1 mot flaten rundt. Systemet løser det med én ring,
 * `--semantic-focus-ring`, brukt i tjue regler fordelt på atten stilark.
 *
 * Fram til nå fantes det ikke én eneste påstand om `outline` i hele
 * testrekka. Ringen kunne altså forsvinne fra en komponent uten at noe sa
 * fra, og `pakke-css.browser.test.ts` leser bare teksten i stilarkene: den
 * ser at ingen skriver ringen ut for hånd, ikke at fokus er synlig.
 *
 * Testen tabber seg gjennom siden slik en tastaturbruker gjør. Et
 * programmert `focus()` duger ikke: `:focus-visible` treffer bare når
 * nettleseren mener fokuset skal vises, og et fokus satt fra kode etter et
 * museklikk teller ikke.
 */

/** Ett av hvert som kan få fokus, med markupen serveren ville sendt. */
const SIDEN = `
  <a class="fs-skip-link" href="#hoved">Hopp til innhold</a>

  <nav class="fs-breadcrumbs" aria-label="Du er her">
    <ol><li><a href="#start">Start</a></li><li><a href="#sak">Saken din</a></li></ol>
  </nav>

  <a class="fs-link" href="#vilkar">Les vilkårene</a>
  <button class="fs-button" type="button">Send søknad</button>

  <label class="fs-label" for="epost">E-postadresse</label>
  <input class="fs-input" id="epost" type="email" />

  <label class="fs-label" for="melding">Melding</label>
  <textarea class="fs-textarea" id="melding"></textarea>

  <label class="fs-label" for="fylke">Fylke</label>
  <select class="fs-select" id="fylke"><option>Vestland</option></select>

  <label class="fs-label" for="samtykke">Jeg samtykker</label>
  <input class="fs-checkbox" id="samtykke" type="checkbox" />

  <label class="fs-label" for="post">Post</label>
  <input class="fs-radio" id="post" type="radio" name="levering" />

  <label class="fs-label" for="varsler">Varsler</label>
  <input class="fs-switch" id="varsler" type="checkbox" role="switch" />

  <label class="fs-label" for="vedlegg">Vedlegg</label>
  <input class="fs-file-upload" id="vedlegg" type="file" />

  <button class="fs-tag" data-selectable aria-pressed="false" type="button">Innvilget</button>

  <a class="fs-card" data-interactive href="#saken">Saken din</a>

  <details class="fs-accordion"><summary>Hva betyr dette?</summary><p>Svaret.</p></details>

  <nav class="fs-pagination" aria-label="Sider">
    <ul><li><button type="button">1</button></li><li><button type="button">2</button></li></ul>
  </nav>

  <fieldset class="fs-toggle-group">
    <label class="fs-toggle-group__option">
      <input type="radio" name="visning" /> Kart
    </label>
  </fieldset>
`

/**
 * Ringen brukeren faktisk ser når dette elementet har fokus.
 *
 * Som regel står den på elementet selv. Ligger den på en forelder, som når
 * et valg tegner ringen med `:has(input:focus-visible)`, er det den som
 * gjelder.
 */
function ringenSomVises(element: HTMLElement): CSSStyleDeclaration {
  let node: HTMLElement | null = element

  while (node) {
    const stil = getComputedStyle(node)
    if (stil.outlineStyle === "solid" && stil.outlineWidth === "2px") {
      return stil
    }
    node = node.parentElement
  }

  return getComputedStyle(element)
}

/** Alt som fikk synlig fokus mens vi tabbet, med ringen hvert av dem har. */
async function tabbGjennom(steg: number) {
  const funnet: Array<{ hvem: string; bredde: string; stil: string }> = []

  for (let i = 0; i < steg; i++) {
    await userEvent.tab()
    const aktiv = document.activeElement

    if (!(aktiv instanceof HTMLElement) || aktiv === document.body) continue
    if (!aktiv.matches(":focus-visible")) continue

    // Ringen ligger ikke alltid på elementet som har fokus. I
    // `.fs-toggle-group` er radioknappen usynlig, og valget rundt den tegner
    // ringen med `:has(input:focus-visible)`. Det er ringen brukeren ser som
    // teller, så vi går oppover til vi finner den.
    const ring = ringenSomVises(aktiv)

    funnet.push({
      hvem: `${aktiv.tagName.toLowerCase()}${aktiv.id ? `#${aktiv.id}` : `.${String(aktiv.className).split(" ")[0]}`}`,
      bredde: ring.outlineWidth,
      stil: ring.outlineStyle,
    })
  }

  return funnet
}

describe("tastaturfokus er synlig", () => {
  it("gir hver kontroll en ring på to piksler", async () => {
    monter(SIDEN)
    await ventPaTegning()

    const funnet = await tabbGjennom(24)

    // Uten dette kunne en endring i markupen gjort sveipet tomt, og en tom
    // liste ville meldt grønt.
    expect(funnet.length, "fant ingenting med synlig fokus").toBeGreaterThan(12)

    const uten = funnet.filter((f) => f.stil !== "solid" || f.bredde !== "2px")

    expect(
      uten.map((f) => `${f.hvem}: ${f.bredde} ${f.stil}`),
      "disse mangler fokusringen",
    ).toEqual([])

    // Hver tabb er en tur til nettleseren, og 24 av dem tar over femten
    // sekunder i Firefox på en travel maskin. Testen feilet da tilfeldig på
    // klokka framfor på noe den sjekker, og en port som feiler tilfeldig blir
    // ignorert.
  }, 45_000)

  it("henter ringen fra tokenet, ikke fra hver komponent", async () => {
    monter(`<button class="fs-button" type="button">Send</button>`)
    await ventPaTegning()

    const ring = getComputedStyle(document.documentElement)
      .getPropertyValue("--semantic-focus-ring")
      .trim()

    // Verdien er regnet ut her, så `var()` er alt løst opp.
    expect(ring).toMatch(/^2px solid /)
    expect(ring).toMatch(/#1362ae|rgb\(19, 98, 174\)/)
  })
})
