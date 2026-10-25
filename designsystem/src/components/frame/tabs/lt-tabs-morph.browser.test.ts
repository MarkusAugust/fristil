/**
 * Hva som overlever en patch gjennom Datastars egen morfing.
 *
 * `morfing.browser.test.ts` kjører Datastars attributtløkke på de samme
 * nodene, og forutsetter dermed at morfingen beholder dem. Det gjør den ikke
 * alltid. Datastar v1.0.4 matcher gamle og nye elementer slik
 * (`isSoftMatch` i `library/src/plugins/watchers/patchElements.ts`):
 *
 * ```js
 * oldNode.tagName === newNode.tagName &&
 *   (!oldNode.id || oldNode.id === newNode.id)
 * ```
 *
 * Har elementet i siden en id, og serverens element har ingen eller en
 * annen, morfes det ikke. Det gamle fjernes og serverens settes inn. Lager
 * en komponent id-en selv, får hver patch fra en mal uten id-er dermed nye
 * noder, og det komponenten husket på den gamle noden er borte.
 *
 * Testene her kjører den ekte bundlen, ikke en gjengivelse av løkka:
 * `src/testing/datastar/datastar-v1.0.4.js`, hentet fra
 * `starfederation/datastar@v1.0.4/bundles/datastar.js` (sha256
 * `727844adfc825ee651fb93c544a2a739986f9a21820a94524b35f0cac470cf91`), med
 * den siste linja, `//# sourceMappingURL=datastar.js.map`, fjernet så Vite
 * ikke leter etter et kart som ikke er med. Det er versjonen
 * `agent/datastar.md` peker på. Fila ligger her fordi pakken på npm,
 * `@starfederation/datastar`, stopper på 1.0.0-beta.11: 1.0.x finnes bare
 * som fil i Git-repoet og på CDN. Patchen sendes som den samme
 * `datastar-fetch`-hendelsen SSE-leseren selv sender når den har tolket en
 * `datastar-patch-elements`, og én test går hele veien gjennom `@get` og en
 * strøm, så vi vet at snarveien er den samme.
 *
 * Fanene skriver ingen id: lenkene har ingen, og panelenes id kommer fra
 * serveren, siden `href` krever den. Datastar morfer dem derfor inn i de
 * gamle nodene, og valget står. Overskriften i panelet får id av komponenten,
 * for den har ingenting brukeren kan miste. Felt, forslagsfelt og
 * sprettoppvindu sier fra i konsollen når en patch byttet ut det brukeren
 * hadde gjort noe med, se den siste gruppa.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest"

import { ventPaTegning } from "../../../testing/a11y"
import { settAdresse } from "../../../testing/adresse"
import { attr } from "../../../testing/markup"
import { defineFsField } from "../field/fs-field"
import { defineFsPopover } from "../popover/fs-popover"
import { defineFsSuggestion } from "../suggestion/fs-suggestion"
import { defineFsTabs } from "./fs-tabs"
import { tabs } from "./tabs"

import "../../../testing/datastar/datastar-v1.0.4.js"

/** Patcher som en `datastar-patch-elements` uten selektor: `outer` på id-en. */
function patch(elements: string): void {
  document.dispatchEvent(
    new CustomEvent("datastar-fetch", {
      detail: {
        type: "datastar-patch-elements",
        el: document.body,
        argsRaw: { elements },
      },
    }),
  )
}

/** Om hver node fortsatt er den samme. */
function sammeNoder(før: Element[], etter: Element[]): boolean[] {
  return før.map((node, i) => node === etter[i])
}

const NAVN = ["Søknaden", "Vedlegg", "Meldinger"]
const NOKLER = ["soknaden", "vedlegg", "meldinger"]

/**
 * Fanerad slik en Go- eller Kotlin-mal skriver den uten `fs.tabs()`: lenker
 * uten id, og id bare på panelene, som lenkene krever.
 */
