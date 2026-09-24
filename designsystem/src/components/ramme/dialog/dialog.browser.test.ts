/// <reference path="../../../types/css.d.ts" />

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { userEvent } from "vitest/browser"
import {
  forventIngenTilgjengelighetsbrudd,
  monter,
  ventPaTegning,
} from "../../../testing/a11y"
import { attr } from "../../../testing/markup"
import { dialog } from "./dialog"
import { defineFsDialog } from "./fs-dialog"

import "../../../tokens/tokens.css"
import "./dialog.css"
import "../../css/button/button.css"

describe(".fs-dialog", () => {
  beforeEach(() => {
    monter(`
      <button class="fs-button" id="apne" type="button">Slett søknaden</button>
      <dialog class="fs-dialog" id="dialog" aria-labelledby="dialog-tittel">
        <h2 class="fs-dialog__title" id="dialog-tittel">Slette søknaden?</h2>
        <div class="fs-dialog__body">
          <p>Søknaden og vedleggene blir borte. Dette kan ikke angres.</p>
        </div>
        <div class="fs-dialog__footer">
          <button class="fs-button" data-variant="secondary" id="avbryt" type="button">Avbryt</button>
          <button class="fs-button" data-variant="danger" id="slett" type="button">Slett søknaden</button>
        </div>
      </dialog>
    `)
  })

  afterEach(() => {
    const d = document.getElementById("dialog") as HTMLDialogElement | null
    if (d?.open) d.close()
  })

  it("flytter fokus inn i dialogen når den åpnes med showModal", () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()

    expect(d.open).toBe(true)
    // showModal() flytter fokus selv. Et <dialog open> i markupen gjør ikke
    // det, og er derfor bare en boks på siden.
    expect(d.contains(document.activeElement)).toBe(true)
  })

  it("lukkes med Escape uten at vi skriver noe for det", async () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()

    // Et `cancel` sendt for hånd utløser ikke nettleserens egen lukking, og
    // en test som gjorde det og deretter kalte `close()` selv, prøvde bare
    // sin egen kode. Her trykkes tasten på ekte.
    await userEvent.keyboard("{Escape}")

    expect(d.open).toBe(false)
  })

  it("melder tilbake hva brukeren valgte", () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()
    d.close("slett")

    expect(d.returnValue).toBe("slett")
  })

  it("setter attributtene fra byggefunksjonen", () => {
    const boks = dialog({ titleId: "dialog-tittel" })

    expect(boks.dialog).toEqual({
      class: "fs-dialog",
      "aria-labelledby": "dialog-tittel",
    })
    // Skal dialogen vises, står `open` begge steder. På `<dialog>` er det
    // reserven for den som ikke har JavaScript: uten den er innholdet skjult.
    expect(dialog({ titleId: "t", open: true }).dialog).toEqual({
      class: "fs-dialog",
      "aria-labelledby": "t",
      open: true,
    })
    expect(boks.title).toEqual({
      class: "fs-dialog__title",
      id: "dialog-tittel",
    })
    expect(boks.body).toEqual({ class: "fs-dialog__body" })
    expect(boks.footer).toEqual({ class: "fs-dialog__footer" })
    expect(dialog.title).toBe("fs-dialog__title")
  })

  it("har ingen tilgjengelighetsbrudd når den er åpen", async () => {
    const d = document.getElementById("dialog") as HTMLDialogElement
    d.showModal()

    await ventPaTegning()
    await forventIngenTilgjengelighetsbrudd()
  })
})

describe("bredden på dialogen", () => {
  it("blir ikke bredere enn boksen den står i", async () => {
    /*
     * Dialogen regnet bredden sin mot vindusruten. Står den i en smalere
     * boks, som i et panel eller en forhåndsvisning, stakk den utenfor.
     *
     * En `<dialog open>` er absolutt plassert av nettleseren, så `100%`
     * måles mot nærmeste plasserte forelder. Derfor `position: relative` på
     * boksen her; uten den er det vindusruten som gjelder, og det er riktig
     * for en dialog åpnet med `showModal()`.
     */
    monter(`
      <div id="smal" style="width: 240px; position: relative">
        <dialog class="fs-dialog" id="i-boks" open>
          <p>Innhold</p>
        </dialog>
      </div>

      <div id="smal-flate" style="width: 240px">
        <div class="fs-dialog" id="som-boks">
          <p>Innhold</p>
        </div>
      </div>
    `)

    await ventPaTegning()

    for (const [boksId, dialogId] of [
      ["smal", "i-boks"],
      ["smal-flate", "som-boks"],
    ]) {
      const boks = document.getElementById(boksId) as HTMLElement
      const dialog = document.getElementById(dialogId) as HTMLElement

      expect(
        dialog.getBoundingClientRect().width,
        dialogId,
      ).toBeLessThanOrEqual(boks.getBoundingClientRect().width)
    }
  })
})

