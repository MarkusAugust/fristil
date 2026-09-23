import { defineElement, HostElement, meldMangel } from "../../host-element.js"
import { computeFieldAttributes } from "./field-core.js"

export const FS_FIELD_TAG = "fs-field" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Attributtene `<fs-field>` regner ut selv, og setter tilbake om de blir
 * borte.
 *
 * Det samme sto en gang i `FIELD_PRESERVED_ATTRIBUTES`, som malen måtte
 * skrive av inn i `data-preserve-attr`. Den lista finnes ikke lenger:
 * komponenten ser at attributtene er borte og setter dem tilbake.
 */
const UTLEDEDE_ATTRIBUTTER = [
  "class",
  "for",
  "id",
  "aria-describedby",
  "aria-invalid",
  "aria-disabled",
  "data-state",
  "data-required",
  "data-optional",
  "disabled",
  "hidden",
]

function setOrRemove(
  element: HTMLElement,
  name: string,
  value: string | undefined,
): void {
  if (value === undefined) {
    element.removeAttribute(name)
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value)
  }
}

/**
 * Kobler ledetekst, kontroll, hjelpetekst og feilmelding i vanlig DOM.
 *
 * Komponenten er for markup som blir til uten JavaScript: en Go-mal, en
 * PHP-fil, en Razor-visning eller håndskrevet HTML. Lages markupen med
 * JavaScript, uansett hvor koden kjører, skal `fs.field()` skrive
 * attributtene i stedet, og da trengs ikke dette elementet.
 *
 * Komponenten rendrer ingenting. Den satte tidligere et `<slot>`-element inn i
 * vanlig DOM, og siden serveren ikke visste om det, fjernet Datastars morfing
 * det ved hver patch.
 *
 * Malen trenger ingen `data-preserve-attr` for feltet. River en morfing bort
 * koblingen, ser komponenten det og setter den tilbake. Skillet er mellom det
 * komponenten utleder, som `id`, `for` og `aria-describedby`, og tilstand
 * brukeren eier, som `open` på et sprettoppvindu: det første kan repareres,
 * det andre må fredes, for der ville en reparasjon kjempet mot en server som
 * med vilje endret noe.
 */
export class FsField extends HostElement {
  static observedAttributes = [
    "invalid",
    "disabled",
    "optional",
    "required-marker",
    "control-id",
    "described-by",
  ]

  private observer?: MutationObserver
  /** Id-ene komponenten laget selv, så en patch ikke gir nye hver gang. */
  private hjelpId?: string
  private feilId?: string
  private kontrollId?: string

  /**
   * Egenskapene speiler attributtene.
   *
   * Tilstanden bor i attributtet og ikke i et felt på klassen, slik at det
   * serveren sendte og det komponenten mener alltid er det samme. En egen
   * `invalid`-variabel ville kunne si noe annet enn markupen etter en morfing.
   */
  get invalid(): boolean {
    return this.hasAttribute("invalid")
  }