const BAR = `<fs-tabs id="saken">
  <ul class="fs-tabs__list" aria-label="Deler av saken">
    ${NAVN.map((n, i) => `<li><a href="#${NOKLER[i]}">${n}</a></li>`).join("\n    ")}
  </ul>
  ${NAVN.map((n, i) => `<section class="fs-tabs__panel" id="${NOKLER[i]}"><h2>${n}</h2><p>Innhold</p></section>`).join("\n  ")}
</fs-tabs>`

/** Det `fs.tabs()` skriver: lenker, panelenes id, overskriftenes id og klassene. */
const FANER = tabs({ id: "sak", keys: NOKLER, label: "Deler av saken" })
const FRA_BYGGEFUNKSJONEN = `<fs-tabs id="saken">
  <ul ${attr(FANER.list)}>
    ${FANER.tabs.map((t, i) => `<li><a ${attr(t)}>${NAVN[i]}</a></li>`).join("\n    ")}
  </ul>
  ${FANER.panels.map((p, i) => `<section ${attr(p)}><h2 ${attr(FANER.headings[i])}>${NAVN[i]}</h2><p>Innhold</p></section>`).join("\n  ")}
</fs-tabs>`

function faner(): HTMLAnchorElement[] {
  return [
    ...document.querySelectorAll<HTMLAnchorElement>("#saken .fs-tabs__list a"),
  ]
}

function paneler(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("#saken .fs-tabs__panel")]
}

function valgt(): (string | null)[] {
  return faner().map((fane) => fane.getAttribute("aria-selected"))
}

/** Klikker fane 2, patcher med `markup`, og sier hva som overlevde. */
async function klikkOgPatch(markup: string) {
  document.body.innerHTML = markup
  await customElements.whenDefined("fs-tabs")
  await ventPaTegning()

  const faneFør = faner()
  const panelFør = paneler()
  faneFør[1].click()
  await ventPaTegning()
  expect(valgt()).toEqual(["false", "true", "false"])

  const meldt: number[] = []
  const lytter = new AbortController()
  document.addEventListener(
    "tab-select",
    (e) => meldt.push((e as CustomEvent<{ index: number }>).detail.index),
    { signal: lytter.signal },
  )
  patch(markup)
  await ventPaTegning()
  lytter.abort()

  return {
    faner: sammeNoder(faneFør, faner()),
    paneler: sammeNoder(panelFør, paneler()),
    valgt: valgt(),
    skjult: paneler().map((p) => p.hasAttribute("hidden")),
    hidden: paneler().map((p) => p.getAttribute("hidden")),
    lenkeIder: faner().map((f) => f.id),
    navn: paneler().map((p) => {
      const peker = p.getAttribute("aria-labelledby")
      return peker ? document.getElementById(peker)?.textContent : null
    }),
    meldt,
  }
}