/**
 * Serveren kan si at dialogen er åpen, og komponenten gjør kallet.
 *
 * Uten dette kunne en app som bare sender HTML ikke åpne en dialog i det
 * hele tatt: `showModal()` er et kall, og `<dialog open>` er bare en boks på
 * siden. Det ble funnet i en app skrevet i Kotlin med Datastar.
 */
describe("fs-dialog", () => {
  beforeAll(() => {
    defineFsDialog()
  })

  async function monterDialog(open: boolean) {
    const boks = dialog({ titleId: "tittel", open })
    monter(`
      <fs-dialog ${attr(boks.host)}>
        <dialog ${attr(boks.dialog)}>
          <h2 ${attr(boks.title)}>Vedtaket er registrert</h2>
          <div ${attr(boks.body)}><p>Saken er ferdigbehandlet.</p></div>
          <form method="dialog" ${attr(boks.footer)}>
            <button class="fs-button" id="lukk" value="lukk">Lukk</button>
          </form>
        </dialog>
      </fs-dialog>
    `)
    await customElements.whenDefined("fs-dialog")
    await ventPaTegning()
    return {
      vert: document.querySelector("fs-dialog") as HTMLElement,
      d: document.querySelector("dialog") as HTMLDialogElement,
    }
  }

  afterEach(() => {
    const d = document.querySelector("dialog") as HTMLDialogElement | null
    if (d?.open) d.close()
  })

  it("åpner modalt når serveren sier at den er åpen", async () => {
    const { d } = await monterDialog(true)

    expect(d.open).toBe(true)
    // `:modal` er forskjellen på `showModal()` og `show()`. Bare den første
    // gjør resten av siden utilgjengelig og lukker på Escape. Fokus flyttes
    // av begge, så det alene skiller dem ikke.
    expect(d.matches(":modal")).toBe(true)
    expect(d.contains(document.activeElement)).toBe(true)
  })

  it("lar den stå lukket når serveren ikke sier noe", async () => {
    const { d } = await monterDialog(false)

    expect(d.open).toBe(false)
  })

  it("åpner og lukker når serveren snur attributtet", async () => {
    const { vert, d } = await monterDialog(false)

    vert.setAttribute("open", "")
    await ventPaTegning()
    expect(d.open).toBe(true)

    vert.removeAttribute("open")
    await ventPaTegning()
    expect(d.open).toBe(false)
  })

  it("fjerner open fra verten når brukeren lukker", async () => {
    const { vert, d } = await monterDialog(true)

    d.close()
    await ventPaTegning()

    // Markupen skal si det samme som skjermen. Ellers ville neste patch
    // åpnet dialogen igjen, siden verten fortsatt sa `open`.
    expect(vert.hasAttribute("open")).toBe(false)
  })

  it("kaster ikke når markupen bygges løsrevet fra siden", async () => {
    // En morfer lager serverens utgave i et løsrevet tre for å sammenligne.
    // Elementet tas i bruk også der, og `showModal()` kaster på en dialog
    // som ikke står i dokumentet.
    //
    // Feilen kommer ikke ut av `innerHTML`: et unntak i en reaksjon på et
    // egendefinert element rapporteres til vinduet i stedet. Derfor lyttes
    // det på `error` framfor å pakke inn kallet.
    const feil: string[] = []
    const lytter = (event: ErrorEvent) => feil.push(event.message)
    window.addEventListener("error", lytter)

    const boks = dialog({ titleId: "t", open: true })
    const holder = document.createElement("div")
    holder.innerHTML = `
      <fs-dialog ${attr(boks.host)}>
        <dialog ${attr(boks.dialog)}>
          <h2 ${attr(boks.title)}>Tittel</h2>
        </dialog>
      </fs-dialog>`

    await ventPaTegning()
    window.removeEventListener("error", lytter)

    expect(feil).toEqual([])
    // To ting skal gjelde her. Komponenten skal ikke ha kalt `showModal()`,
    // som er det `:modal` svarer på. Og serverens eget `open` skal stå
    // igjen, for det er reserven for den som ikke har JavaScript: uten den
    // er dialogen skjult, og innholdet finnes ikke.
    expect(holder.querySelector("dialog")?.matches(":modal")).toBe(false)
    expect(holder.querySelector("dialog")?.hasAttribute("open")).toBe(true)
  })

  it("skriver open på verten som serverens beskjed", () => {
    // `true` og ikke `""`: React 19 setter egenskapen, og den tomme
    // strengen er usann, så setteren i komponenten fjerner attributtet igjen.
    expect(dialog({ titleId: "t", open: true }).host).toEqual({ open: true })
    expect(dialog({ titleId: "t" }).host).toEqual({})
  })

  it("ber ikke malen frede noe", () => {
    // `showModal()` setter `open` på `<dialog>` selv, og en morfing river det
    // bort igjen. Før måtte malen skrive `data-preserve-attr="open"` for å
    // hindre det. Nå setter komponenten attributtet tilbake, og kommer lista
    // hit igjen, har noen gjenopptatt kontrakten malen måtte skrive av.
    expect("data-preserve-attr" in dialog({ titleId: "t" }).dialog).toBe(false)
    expect("data-preserve-attr" in dialog({ titleId: "t" }).host).toBe(false)
  })

  it("åpner igjen når serveren sender open på nytt", async () => {
    const { vert, d } = await monterDialog(true)

    d.close()
    await ventPaTegning()
    expect(vert.hasAttribute("open")).toBe(false)

    // Dette er det en morfing gjør: serverens node sier fortsatt `open`.
    vert.setAttribute("open", "")
    await ventPaTegning()

    expect(d.open, "serveren kunne ikke åpne dialogen på nytt").toBe(true)
  })

  it("melder fra når den åpnes og lukkes", async () => {
    const meldinger: boolean[] = []
    const { vert, d } = await monterDialog(false)
    vert.addEventListener("dialog-toggle", (event) => {
      meldinger.push((event as CustomEvent<{ open: boolean }>).detail.open)
    })

    vert.setAttribute("open", "")
    await ventPaTegning()
    d.close()
    await ventPaTegning()

    expect(meldinger).toEqual([true, false])
  })

  it("åpner også når malen glemte open på selve dialogen", async () => {
    // Håndskrevet markup, og dokumentasjonen har vist dette lenge: verten
    // sier `open`, men `<dialog>` har det ikke. Byggefunksjonen gir begge nå,
    // så dette tilfellet finnes bare i maler noen har skrevet selv.
    monter(`
      <fs-dialog open>
        <dialog class="fs-dialog" aria-labelledby="tittel">
          <h2 class="fs-dialog__title" id="tittel">Tittel</h2>
        </dialog>
      </fs-dialog>
    `)
    await customElements.whenDefined("fs-dialog")
    await ventPaTegning()

    expect(document.querySelector("dialog")?.matches(":modal")).toBe(true)
  })

  it("lukker selv om attributtet på dialogen ble fjernet først", async () => {
    /*
     * React eier `open` på `<dialog>` nå, og oppdaterer barn før forelder.
     * Lukker appen dialogen, fjernes attributtet på `<dialog>` før det på
     * verten, og komponenten kommer hit med `dialog.open` alt usann.
     *
     * Uten at komponenten ser på `:modal` ble dialogen stående i topplaget,
     * usynlig, med resten av siden inert: en side der ingenting kunne
     * klikkes, og ingenting synlig som forklarte hvorfor.
     */
    const { vert, d } = await monterDialog(true)
    expect(d.matches(":modal")).toBe(true)

    d.removeAttribute("open")
    vert.removeAttribute("open")
    await ventPaTegning()

    expect(d.matches(":modal"), "dialogen står igjen i topplaget").toBe(false)

    // Og siden er brukbar igjen: en knapp utenfor kan få fokus.
    const knapp = document.createElement("button")
    document.body.append(knapp)
    knapp.focus()
    const fikkFokus = document.activeElement === knapp
    knapp.remove()
    expect(fikkFokus, "resten av siden er fortsatt inert").toBe(true)
  })

  it("åpner ikke igjen en dialog brukeren lukket før skriptet kom", async () => {
    /*
     * Serveren skriver `open` begge steder, så innholdet finnes uten
     * JavaScript, og `<form method="dialog">` lukker boksen uten JavaScript
     * også. Skjer det før komponenten har fått kjøre, finnes det ingen
     * lytter, og første `sync()` så en vert som sa «åpen» og en lukket
     * dialog. Da spratt dialogen opp igjen rett etter at brukeren hadde
     * lukket den. På mobil skjedde det hver gang, fordi vinduet der er langt
     * nok til å rekke et trykk.
     *
     * Markupen bygges løsrevet og lukkes der. `sync()` gir seg på en dialog
     * som ikke står i siden, så ingen lytter er festet, og det er nettopp
     * tilstanden en side har før skriptet er lastet.
     */
    const boks = dialog({ titleId: "tittel", open: true })
    const holder = document.createElement("div")
    holder.innerHTML = `
      <fs-dialog ${attr(boks.host)}>
        <dialog ${attr(boks.dialog)}>
          <h2 ${attr(boks.title)}>Tittel</h2>
          <form method="dialog" ${attr(boks.footer)}>
            <button class="fs-button" value="lukk">Lukk</button>
          </form>
        </dialog>
      </fs-dialog>`

    const d = holder.querySelector("dialog") as HTMLDialogElement
    expect(d.open, "serveren sendte den ikke åpen").toBe(true)

    // Brukeren lukker boksen mens den bare er en boks på siden.
    d.close("lukk")

    document.body.append(holder)
    await ventPaTegning()

    expect(d.open, "dialogen spratt opp igjen").toBe(false)
    expect(
      holder.querySelector("fs-dialog")?.hasAttribute("open"),
      "verten sier fortsatt at den er åpen",
    ).toBe(false)

    holder.remove()
  })

  it("sender ingen close-hendelse når serveren sender dialogen åpen", async () => {
    /*
     * Serveren skriver `open` på `<dialog>`, og komponenten må ta det bort
     * før `showModal()`. Gjør den det med `close()`, sender nettleseren en
     * ekte `close`-hendelse, og den kommer ved hver eneste lasting. En app
     * som lytter på `close` rett på `<dialog>`, slik det komplette
     * eksempelet i dokumentasjonen gjør, fikk da en spøkelseslukking før
     * brukeren hadde sett dialogen. `dialog-toggle` så den ikke, for
     * `handleClose` stopper på `:modal`.
     */
    const hendelser: string[] = []
    // `close` bobler ikke. En lytter på dokumentet i bobleefasen ser den
    // aldri, og testen ville meldt grønt uansett hva komponenten gjorde.
    const lytter = (e: Event) => {
      if ((e.target as HTMLElement)?.tagName === "DIALOG")
        hendelser.push("close")
    }
    document.addEventListener("close", lytter, true)

    const { d } = await monterDialog(true)
    document.removeEventListener("close", lytter, true)

    expect(d.matches(":modal")).toBe(true)
    expect(hendelser).toEqual([])
  })

  it("lukker ikke seg selv når serveren lukker og åpner i samme omgang", async () => {
    const { vert, d } = await monterDialog(true)
    const meldinger: boolean[] = []
    vert.addEventListener("dialog-toggle", (event) => {
      meldinger.push((event as CustomEvent<{ open: boolean }>).detail.open)
    })

    // `close`-hendelsen er køet, ikke synkron. Uten en sperre kom den fram
    // etter at dialogen var åpnet igjen, og lukket den på nytt.
    vert.removeAttribute("open")
    vert.setAttribute("open", "")

    await ventPaTegning()
    await ventPaTegning()

    expect(d.matches(":modal"), "dialogen lukket seg selv etterpå").toBe(true)
    expect(vert.hasAttribute("open")).toBe(true)
    expect(meldinger).toEqual([false, true])
  })

  it("styrer bare sin egen dialog, ikke en lenger ned i treet", async () => {
    // En annen komponent kan ha sin egen `<dialog>` inni denne. Den står
    // først i dokumentet her, så en komponent som bare spurte etter «den
    // første dialogen» ville åpnet feil boks.
    const boks = dialog({ titleId: "tittel", open: true })
    monter(`
      <fs-dialog ${attr(boks.host)}>
        <div class="et-eller-annet-kort">
          <dialog id="fremmed"><p>Noe helt annet</p></dialog>
        </div>
        <dialog ${attr(boks.dialog)} id="min">
          <h2 ${attr(boks.title)}>Tittel</h2>
        </dialog>
      </fs-dialog>
    `)
    await customElements.whenDefined("fs-dialog")
    await ventPaTegning()

    expect((document.getElementById("min") as HTMLDialogElement).open).toBe(
      true,
    )
    expect((document.getElementById("fremmed") as HTMLDialogElement).open).toBe(
      false,
    )
  })

  it("sier hvilken knapp som lukket den", async () => {
    const { vert, d } = await monterDialog(true)
    let svar: string | undefined
    vert.addEventListener("dialog-toggle", (event) => {
      svar = (event as CustomEvent<{ returnValue: string }>).detail.returnValue
    })

    d.close("slett")
    await ventPaTegning()

    expect(svar).toBe("slett")
  })

  it("har ingen tilgjengelighetsbrudd når den er åpen", async () => {
    await monterDialog(true)

    await forventIngenTilgjengelighetsbrudd()
  })
})

