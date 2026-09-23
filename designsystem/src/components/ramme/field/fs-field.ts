import { defineElement, HostElement } from "../../host-element.js"
import { computeFieldAttributes } from "./field-core.js"

export const FS_FIELD_TAG = "fs-field" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

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
 * det ved hver patch. Se `FIELD_PRESERVED_ATTRIBUTES` for hva serveren må
 * skrive for at koblingen skal overleve en morfing.
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
    // `slotchange` melder ikke fra i vanlig DOM, og innholdet byttes ut mens
    // brukeren fyller ut skjemaet. Bare childList: å sette et attributt på et
    // barn utløser da ingen ny runde, så observatøren kan ikke gå i ring.
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, { childList: true, subtree: true })
    this.sync()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.sync()
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

    if (!control) return

    if (help && !help.id) help.id = uniqueId("fs-field-help")
    if (error && !error.id) error.id = uniqueId("fs-field-error")

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
      /*
       * Id-en leses fra markupen, også fra ledetekstens `for`.
       *
       * Uten den siste kilden mister feltet koblingen ved første patch.
       * Morfingen kan erstatte kontrollen med serverens node, som ikke har
       * noen id, mens ledeteksten beholder sin `for`, og da fant komponenten
       * ingen id, fant opp en ny, og skrev den bare på kontrollen. `for`
       * pekte etter det på et element som ikke fantes. Funnet i spilldemoen,
       * i appen som sender HTML-biter fra en Kotlin-server.
       */
      id:
        this.getAttribute("control-id") ||
        control.id ||
        label?.htmlFor ||
        uniqueId("fs-field-control"),
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

    control.id = computed.control.id

    if (label) {
      label.classList.add(computed.label.class)
      // Alltid, ikke bare når den mangler: `for` og `id` er den samme
      // opplysningen, og de to kan ikke få lov til å si hver sin ting.
      label.htmlFor = computed.label.for
      setOrRemove(label, "data-required", computed.label["data-required"])
      setOrRemove(label, "data-optional", computed.label["data-optional"])
      setOrRemove(label, "aria-disabled", computed.label["aria-disabled"])
    }

    if (error) {
      // Bare `hidden`. Et skjult element er allerede ute av
      // tilgjengelighetstreet, så `aria-hidden` var overflødig, og ga en
      // hydreringsfeil i React fordi serveren ikke skriver det.
      error.hidden = Boolean(computed.error.hidden)
    }

    setOrRemove(
      control,
      "aria-describedby",
      computed.control["aria-describedby"],
    )
    setOrRemove(control, "aria-invalid", computed.control["aria-invalid"])

    if (disabled) {
      control.setAttribute("disabled", "")
      control.setAttribute("aria-disabled", "true")
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