describe("fs-tabs gjennom Datastars morfing", () => {
  beforeAll(() => {
    defineFsTabs()
  })

  beforeEach(async () => {
    // Et klikk på en fane skriver adressen, og komponenten leser den ved
    // lasting.
    await settAdresse("")
  })

  it("bar markup: lenkene og panelene morfes, og valget står", async () => {
    /*
     * Komponenten skriver ingen id på lenkene, og panelenes id kommer fra
     * serveren. Datastar har dermed noe å kjenne igjen i begge, og morfer dem
     * inn i de gamle nodene. `chosenTab` peker på en node som fortsatt står
     * i siden, og valget settes tilbake etter at morfingen tok
     * `aria-selected`, `tabindex` og `hidden`.
     */
    const r = await klikkOgPatch(BAR)
    expect(r.faner).toEqual([true, true, true])
    expect(r.paneler).toEqual([true, true, true])
    expect(r.valgt).toEqual(["false", "true", "false"])
    expect(r.skjult).toEqual([true, false, true])
    expect(r.lenkeIder).toEqual(["", "", ""])
    expect(r.meldt).toEqual([])
  })

  it("bar markup: panelene beholder navnet fra overskriften", async () => {
    // Overskriften har ingen id fra serveren, så den kan byttes ut. Den nye
    // får den samme id-en tilbake, og panelet peker fortsatt på den.
    const r = await klikkOgPatch(BAR)
    expect(r.navn).toEqual(NAVN)
  })

  it("markup fra fs.tabs(): det samme, og panelene skjules med until-found", async () => {
    const r = await klikkOgPatch(FRA_BYGGEFUNKSJONEN)
    expect(r.faner).toEqual([true, true, true])
    expect(r.paneler).toEqual([true, true, true])
    expect(r.valgt).toEqual(["false", "true", "false"])
    expect(r.hidden).toEqual(["until-found", null, "until-found"])
    expect(r.navn).toEqual(NAVN)
    expect(r.meldt).toEqual([])
  })

  it("bar markup i en patch som omslutter raden: det samme", async () => {
    /*
     * Serveren patcher ofte et område, ikke selve raden. Da har `<fs-tabs>`
     * ingen id, og morfes inn i den gamle, og lenkene inni beholdes på samme
     * måte.
     */
    const side = (innhold: string) => `<main id="side">${innhold}</main>`
    const uten = BAR.replace(' id="saken"', ' class="saken"')
    document.body.innerHTML = side(uten)
    await ventPaTegning()
    const lenker = () => [
      ...document.querySelectorAll("#side .fs-tabs__list a"),
    ]
    const før = lenker()
    ;(før[1] as HTMLElement).click()
    await ventPaTegning()

    patch(side(uten))
    await ventPaTegning()

    expect(sammeNoder(før, lenker())).toEqual([true, true, true])
    expect(lenker().map((k) => k.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ])
  })

  it("hele veien gjennom @get og en SSE-strøm gir det samme", async () => {
    /*
     * Samme scenario som den første testen, men patchen kommer som en ekte
     * `datastar-patch-elements` i en `text/event-stream`, hentet av
     * `data-on:click="@get(…)"`. Bekrefter at hendelsen over er den samme
     * veien bundlen selv går.
     */
    const oppdatert = BAR.replace("<p>Innhold</p>", "<p>Oppdatert</p>")
    const strøm = [
      "event: datastar-patch-elements",
      ...oppdatert.split("\n").map((linje) => `data: elements ${linje}`),
      "",
      "",
    ].join("\n")
    const hent = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(strøm, {
          headers: { "Content-Type": "text/event-stream" },
        }),
    )

    try {
      document.body.innerHTML = `${BAR}
        <button id="oppdater" data-on:click="@get('/saken')">Oppdater</button>`
      await ventPaTegning()
      // Datastar leser `data-*` i en `setTimeout` etter at noden kom.
      await new Promise((ferdig) => setTimeout(ferdig, 20))

      const før = faner()
      const panelFør = paneler()
      før[1].click()
      await ventPaTegning()
      expect(valgt()).toEqual(["false", "true", "false"])

      document.getElementById("oppdater")?.click()
      // Lenkene beholdes, så patchen kjennes på innholdet i det første panelet.
      await vi.waitFor(() =>
        expect(paneler()[0].textContent).toContain("Oppdatert"),
      )
      await ventPaTegning()

      expect(hent).toHaveBeenCalledOnce()
      expect(sammeNoder(før, faner())).toEqual([true, true, true])
      expect(sammeNoder(panelFør, paneler())).toEqual([true, true, true])
      expect(valgt()).toEqual(["false", "true", "false"])
    } finally {
      // Ellers svarte `fetch` med denne strømmen i resten av fila etter en
      // feil her.
      hent.mockRestore()
    }
  })
})