/**
 * Dialogen skal stå riktig også før den er blitt en ekte modal.
 *
 * Serveren sender `<dialog open>` fordi innholdet ellers ikke finnes uten
 * JavaScript. Nettleseren legger den da i den vanlige flyten, og først når
 * komponenten kaller `showModal()` flyttes den til topplaget og midtstilles.
 * På en treg forbindelse er hoppet mellom de to øyeblikkene godt synlig, og
 * det ble meldt fra en telefon: dialogen sto høyt oppe i siden og landet
 * midt på et halvt sekund senere.
 */
describe("dialogen før den er modal", () => {
  /*
   * Tilstanden testes i en ramme uten skript.
   *
   * Første utgave laget elementet i selve testsiden, og den var ikke til å
   * stole på: i en full kjøring er `<fs-dialog>` alt registrert av en annen
   * testfil, så dialogen rakk å bli modal før stilen ble lest. En ramme med
   * bare markup og stilark er nøyaktig det serveren sender, og ingenting
   * annet.
   */
  async function iRammeUtenSkript(
    markup: string,
    bredde = 800,
  ): Promise<{
    dialog: HTMLDialogElement
    vindu: Window
    rydd: () => void
  }> {
    const tokens = (await import("../../../tokens/tokens.css?inline")).default
    const dialogstil = (await import("./dialog.css?inline")).default

    const ramme = document.createElement("iframe")
    ramme.width = String(bredde)
    ramme.height = "600"
    ramme.srcdoc = `<!doctype html><html><head><style>${tokens}\n${dialogstil}</style></head><body>${markup}</body></html>`
    document.body.append(ramme)

    await new Promise((klar) => {
      ramme.addEventListener("load", klar, { once: true })
    })

    /*
     * Vent på at ramma har en størrelse, ikke bare på `load`.
     *
     * `100vmax` i stilarket regnes mot rammas eget vindu, og det er null til
     * den er lagt ut. Lokalt rakk den det før testen leste stilen, i CI ikke,
     * og da ble skyggen null piksler bred uten at noe var galt med regelen.
     */
    await vi.waitFor(() => {
      if (!(ramme.contentWindow?.innerWidth ?? 0))
        throw new Error("ramma er ikke lagt ut")
    })

    const dok = ramme.contentDocument as Document
    return {
      dialog: dok.querySelector("dialog") as HTMLDialogElement,
      vindu: ramme.contentWindow as Window,
      rydd: () => ramme.remove(),
    }
  }

  it("står midt i vinduet, med flaten bak malt", async () => {
    const {
      dialog: boks,
      vindu,
      rydd,
    } = await iRammeUtenSkript(`
      <fs-dialog>
        <dialog class="fs-dialog" open>
          <h2 class="fs-dialog__title">Velkommen</h2>
          <p>Innhold som finnes uten JavaScript.</p>
        </dialog>
      </fs-dialog>`)

    try {
      // Ingen skript i ramma, så dialogen er åpen uten å være modal. Det er
      // nøyaktig tilstanden serveren sender.
      expect(boks.matches(":modal")).toBe(false)
      expect(boks.open).toBe(true)

      const stil = vindu.getComputedStyle(boks)
      expect(stil.position).toBe("fixed")

      /*
       * Skyggen maler flaten bak, siden `::backdrop` bare finnes i topplaget.
       *
       * To lag: kortets egen skygge, og flaten. Og flaten skal faktisk dekke
       * ramma, ikke bare stå der som en tynn kant.
       */
      const lag = stil.boxShadow.split(/,(?![^(]*\))/)
      expect(lag).toHaveLength(2)

      const spredning = Math.max(
        ...[...stil.boxShadow.matchAll(/(\d+(?:\.\d+)?)px/g)].map((t) =>
          Number(t[1]),
        ),
      )
      expect(spredning).toBeGreaterThanOrEqual(
        Math.max(vindu.innerWidth, vindu.innerHeight),
      )

      // Og den står midt i ramma, ikke øverst i flyten.
      const rute = boks.getBoundingClientRect()
      expect(
        Math.abs(rute.top + rute.height / 2 - vindu.innerHeight / 2),
      ).toBeLessThan(4)
    } finally {
      rydd()
    }
  })

  it("flytter seg ikke når den blir modal", async () => {
    /*
     * Den egentlige påstanden: ingen hopp, verken loddrett eller vannrett.
     *
     * Første utgave av regelen over midtstilte dialogen, og da var det
     * loddrette hoppet borte. Et vannrett kom i stedet: nettleserens egen
     * regel for `dialog:modal` har et maksmål vi ikke hadde, og i det
     * dialogen ble modal klipte den bredden. Ramma er derfor smal nok til at
     * maksmålet faktisk slår inn, ellers etterprøver testen ingenting.
     */
    const {
      dialog: boks,
      vindu,
      rydd,
    } = await iRammeUtenSkript(
      `
      <fs-dialog>
        <dialog class="fs-dialog" open>
          <h2 class="fs-dialog__title">Velkommen</h2>
          <p>Innhold som finnes uten JavaScript.</p>
        </dialog>
      </fs-dialog>`,
      390,
    )

    try {
      const før = boks.getBoundingClientRect()

      /*
       * Så smal ramme at nettleserens eget maksmål for en modal er mindre
       * enn bredden dialogen ellers ville tatt. Uten det er det ingenting å
       * klippe, og testen ville vært grønn også med feilen i. Maksmålet
       * regnes med dialogens egen skriftstørrelse, siden `2em` gjør det.
       */
      const em = Number.parseFloat(vindu.getComputedStyle(boks).fontSize)
      expect(
        Math.abs(før.width - (vindu.innerWidth - 6 - 2 * em)),
      ).toBeLessThanOrEqual(1)

      boks.close()
      boks.showModal()
      expect(boks.matches(":modal")).toBe(true)

      const etter = boks.getBoundingClientRect()

      // Én piksel slingringsmonn for avrunding, ikke mer.
      expect(Math.abs(etter.left - før.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(etter.top - før.top)).toBeLessThanOrEqual(1)
      expect(Math.abs(etter.width - før.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(etter.height - før.height)).toBeLessThanOrEqual(1)
    } finally {
      rydd()
    }
  })

  it("rører ikke en dialog som brukes uten komponenten", async () => {
    // En `.fs-dialog` som står alene, og med vilje ikke er modal, skal stå
    // der den står.
    const {
      dialog: boks,
      vindu,
      rydd,
    } = await iRammeUtenSkript(
      `<dialog class="fs-dialog" open>Uten vert</dialog>`,
    )

    try {
      expect(vindu.getComputedStyle(boks).position).not.toBe("fixed")
    } finally {
      rydd()
    }
  })
})
