import {
  addClass,
  defineElement,
  HostElement,
  setAttr,
  setFlag,
  warnAboutMarkup,
} from "../../host-element.js"
import { computeFieldAttributes } from "./field-core.js"

export const FS_FIELD_TAG = "fs-field" as const

function uniqueId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

const CONTROL_SELECTOR = "input:not([type='hidden']), textarea, select"

/**
 * Attributtene `<fs-field>` regner ut selv, og setter tilbake om de blir
 * borte.
 *
 * Det samme sto en gang i `FIELD_PRESERVED_ATTRIBUTES`, som malen måtte
 * skrive av inn i `data-preserve-attr`. Den lista finnes ikke lenger:
 * komponenten ser at attributtene er borte og setter dem tilbake.
 */
const DERIVED_ATTRIBUTES = [
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
 * Malen trenger ingenting ekstra. River en morfing bort koblingen, ser
 * komponenten det og setter den tilbake. Det samme gjør de andre
 * komponentene med tilstanden brukeren har laget, og `data-preserve-attr`
 * finnes ikke lenger i pakken. Skal serveren eie tilstanden, sier den det med
 * `server-controlled` på verten.
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
  private generatedHelpId?: string
  private generatedErrorId?: string
  private generatedControlId?: string
  /**
   * Id-en kontrollen hadde sist, enten den kom fra markupen eller herfra.
   *
   * Bytter en patch ut kontrollen med en uten id, finner komponenten id-en
   * igjen i ledetekstens `for`, så lenge ledeteksten står inni elementet.
   * Står den utenfor, finner komponenten den ikke: oppslaget etter en
   * ledetekst utenfor går gjennom kontrollens id, og den er nettopp borte.
   * Uten dette minnet laget komponenten da en ny id, og `for` pekte på et
   * element som ikke fantes.
   */
  private lastId?: string
  /**
   * Hva noen andre enn komponenten sist sa om `aria-invalid`.
   *
   * `sync()` må lese `aria-invalid` fra kontrollen, fordi serveren kan ha
   * skrevet feltet med `fs.field()` og da står svaret allerede der. Men
   * komponenten skriver det samme attributtet selv, så en naiv avlesning er
   * komponentens eget ekko fra forrige runde, og `felt.invalid = false`
   * fjernet flagget på verten mens den røde rammen og feilmeldingen ble
   * stående for godt.
   *
   * Løsningen er ikke å huske hva verten sa sist. Det ble prøvd, og gjorde
   * komponenten avhengig av historien sin: den samme markupen ga to ulike
   * svar alt etter om verten hadde hatt `invalid` innom en gang. Da kunne
   * den stryke serverens eget `aria-invalid` uten at noe sa fra.
   *
   * I stedet noteres verdien komponenten skrev, og hvilken kontroll den ble
   * skrevet på. Står det noe annet der neste gang, har noen andre rørt
   * attributtet, og det er serverens ord. Avlesningen er dermed alltid
   * utledet av en endring som faktisk har skjedd, aldri av en gjetning, og
   * det samme dokumentet gir alltid det samme svaret.
   */
  private serverInvalid = false
  private writtenInvalid: string | null = null
  private lastControl?: Element

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
     * Lista er avgrenset til det komponenten selv utleder. De andre
     * komponentene gjør det samme med sin egen tilstand, hver med sin liste.
     *
     * Hver skriving i `sync()` sammenligner først. Uten det ville
     * observatøren utløst seg selv i det uendelige.
     */
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: DERIVED_ATTRIBUTES,
    })
    this.sync()
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.lastControl = undefined
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
  private resolveControlId(
    control: HTMLElement,
    label: HTMLLabelElement | null,
  ): string {
    const fromMarkup =
      this.getAttribute("control-id") || control.id || label?.htmlFor

    if (!fromMarkup && !this.lastId) {
      this.generatedControlId ??= uniqueId("fs-field-control")
    }

    this.lastId = fromMarkup || this.lastId || this.generatedControlId
    return this.lastId as string
  }

  /**
   * Ledeteksten feltet hører sammen med.
   *
   * Vanligvis står den inni elementet. Står den utenfor, med `for` som peker
   * på kontrollen, er feltet like godt navngitt, og komponenten kobler den
   * på samme måte. Én forskjell er verdt å vite: en ledetekst utenfor ligger
   * ikke i det komponenten observerer, så river en patch klassen av den,
   * kommer den ikke tilbake av seg selv.
   */
  private resolveLabel(control: HTMLElement | null): HTMLLabelElement | null {
    const inside = this.querySelector("label")
    if (inside || !control?.id) return inside

    const root = this.getRootNode() as Document | ShadowRoot
    return (
      root.querySelector?.<HTMLLabelElement>(
        `label[for="${CSS.escape(control.id)}"]`,
      ) ?? null
    )
  }

  private sync(): void {
    const control = this.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(CONTROL_SELECTOR)
    const help = this.querySelector<HTMLElement>(
      ".fs-help-text, [data-role='help']",
    )
    const error = this.querySelector<HTMLElement>(
      ".fs-error-text, [data-role='error']",
    )

    if (!control) {
      warnAboutMarkup(
        this,
        "fant ingen kontroll å koble til. Ledeteksten, hjelpeteksten og " +
          "feilmeldingen står uten et felt, og koblingen kan ikke lages. " +
          "Sett inn et <input>, <textarea> eller <select>.",
        // Et tomt element er et område serveren ikke har fylt ennå, og det
        // er ikke en feil i markupen.
        () =>
          this.childElementCount > 0 && !this.querySelector(CONTROL_SELECTOR),
      )
      // Ingen grunn til å holde på den forrige kontrollen. Den er borte, og
      // en referanse hit ville holdt en løsrevet node i live så lenge verten
      // lever.
      this.lastControl = undefined
      return
    }

    // Ledeteksten kan stå utenfor elementet. Oppslaget må skje etter at
    // kontrollen er funnet, siden det går via id-en hennes.
    const label = this.resolveLabel(control)

    warnAboutMarkup(
      this,
      "fant ingen <label>. Feltet får da ingen ledetekst, og en " +
        "skjermleser leser det opp uten navn.",
      /*
       * Tre lovlige måter å gi feltet et navn på, og ingen av dem skal gi en
       * advarsel: en `<label>` inni, en `<label for>` utenfor, eller
       * `aria-label` og `aria-labelledby` på kontrollen, som i et søkefelt
       * med bare et ikon.
       */
      () => {
        const named = this.querySelector<HTMLElement>(CONTROL_SELECTOR)
        if (!named || this.resolveLabel(named)) return false
        return (
          !named.hasAttribute("aria-label") &&
          !named.hasAttribute("aria-labelledby")
        )
      },
    )

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
      if (help.id) this.generatedHelpId = help.id
      else {
        this.generatedHelpId ??= uniqueId("fs-field-help")
        setAttr(help, "id", this.generatedHelpId)
      }
    }
    if (error) {
      if (error.id) this.generatedErrorId = error.id
      else {
        this.generatedErrorId ??= uniqueId("fs-field-error")
        setAttr(error, "id", this.generatedErrorId)
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
    const nowInvalid = control.getAttribute("aria-invalid")
    if (control !== this.lastControl || nowInvalid !== this.writtenInvalid) {
      // Noen andre enn komponenten har rørt attributtet siden sist, eller
      // dette er en kontroll vi aldri har skrevet på. Da er det serverens ord.
      this.serverInvalid = nowInvalid === "true"
    }

    const invalid = this.hasAttribute("invalid") || this.serverInvalid

    const computed = computeFieldAttributes({
      id: this.resolveControlId(control, label),
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

    setAttr(control, "id", computed.control.id)

    if (label) {
      addClass(label, computed.label.class)
      // Alltid, ikke bare når den mangler: `for` og `id` er den samme
      // opplysningen, og de to kan ikke få lov til å si hver sin ting.
      setAttr(label, "for", computed.label.for)
      setAttr(label, "data-required", computed.label["data-required"])
      setAttr(label, "data-optional", computed.label["data-optional"])
      setAttr(label, "aria-disabled", computed.label["aria-disabled"])
    }

    if (error) {
      // Bare `hidden`. Et skjult element er allerede ute av
      // tilgjengelighetstreet, så `aria-hidden` var overflødig, og ga en
      // hydreringsfeil i React fordi serveren ikke skriver det.
      setFlag(error, "hidden", Boolean(computed.error.hidden))
    }

    setAttr(control, "aria-describedby", computed.control["aria-describedby"])
    setAttr(control, "aria-invalid", computed.control["aria-invalid"])
    this.writtenInvalid = computed.control["aria-invalid"] ?? null
    this.lastControl = control

    if (disabled) {
      // `setFlag` og ikke `setAttr`: en mal kan ha skrevet
      // `disabled="disabled"`, og den skal stå som den er. `setAttr` ville
      // normalisert verdien til den tomme strengen, og siden `disabled` er
      // blant attributtene komponenten observerer, ville serveren og
      // komponenten skrevet hver sin verdi ved hver patch.
      setFlag(control, "disabled", true)
      setAttr(control, "aria-disabled", "true")
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
      setAttr(control, "data-state", state)
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