describe("fs-suggestion gjennom Datastars morfing", () => {
  beforeAll(() => {
    defineFsSuggestion()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  /** Bar markup fra en mal: ledeteksten rundt feltet, ingen id-er, ingen roller. */
  const FORSLAG_BAR = `<fs-suggestion id="kommune-vert">
  <div>
    <label>Kommune <input class="fs-input"></label>
    <ul class="fs-suggestion__list"><li>Bergen</li><li>Bodø</li><li>Oslo</li></ul>
    <span class="fs-sr-only" role="status"></span>
  </div>
</fs-suggestion>`

  const FORSLAG_MED_ID = `<fs-suggestion id="kommune-vert">
  <label for="kommune">Kommune</label>
  <div>
    <input class="fs-input" id="kommune">
    <ul class="fs-suggestion__list" id="kommune-list"><li id="kommune-option-0">Bergen</li><li id="kommune-option-1">Bodø</li><li id="kommune-option-2">Oslo</li></ul>
    <span class="fs-sr-only" role="status"></span>
  </div>
</fs-suggestion>`

  async function skrivOgPatch(markup: string) {
    document.body.innerHTML = markup
    await customElements.whenDefined("fs-suggestion")
    await ventPaTegning()

    const felt = document.querySelector("input") as HTMLInputElement
    const liste = document.querySelector("ul") as HTMLElement
    felt.focus()
    felt.value = "B"
    felt.dispatchEvent(new Event("input", { bubbles: true }))
    felt.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    )
    await ventPaTegning()
    expect(felt.getAttribute("aria-expanded")).toBe("true")

    patch(markup)
    await ventPaTegning()

    const nyttFelt = document.querySelector("input") as HTMLInputElement
    return {
      sammeFelt: nyttFelt === felt,
      sammeListe: document.querySelector("ul") === liste,
      verdi: nyttFelt.value,
      fokus: document.activeElement === nyttFelt,
      åpen: nyttFelt.getAttribute("aria-expanded"),
    }
  }

  it("bar markup: feltet morfes, og det brukeren skrev og fokus står", async () => {
    /*
     * Komponenten skriver ingen id på feltet, så Datastar har ingenting å
     * kjenne det igjen på og morfer det. Lista får id fra komponenten og
     * byttes ut, men den har ingen tilstand brukeren mister: komponenten
     * kobler den nye og åpner den igjen.
     */
    const { sammeListe: _, ...r } = await skrivOgPatch(FORSLAG_BAR)
    expect(r).toEqual({
      sammeFelt: true,
      verdi: "B",
      fokus: true,
      åpen: "true",
    })
  })

  it("id fra serveren: feltet morfes, og teksten, fokus og lista står", async () => {
    const r = await skrivOgPatch(FORSLAG_MED_ID)
    expect(r).toEqual({
      sammeFelt: true,
      sammeListe: true,
      verdi: "B",
      fokus: true,
      åpen: "true",
    })
  })
})

describe("fs-popover gjennom Datastars morfing", () => {
  beforeAll(() => {
    defineFsPopover()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  const MENY_BAR = `<fs-popover id="meny-vert">
  <button class="fs-button">Handlinger</button>
  <div class="fs-popover"><button>Slett</button></div>
</fs-popover>`

  /** Id fra serveren, men `popover` overlatt til komponenten. */
  const MENY_MED_ID = `<fs-popover id="meny-vert">
  <button class="fs-button" aria-controls="meny">Handlinger</button>
  <div class="fs-popover" id="meny"><button>Slett</button></div>
</fs-popover>`

  /** Det `fs.popover()` og Kotlin-bindingen skriver. */
  const MENY_MANUAL = `<fs-popover id="meny-vert">
  <button class="fs-button" aria-controls="meny">Handlinger</button>
  <div class="fs-popover" id="meny" popover="manual"><button>Slett</button></div>
</fs-popover>`

  async function åpneOgPatch(markup: string) {
    document.body.innerHTML = markup
    await customElements.whenDefined("fs-popover")
    await ventPaTegning()

    const knapp = document.querySelector("fs-popover > button") as HTMLElement
    const panel = document.querySelector(".fs-popover") as HTMLElement
    knapp.click()
    await ventPaTegning()
    const slett = panel.querySelector("button") as HTMLButtonElement
    slett.focus()
    expect(panel.matches(":popover-open")).toBe(true)

    patch(markup)
    await ventPaTegning()

    const nyttPanel = document.querySelector(".fs-popover") as HTMLElement
    return {
      sammeKnapp: document.querySelector("fs-popover > button") === knapp,
      sammePanel: nyttPanel === panel,
      åpent: nyttPanel.matches(":popover-open"),
      fokusIPanelet: nyttPanel.contains(document.activeElement),
    }
  }

  it("bar markup: panelet morfes, står åpent, og fokus står", async () => {
    // Komponenten skriver ingen id på panelet, så panelet i siden og det
    // serveren sender er det samme for morfingen. Skrev den en id, ble
    // panelet byttet ut, og fokus var borte.
    const r = await åpneOgPatch(MENY_BAR)
    expect(r).toEqual({
      sammeKnapp: true,
      sammePanel: true,
      åpent: true,
      fokusIPanelet: true,
    })
  })

  it("id fra serveren uten popover: panelet morfes og står åpent", async () => {
    /*
     * Serveren sendte ikke `popover`, så morfingen tar det sammen med `open`
     * på verten. Komponenten lukker, gjenåpner i neste mikrotask, og så
     * kommer «closed» fra lukkingen som en egen oppgave. Den ble tatt som
     * brukerens lukking, og vinduet sto lukket etter patchen.
     */
    const r = await åpneOgPatch(MENY_MED_ID)
    expect(r).toEqual({
      sammeKnapp: true,
      sammePanel: true,
      åpent: true,
      fokusIPanelet: true,
    })
  })

  it("id og popover fra serveren: panelet morfes, står åpent, og fokus står", async () => {
    const r = await åpneOgPatch(MENY_MANUAL)
    expect(r).toEqual({
      sammeKnapp: true,
      sammePanel: true,
      åpent: true,
      fokusIPanelet: true,
    })
  })
})

describe("komponentene sier fra når en patch byttet ut elementene", () => {
  let advarsel: MockInstance<typeof console.warn>

  beforeAll(() => {
    defineFsTabs()
    defineFsSuggestion()
    defineFsField()
    defineFsPopover()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
    advarsel = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    advarsel.mockRestore()
  })

  /** Advarslene som nevner at noe ble byttet ut. */
  function meldinger(): string[] {
    return advarsel.mock.calls
      .map((call) => String(call[0]))
      .filter((m) => m.includes("byttet ut"))
  }

  /**
   * Venter til `warnAboutMarkup` har sjekket vilkåret sitt.
   *
   * Den venter to tegninger etter at patchen landet, og dens to er
   * registrert etter testens to, så én `ventPaTegning` er for lite.
   */
  async function roSeg() {
    await ventPaTegning()
    await ventPaTegning()
  }

  /** Patcher som en `datastar-patch-elements` med selektor og modus. */
  function patchInni(selector: string, elements: string): void {
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-elements",
          el: document.body,
          argsRaw: { selector, mode: "inner", elements },
        },
      }),
    )
  }

  it("fs-tabs: sier ikke fra, for komponenten skriver ingen id som kan byttes ut", async () => {
    await klikkOgPatch(BAR)
    await roSeg()
    expect(meldinger()).toEqual([])

    faner()[1].click()
    await ventPaTegning()
    patch(BAR)
    await roSeg()
    expect(valgt()).toEqual(["false", "true", "false"])
    expect(meldinger()).toEqual([])
  })

  it("fs-tabs: ikke ved en smal patch, der valget står", async () => {
    document.body.innerHTML = BAR
    await ventPaTegning()
    faner()[1].click()
    await ventPaTegning()

    patchInni("#saken > section:last-child", "Tre nye meldinger.")
    await roSeg()
    expect(valgt()).toEqual(["false", "true", "false"])
    expect(paneler()[2].textContent).toBe("Tre nye meldinger.")
    // Overskriften forsvant i patchen, så navnet er teksten på fanen.
    expect(paneler()[2].getAttribute("aria-label")).toBe("Meldinger")
    expect(meldinger()).toEqual([])
  })

  const FORSLAG = (id: string) => `<fs-suggestion id="kommune-vert">
  <label for="${id}">Kommune</label>
  <div>
    <input class="fs-input" name="kommune" id="${id}">
    <ul class="fs-suggestion__list"><li>Bergen</li><li>Bodø</li></ul>
    <span class="fs-sr-only" role="status"></span>
  </div>
</fs-suggestion>`

  async function skrivOgPatchForslag(markup: string, tekst: string) {
    document.body.innerHTML = markup
    await ventPaTegning()
    const felt = document.querySelector("input") as HTMLInputElement
    felt.focus()
    felt.value = tekst
    felt.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()
    patch(markup)
    await roSeg()
  }

  it("fs-suggestion: når id-en fra serveren endret seg mellom to rendringer", async () => {
    document.body.innerHTML = FORSLAG("kommune-1")
    await ventPaTegning()
    const felt = document.querySelector("input") as HTMLInputElement
    felt.focus()
    felt.value = "B"
    felt.dispatchEvent(new Event("input", { bubbles: true }))
    await ventPaTegning()
    patch(FORSLAG("kommune-2"))
    await roSeg()
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "fs-suggestion: en oppdatering fra serveren byttet ut feltet",
    )
  })

  it("fs-suggestion: ikke når serveren skrev den samme id-en", async () => {
    await skrivOgPatchForslag(FORSLAG("kommune"), "B")
    expect(meldinger()).toEqual([])
  })

  /** Et felt med ledeteksten rundt seg, og eventuelt en id fra serveren. */
  const FELT = (id: string, verdi = "") => `<fs-field id="navn-vert">
  <label>Navn <input class="fs-input" name="navn"${id}${verdi}></label>
</fs-field>`

  async function skrivOgPatchFelt(foer: string, etter: string, tekst: string) {
    document.body.innerHTML = foer
    await ventPaTegning()
    const felt = document.querySelector("input") as HTMLInputElement
    felt.value = tekst
    patch(etter)
    await roSeg()
    return felt
  }

  it("fs-field: bar markup beholder feltet og teksten, uten advarsel", async () => {
    /*
     * Komponenten skriver ingen id på kontrollen, så Datastar har ingenting å
     * kjenne den igjen på og morfer den. Noden, og teksten brukeren skrev,
     * står. Før skrev komponenten en id, og nettopp den gjorde at feltet ble
     * byttet ut.
     */
    const gammel = await skrivOgPatchFelt(FELT(""), FELT(""), "Kari")
    const felt = document.querySelector("input") as HTMLInputElement
    expect(felt).toBe(gammel)
    expect(felt.value).toBe("Kari")
    expect(meldinger()).toEqual([])
  })

  it("fs-field: når id-en fra serveren endret seg mellom to rendringer", async () => {
    await skrivOgPatchFelt(FELT(' id="navn-1"'), FELT(' id="navn-2"'), "Kari")
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "fs-field: en oppdatering fra serveren byttet ut kontrollen",
    )
  })

  it("fs-field: ikke når serveren skrev den samme id-en", async () => {
    const gammel = await skrivOgPatchFelt(
      FELT(' id="navn"'),
      FELT(' id="navn"'),
      "Kari",
    )
    expect(document.querySelector("input")).toBe(gammel)
    expect(meldinger()).toEqual([])
  })

  it("fs-field: ikke når brukeren ikke hadde skrevet noe", async () => {
    await skrivOgPatchFelt(FELT(' id="navn-1"'), FELT(' id="navn-2"'), "")
    expect(meldinger()).toEqual([])
  })

  it("fs-field: ikke når serveren sender teksten tilbake", async () => {
    // Serveren gjorde det meldingen ber om. Da er ingenting mistet, selv om
    // noden er ny.
    await skrivOgPatchFelt(
      FELT(' id="navn-1"'),
      FELT(' id="navn-2"', ' value="Kari"'),
      "Kari",
    )
    expect((document.querySelector("input") as HTMLInputElement).value).toBe(
      "Kari",
    )
    expect(meldinger()).toEqual([])
  })

  it("fs-field: ikke for en bar <select> brukeren lot stå", async () => {
    // Nettleseren velger det første alternativet uten at noe er
    // `defaultSelected`, så en sammenligning med det så et valg brukeren
    // aldri gjorde.
    const valg = `<fs-field id="land-vert">
  <label>Land <select class="fs-select"><option>Norge</option><option>Sverige</option></select></label>
</fs-field>`
    document.body.innerHTML = valg
    await ventPaTegning()
    patch(valg)
    await roSeg()
    expect(meldinger()).toEqual([])
  })

  it("fs-field: en avkrysset boks uten id står etter patchen", async () => {
    const boks = `<fs-field id="samtykke-vert">
  <label><input class="fs-checkbox" type="checkbox" name="samtykke"> Samtykke</label>
</fs-field>`
    document.body.innerHTML = boks
    await ventPaTegning()
    const gammel = document.querySelector("input") as HTMLInputElement
    gammel.checked = true
    patch(boks)
    await roSeg()
    const ny = document.querySelector("input") as HTMLInputElement
    expect(ny).toBe(gammel)
    expect(ny.checked).toBe(true)
    expect(meldinger()).toEqual([])
  })

  it("fs-field: når en avkrysset boks byttes ut fordi id-en endret seg", async () => {
    // `value` og `defaultValue` er alltid like på en avkrysningsboks, så
    // en sammenligning av dem så aldri at krysset var borte.
    const boks = (id: string) => `<fs-field id="samtykke-vert">
  <label><input class="fs-checkbox" type="checkbox" name="samtykke" id="${id}"> Samtykke</label>
</fs-field>`
    document.body.innerHTML = boks("samtykke-1")
    await ventPaTegning()
    ;(document.querySelector("input") as HTMLInputElement).checked = true
    patch(boks("samtykke-2"))
    await roSeg()
    expect((document.querySelector("input") as HTMLInputElement).checked).toBe(
      false,
    )
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "fs-field: en oppdatering fra serveren byttet ut kontrollen",
    )
  })

  const MENY = (id: string) => `<fs-popover id="meny-vert">
  <button class="fs-button"${id && ' aria-controls="meny"'}>Handlinger</button>
  <div class="fs-popover"${id} popover="manual"><button>Slett</button></div>
</fs-popover>`

  async function apneOgPatchMeny(markup: string, apne: boolean) {
    document.body.innerHTML = markup
    await ventPaTegning()
    if (apne) {
      ;(document.querySelector("fs-popover > button") as HTMLElement).click()
      await ventPaTegning()
    }
    patch(markup)
    await roSeg()
  }

  it("fs-popover: når id-en fra serveren endret seg mens vinduet sto åpent", async () => {
    // Slik en mal skriver det når id-en lages av en teller.
    const meny = (id: string) => `<fs-popover id="meny-vert">
  <button class="fs-button" aria-controls="${id}">Handlinger</button>
  <div class="fs-popover" id="${id}" popover="manual"><button>Slett</button></div>
</fs-popover>`
    document.body.innerHTML = meny("meny-1")
    await ventPaTegning()
    ;(document.querySelector("fs-popover > button") as HTMLElement).click()
    await ventPaTegning()
    patch(meny("meny-2"))
    await roSeg()
    expect(meldinger()).toHaveLength(1)
    expect(meldinger()[0]).toContain(
      "fs-popover: en oppdatering fra serveren byttet ut panelet",
    )
  })

  it("fs-popover: ikke når panelet er bart, for da beholdes det", async () => {
    await apneOgPatchMeny(MENY(""), true)
    expect(meldinger()).toEqual([])
  })

  it("fs-popover: ikke når serveren skrev id", async () => {
    await apneOgPatchMeny(MENY(' id="meny"'), true)
    expect(meldinger()).toEqual([])
  })

  it("fs-popover: ikke når vinduet var lukket", async () => {
    await apneOgPatchMeny(MENY(""), false)
    expect(meldinger()).toEqual([])
  })
})