  set invalid(value: boolean) {
    this.toggleAttribute("invalid", value)
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value)
  }

  get optional(): boolean {
    return this.hasAttribute("optional")
  }

  set optional(value: boolean) {
    this.toggleAttribute("optional", value)
  }

  get requiredMarker(): "none" | "symbol" | "text" {
    const value = this.getAttribute("required-marker")
    return value === "symbol" || value === "text" ? value : "none"
  }

  set requiredMarker(value: "none" | "symbol" | "text") {
    if (value === "none") this.removeAttribute("required-marker")
    else this.setAttribute("required-marker", value)
  }

  get controlId(): string | undefined {
    return this.getAttribute("control-id") ?? undefined
  }

  set controlId(value: string | undefined) {
    if (value === undefined) this.removeAttribute("control-id")
    else this.setAttribute("control-id", value)
  }

  get describedBy(): string | undefined {
    return this.getAttribute("described-by") ?? undefined
  }

  set describedBy(value: string | undefined) {
    if (value === undefined) this.removeAttribute("described-by")
    else this.setAttribute("described-by", value)
  }

  connectedCallback(): void {
    /*
     * `slotchange` melder ikke fra i vanlig DOM, og innholdet byttes ut mens
     * brukeren fyller ut skjemaet.
     *
     * Attributtene er med, ikke bare barna. En morfing river bort det som
     * ikke står i serverens HTML, og koblingen mellom ledetekst, felt og
     * hjelpetekst er nettopp det: noe komponenten regnet ut, ikke noe
     * serveren sendte. Før måtte malen liste opp attributtene i
     * `data-preserve-attr` for at de skulle overleve. Nå ser komponenten at
     * de er borte, og setter dem tilbake.
     *
     * Lista er avgrenset til det komponenten selv utleder. Tilstand
     * brukeren eier, som hvilken fane som er valgt eller om et
     * sprettoppvindu står åpent, skal fortsatt fredes: der ville en
     * reparasjon kjempet mot en server som med vilje endret noe.
     *
     * Hver skriving i `sync()` sammenligner først. Uten det ville
     * observatøren utløst seg selv i det uendelige.
     */
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: UTLEDEDE_ATTRIBUTTER,
    })
    this.sync()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.sync()
  }

  /**
   * Id-en kontrollen skal ha, lest fra markupen når den står der.
   *
   * Ledetekstens `for` er med som kilde, og uten den mistet feltet koblingen
   * ved første patch: morfingen kan erstatte kontrollen med serverens node,
   * som ikke har noen id, mens ledeteksten beholder sin `for`. Da fant
   * komponenten ingen id, fant opp en ny, og skrev den bare på kontrollen, og
   * `for` pekte etter det på et element som ikke fantes. Funnet i
   * spilldemoen, i appen som sender HTML-biter fra en Kotlin-server.
   *
   * Lager komponenten id-en selv, huskes den. En ny id per patch ville gitt
   * en skjermleser en peker som skiftet under opplesningen.
   */
  private finnKontrollId(
    control: HTMLElement,
    label: HTMLLabelElement | null,
  ): string {
    const fraMarkupen =
      this.getAttribute("control-id") || control.id || label?.htmlFor
    if (fraMarkupen) return fraMarkupen

    this.kontrollId ??= uniqueId("fs-field-control")
    return this.kontrollId
  }

  private sync(): void {
    const label = this.querySelector("label")
    const control = this.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input:not([type='hidden']), textarea, select")
    const help = this.querySelector<HTMLElement>(
      ".fs-help-text, [data-role='help']",
    )
    const error = this.querySelector<HTMLElement>(
      ".fs-error-text, [data-role='error']",
    )

    if (!control) {
      // Bare når det står noe her. Et tomt element er et område serveren
      // ikke har fylt ennå, og det er ikke en feil i markupen.
      if (this.childElementCount > 0) {
        meldMangel(
          this,
          "fant ingen kontroll å koble til. Ledeteksten, hjelpeteksten og " +
            "feilmeldingen står uten et felt, og koblingen kan ikke lages. " +
            "Sett inn et <input>, <textarea> eller <select>.",
        )
      }
      return
    }

    if (!label) {
      meldMangel(
        this,
        "fant ingen <label>. Feltet får da ingen ledetekst, og en " +
          "skjermleser leser det opp uten navn.",
      )
    }

    /*
     * Id-ene komponenten selv laget, husket mellom rundene.
     *
     * Markupen er kilden så lenge den har dem. River en morfing dem bort,
     * ville en ny id blitt laget for hver eneste patch, og en skjermleser som
     * står midt i en opplesning ville fulgt en peker som skiftet under den.
     * Minnet er ikke en parallell utgave av tilstanden: står id-en i
     * markupen, er det den som gjelder.
     */
    if (help) {
      if (help.id) this.hjelpId = help.id
      else {
        this.hjelpId ??= uniqueId("fs-field-help")
        help.id = this.hjelpId
      }
    }
    if (error) {
      if (error.id) this.feilId = error.id
      else {
        this.feilId ??= uniqueId("fs-field-error")
        error.id = this.feilId
      }
    }

    // Markeringene leses også fra markupen. Skrev serveren dem med
    // `fs.field()`, står de på ledeteksten, og en komponent som bare så på
    // sine egne attributter ville fjernet dem igjen. I React ga det en
    // hydreringsfeil: serveren sendte `data-required="symbol"`, komponenten
    // tok det bort, og så mente React at HTML-en ikke stemte.
    const marker =
      this.getAttribute("required-marker") ??
      label?.getAttribute("data-required") ??
      null
    const disabled =
      this.hasAttribute("disabled") || control.hasAttribute("disabled")

    // Tilstanden leses fra markupen, ikke bare fra et attributt på verten.
    // Skrev serveren feltet med `fs.field()`, står svaret allerede på
    // kontrollen, og en komponent som regnet ut sitt eget ville fjernet det
    // igjen. Da kranglet de to halvdelene av API-et med hverandre.
    const invalid =
      this.hasAttribute("invalid") ||
      control.getAttribute("aria-invalid") === "true"

    const computed = computeFieldAttributes({
      id: this.finnKontrollId(control, label),
      help: Boolean(help),
      error: Boolean(error),
      helpId: help?.id,
      errorId: error?.id,
      required: marker === "symbol" || marker === "text" ? marker : undefined,
      optional:
        this.hasAttribute("optional") ||
        label?.hasAttribute("data-optional") === true,
      invalid,
      disabled,
      describedBy: [
        control.getAttribute("aria-describedby") ?? "",
        this.getAttribute("described-by") ?? "",
      ].filter(Boolean),
    })

    if (control.id !== computed.control.id) control.id = computed.control.id

    if (label) {
      if (!label.classList.contains(computed.label.class)) {
        label.classList.add(computed.label.class)
      }
      // Alltid, ikke bare når den mangler: `for` og `id` er den samme
      // opplysningen, og de to kan ikke få lov til å si hver sin ting.
      if (label.htmlFor !== computed.label.for)
        label.htmlFor = computed.label.for
      setOrRemove(label, "data-required", computed.label["data-required"])
      setOrRemove(label, "data-optional", computed.label["data-optional"])
      setOrRemove(label, "aria-disabled", computed.label["aria-disabled"])
    }

    if (error) {
      // Bare `hidden`. Et skjult element er allerede ute av
      // tilgjengelighetstreet, så `aria-hidden` var overflødig, og ga en
      // hydreringsfeil i React fordi serveren ikke skriver det.
      const skjult = Boolean(computed.error.hidden)
      if (error.hidden !== skjult) error.hidden = skjult
    }

    setOrRemove(
      control,
      "aria-describedby",
      computed.control["aria-describedby"],
    )
    setOrRemove(control, "aria-invalid", computed.control["aria-invalid"])

    if (disabled) {
      if (!control.hasAttribute("disabled"))
        control.setAttribute("disabled", "")
      setOrRemove(control, "aria-disabled", "true")
    } else {
      control.removeAttribute("disabled")
      control.removeAttribute("aria-disabled")
    }

    // data-state settes bare når konsumenten ikke har satt den selv.
    const isSystemField =
      control.classList.contains("fs-input") ||
      control.classList.contains("fs-textarea") ||
      control.classList.contains("fs-select")

    const state = computed.control["data-state"]
    if (state && isSystemField && !control.hasAttribute("data-state")) {
      control.setAttribute("data-state", state)
    } else if (!state && control.getAttribute("data-state") === "invalid") {
      control.removeAttribute("data-state")
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-field": FsField
  }
}

export function defineFsField(tagName = FS_FIELD_TAG): void {
  defineElement(tagName, FsField)
}
