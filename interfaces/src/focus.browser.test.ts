/// <reference path="./types/css.d.ts" />

import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { mount, waitForPaint } from "./testing/a11y"
import { lightCells } from "./tokens/matrix-cells"

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
 * `--lt-focus-ring`, brukt i tjue regler fordelt på atten stilark.
 *
 * Fram til nå fantes det ikke én eneste påstand om `outline` i hele
 * testrekka. Ringen kunne altså forsvinne fra en komponent uten at noe sa
 * fra, og `package-css.browser.test.ts` leser bare teksten i stilarkene: den
 * ser at ingen skriver ringen ut for hånd, ikke at fokus er synlig.
 *
 * Testen tabber seg gjennom siden slik en tastaturbruker gjør. Et
 * programmert `focus()` duger ikke: `:focus-visible` treffer bare når
 * nettleseren mener fokuset skal vises, og et fokus satt fra kode etter et
 * museklikk teller ikke.
 */

/** Ett av hvert som kan få fokus, med markupen serveren ville sendt. */
const SIDEN = `
  <a class="lt-skip-link" href="#hoved">Hopp til innhold</a>

  <nav class="lt-breadcrumbs" aria-label="Du er her">
    <ol><li><a href="#start">Start</a></li><li><a href="#sak">Saken din</a></li></ol>
  </nav>

  <a class="lt-link" href="#vilkar">Les vilkårene</a>
  <button class="lt-button" type="button">Send søknad</button>

  <label class="lt-label" for="epost">E-postadresse</label>
  <input class="lt-input" id="epost" type="email" />

  <label class="lt-label" for="melding">Melding</label>
  <textarea class="lt-textarea" id="melding"></textarea>

  <label class="lt-label" for="fylke">Fylke</label>
  <select class="lt-select" id="fylke"><option>Vestland</option></select>

  <label class="lt-label" for="samtykke">Jeg samtykker</label>
  <input class="lt-checkbox" id="samtykke" type="checkbox" />

  <label class="lt-label" for="post">Post</label>
  <input class="lt-radio" id="post" type="radio" name="levering" />

  <label class="lt-label" for="varsler">Varsler</label>
  <input class="lt-switch" id="varsler" type="checkbox" role="switch" />

  <label class="lt-label" for="vedlegg">Vedlegg</label>
  <input class="lt-file-upload" id="vedlegg" type="file" />

  <button class="lt-tag" data-selectable aria-pressed="false" type="button">Innvilget</button>

  <a class="lt-card" data-interactive href="#saken">Saken din</a>

  <details class="lt-accordion"><summary>Hva betyr dette?</summary><p>Svaret.</p></details>

  <nav class="lt-pagination" aria-label="Sider">
    <ul><li><button type="button">1</button></li><li><button type="button">2</button></li></ul>
  </nav>

  <table class="lt-table">
    <thead><tr><th scope="col" aria-sort="ascending"><button class="lt-table__sort" type="button">Dato</button></th></tr></thead>
  </table>

  <fieldset class="lt-toggle-group">
    <label class="lt-toggle-group__option">
      <input type="radio" name="visning" /> Kart
    </label>
  </fieldset>
`

/**
 * Ringen brukeren faktisk ser når dette elementet har fokus.
 *
 * Som rule står den på elementet selv. Ligger den på en forelder, som når
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

/**
 * Alt som kan få fokus, med ringen hvert av dem har.
 *
 * Ett ekte Tab, og så `focus()` fra kode på resten. Nettleseren regner fokus
 * som tastaturstyrt etter et tastetrykk, så et programmert `focus()` etterpå
 * får `:focus-visible` også. Det er etterprøvd i alle tre motorene. Første
 * utgave tabbet seg gjennom med 24 rundturer til nettleseren, og på en
 * travel maskin tok de over femten sekunder i Firefox: testen feilet på
 * klokka, ikke på noe den sjekker.
 */
async function fokuserGjennom() {
  const funnet: Array<{ hvem: string; bredde: string; stil: string }> = []

  await userEvent.tab()

  const kandidater = [
    ...document.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, summary, [tabindex]",
    ),
  ]

  for (const kandidat of kandidater) {
    kandidat.focus()
    if (document.activeElement !== kandidat) continue
    if (!kandidat.matches(":focus-visible")) continue
    const aktiv = kandidat

    // Ringen ligger ikke alltid på elementet som har fokus. I
    // `.lt-toggle-group` er radioknappen usynlig, og valget rundt den tegner
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
  it("gir hver kontroll en ring på to pixels", async () => {
    mount(SIDEN)
    await waitForPaint()

    const funnet = await fokuserGjennom()

    // Uten dette kunne en endring i markupen gjort sveipet tomt, og en tom
    // liste ville meldt grønt.
    expect(funnet.length, "fant ingenting med synlig fokus").toBeGreaterThan(12)

    const uten = funnet.filter((f) => f.stil !== "solid" || f.bredde !== "2px")

    expect(
      uten.map((f) => `${f.hvem}: ${f.bredde} ${f.stil}`),
      "disse mangler fokusringen",
    ).toEqual([])
  })

  it("henter ringen fra tokenet, ikke fra hver komponent", async () => {
    mount(`<button class="lt-button" type="button">Send</button>`)
    await waitForPaint()

    const ring = getComputedStyle(document.documentElement)
      .getPropertyValue("--lt-focus-ring")
      .trim()

    /*
     * Verdien er regnet ut her, så `var()` er alt løst opp.
     *
     * Fargen leses av matrisen framfor å skrives av: ringen skal følge
     * `accent-border-strong`, og en test som gjentar heksverdien ville måttet
     * rettes hver gang kontrakten flytter en lyshet.
     */
    const forventet = lightCells["--lt-color-accent-border-strong"]

    expect(ring).toMatch(/^2px solid /)
    expect(ring.toLowerCase()).toContain(forventet.toLowerCase())
  })
})
