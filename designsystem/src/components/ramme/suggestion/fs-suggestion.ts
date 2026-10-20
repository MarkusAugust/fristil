import { LABEL_CLASS } from "../../css/label/label.js"
import { DEFAULT_TEXTS } from "../../default-texts.js"
import {
  addClass,
  defineElement,
  derivedParts,
  HostElement,
  isServerControlled,
  languageOf,
  SERVER_CONTROLLED,
  setAttr,
  setFlag,
  setText,
  uniqueId,
  warnAboutMarkup,
} from "../../host-element.js"
import {
  SUGGESTION_EMPTY_CLASS,
  SUGGESTION_LIST_CLASS,
  SUGGESTION_OPTION_CLASS,
  SUGGESTION_VALUE_CLASS,
} from "./suggestion.js"

/**
 * Tekstene for antall treff, ett attributt per form. `count-none` er null
 * treff, og resten er formene `Intl.PluralRules` kjenner.
 */
const COUNT_ATTRIBUTES = [
  "count-none",
  "count-zero",
  "count-one",
  "count-two",
  "count-few",
  "count-many",
  "count-other",
] as const

export const FS_SUGGESTION_TAG = "fs-suggestion" as const

/**
 * Delene forslagsfeltet finner, som selektorer relativt til elementet. Komponenten
 * finner delene med disse, og manifestet beskriver dem for den som setter
 * sammen markupen selv, så de to ikke kan si noe ulikt.
 */
export const FS_SUGGESTION_PARTS = {
  /** Feltet: rollen når den står der, ellers det første inndatafeltet. */
  control: "[role='combobox'], input:not([type='hidden'])",
  /** Lista: rollen når den står der, ellers klassen. */
  list: `[role='listbox'], .${SUGGESTION_LIST_CLASS}`,
  /** Et alternativ: rollen når den står der, ellers en `<li>` uten rolle i lista. */
  option: `[role='option'], .${SUGGESTION_LIST_CLASS} > li:not([role])`,
  empty: `.${SUGGESTION_EMPTY_CLASS}`,
  status: "[role='status']",
  /** Det skjulte feltet som får koden til alternativet brukeren valgte. */
  value: `input.${SUGGESTION_VALUE_CLASS}`,
} as const

const CONTROL_SELECTOR = FS_SUGGESTION_PARTS.control
const LIST_SELECTOR = FS_SUGGESTION_PARTS.list
const OPTION_SELECTOR = FS_SUGGESTION_PARTS.option

/**
 * Tastaturet og filtreringen i et felt med forslagsliste.
 *
 * Serveren skriver feltet og lista. Lages markupen med JavaScript, skriver
 * `fs.suggestion()` rollene, id-ene og koblingen. Kommer den fra en mal uten
 * JavaScript, skriver malen `for` på ledeteksten og `id` på feltet, eller
 * legger ledeteksten rundt feltet, som HTML krever for at feltet skal ha navn
 * uten JavaScript. Resten holder det med: en `.fs-suggestion__list` med `<li>`
 * og et `[role="status"]`. Komponenten setter rollene, gir lista og
 * alternativene id, kobler lista til feltet, og lukker lista til brukeren
 * rører feltet. Bare det som mangler, så det serveren skrev står.
 *
 * Komponenten skriver aldri id på feltet. Datastar og idiomorph kjenner igjen
 * en node på id, og et felt med en id serveren ikke sendte, blir byttet ut ved
 * neste oppdatering, med fokus og det brukeren har skrevet.
 *
 * Feltet viser alltid teksten til alternativet. Har serveren skrevet et
 * skjult `.fs-suggestion__value`, får det koden fra `data-value`, eller
 * teksten når alternativet ikke har noen. Uten JavaScript sendes teksten, og serveren
 * slår opp. Komponenten rendrer ingenting. Den lagde tidligere
 * hele feltet selv, og da fantes det verken ledetekst eller inndatafelt før
 * skriptet hadde kjørt, og ingenting ble med i innsendingen.
 *
 * Det komponenten gjør er det nettleseren ikke gjør: filtrerer alternativene
 * mens brukeren skriver, flytter markeringen med piltastene, og holder
 * `aria-activedescendant` i synk slik at skjermleseren leser opp alternativet
 * uten at fokus forlater feltet.
 *
 * Har noen andre alt filtrert, en server eller en React-komponent som
 * rendrer bare treffene, sier `prefiltered` fra, og komponenten lar
 * alternativene være i fred.
 *
 * ```html
 * <fs-suggestion>
 *   <label class="fs-label" for="kommune">Kommune</label>
 *   <input class="fs-input" id="kommune" role="combobox" aria-controls="kommune-list"
 *          aria-expanded="false" aria-autocomplete="list" autocomplete="off"
 *          aria-describedby="kommune-status">
 *   <ul class="fs-suggestion__list" id="kommune-list" role="listbox" hidden>
 *     <li class="fs-suggestion__option" id="kommune-option-0" role="option">Bergen</li>
 *   </ul>
 *   <p class="fs-suggestion__empty">Ingen treff</p>
 *   <span class="fs-sr-only" id="kommune-status" role="status"></span>
 * </fs-suggestion>
 * ```
 */
export class FsSuggestion extends HostElement {
  static observedAttributes = [
    "prefiltered",
    SERVER_CONTROLLED,
    ...COUNT_ATTRIBUTES,
  ] as const

  private observer?: MutationObserver
  private control?: HTMLInputElement
  private list?: HTMLElement
  private empty?: HTMLElement
  /** Alternativene som alt har fått lytteren sin. */
  private readonly bound = new WeakSet<HTMLElement>()
  /** Id-ene komponenten selv har laget, per node, så en patch får de samme tilbake. */
  private readonly ids = new WeakMap<Element, string>()
  /** Rollene komponenten selv har satt. Se `derivedParts`. */
  private readonly roledByMe = new WeakSet<Element>()
  /** Sant mens komponenten selv sender hendelser, så den ikke svarer seg selv. */
  private choosing = false
  /**
   * Teksten og koden til valget som står i feltet, når verdifeltet er i bruk.
   *
   * Paret er det koden i verdifeltet gjelder for. Endrer brukeren teksten,
   * gjelder koden ikke lenger, og verdifeltet tømmes; ellers ville skjemaet
   * sendt koden for Bergen med teksten «Bodø» i feltet. Står teksten igjen
   * etter en oppdatering, settes koden tilbake: verdifeltets `value` er et
   * attributt, og en morfing skriver serverens over det komponenten satte.
   */
  private chosen?: { label: string; value: string }
  /**
   * Det serveren sendte som tekst og kode, sist noen andre enn komponenten
   * skrev koden. Tilbakestilles skjemaet, går teksten tilbake til serverens,
   * og koden skal følge med: et skjult felt har ingen egen standardverdi å
   * gå tilbake til, siden komponenten skriver koden som attributt.
   */
  private serverChoice?: { label: string; value: string }
  /** Koden komponenten selv skrev sist. Står noe annet der, var det serveren. */
  private writtenCode?: string
  /** Skjemaet `reset` lyttes på. Følger feltet, som en patch kan flytte. */
  private boundForm?: HTMLFormElement | null
  /** `for` komponenten selv skrev på ledeteksten. */
  private readonly forByMe = new WeakMap<Element, string>()
  /**
   * Ledetekster der serveren skrev en `for` som pekte på en annen id. Sies
   * fra om én gang; minnet nullstilles ikke, siden den omskrevne `for` ikke
   * kan skilles fra en server som rettet seg.
   */
  private readonly wrongFor = new WeakSet<Element>()
  /**
   * Om lista står åpen, og hvilket alternativ som er markert.
   *
   * Begge deler er brukerens: hun skrev noe, og hun blar med piltastene.
   * Ingenting av det står i HTML-en serveren sendte, så en morfing river det
   * bort. Før måtte malen liste opp `aria-expanded`,
   * `aria-activedescendant` og `hidden` i `data-preserve-attr`. Nå setter
   * komponenten det tilbake, så lenge morfingen beholder feltet. Det gjør
   * den bare når id-en stemmer, se `warnAboutReplacedControl`.
   */
  private wantOpen?: boolean
  /**
   * Alternativet som er markert, husket med både id og tekst.
   *
   * Id-ene fra `fs.suggestion()` er posisjonelle, så en ny liste fra serveren
   * gjenbruker dem. Med id alene satte komponenten markeringen tilbake på
   * alternativ nummer to i en helt annen liste, og skjermleseren leste opp en
   * kommune brukeren aldri navigerte til. Teksten er identiteten; id-en er
   * bare der `aria-activedescendant` skal peke.
   */
  private active?: { id: string; label: string; value: string | null }
  /**
   * Antallet som sist ble lest opp, når noen andre filtrerer.
   *
   * Bare endringer skal leses opp, og det første antallet er
   * utgangspunktet og ikke en nyhet. Se `announceFiltered`.
   */
  private announcedCount?: number
  /**
   * Teksten som sist ble skrevet i statuselementet.
   *
   * Teksten finnes ikke i serverens utgave, så en oppdatering som sender
   * området på nytt tømmer elementet. `repair()` skriver den tilbake.
   */
  private announcedText?: string

  connectedCallback(): void {
    /*
     * Attributtene er med, ikke bare barna. Hver skriving under sammenligner
     * først, ellers ville observatøren utløst seg selv i det uendelige.
     */
    this.observer = new MutationObserver(() => this.sync())
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "aria-expanded",
        "aria-selected",
        "aria-activedescendant",
        // Koblingen komponenten fyller inn når markupen kom uten den.
        "role",
        "id",
        "for",
        "aria-controls",
        "autocomplete",
        "aria-autocomplete",
        "class",
        // Verdifeltets `value` er et attributt, og en morfing kan skrive
        // serverens tomme verdi over koden brukeren valgte.
        "value",
        // `form` på feltet velger hvilket skjema tilbakestillingen hører til.
        "form",
        // Et felt som blir `readonly` eller `disabled` skal lukke lista.
        "readonly",
        "disabled",
        "aria-disabled",
      ],
    })
    this.sync()
    // Lista lukkes når fokus forlater komponenten, med Tab som med alt annet.
    // På verten og ikke på feltet: går fokus via en knapp inni komponenten og
    // så videre ut, skal lista lukkes da også. Uten dette ble den stående
    // over neste felt, med `aria-expanded` sann på et felt uten fokus.
    this.addEventListener("focusout", this.handleFocusOut)
  }

  attributeChangedCallback(name: string): void {
    if (name === SERVER_CONTROLLED && isServerControlled(this)) {
      this.wantOpen = undefined
      this.active = undefined
    }

    /*
     * Attributtet kan komme og gå mens siden lever, og da skal lista rettes
     * opp med en gang framfor ved neste tastetrykk. `this.observer` er
     * beskjeden om at komponenten står i dokumentet: tilbakekallet kommer
     * også under oppgraderingen, før barna finnes.
     */
    if (name === "prefiltered" && this.observer) {
      // Antallet som står der i det attributtet settes er utgangspunktet, og
      // ikke noe å lese opp. Uten dette ble den første endringen etterpå
      // regnet som utgangspunktet, og gikk tapt.
      this.announcedCount = this.prefiltered ? this.visible.length : undefined
      this.filter()
    }
  }

  private sync(): void {
    this.wire()
    this.bind()
    this.repair()
    this.announceFiltered()
  }

  /** Id-en et element skal ha: sin egen, ellers den komponenten laget sist. */
  private rememberedId(element: Element, prefix: string): string {
    if (element.id) return element.id
    let id = this.ids.get(element)
    if (!id) {
      id = uniqueId(prefix)
      this.ids.set(element, id)
    }
    return id
  }

  /**
   * Fyller inn koblingen der markupen kom uten den. Bare det som mangler.
   *
   * Lista lukkes når markupen ikke sier noe om den, altså når verken
   * `aria-expanded` på feltet eller `hidden` på lista står der. Sier
   * markupen én av delene, er det serverens ord om begge, som med
   * `fs.suggestion({ open: true })`.
   */
  private wire(): void {
    const control = this.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
    if (!control) return

    if (!control.hasAttribute("role")) setAttr(control, "role", "combobox")
    if (!control.hasAttribute("autocomplete")) {
      setAttr(control, "autocomplete", "off")
    }
    if (!control.hasAttribute("aria-autocomplete")) {
      setAttr(control, "aria-autocomplete", "list")
    }
    const label = this.querySelector("label")
    const root = this.getRootNode() as Document | ShadowRoot

    if (label) {
      addClass(label, LABEL_CLASS)
      // `for` og `id` er den samme opplysningen, og skrives fra feltets id,
      // aldri motsatt: komponenten skriver ikke id på feltet. Står
      // ledeteksten rundt feltet, er koblingen implisitt. Samme regel som i
      // `<fs-field>`.
      if (control.id && !label.contains(control)) {
        const current = label.getAttribute("for")
        if (
          current !== null &&
          current !== control.id &&
          current !== this.forByMe.get(label)
        ) {
          this.wrongFor.add(label)
        }
        setAttr(label, "for", control.id)
        this.forByMe.set(label, control.id)
      }
      warnAboutMarkup(
        this,
        "for på ledeteksten pekte på en annen id enn feltets. Komponenten " +
          "skrev den om, men uten JavaScript hadde feltet da ingen ledetekst, " +
          "og en skjermleser leste det opp uten navn. Gi ledeteksten feltets " +
          "id i malen.",
        () => {
          const now = this.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
          const labelNow = this.querySelector("label")
          return (
            now !== null && labelNow !== null && this.wrongFor.has(labelNow)
          )
        },
      )
      warnAboutMarkup(
        this,
        "<label> er ikke koblet til feltet: feltet har ingen id, og " +
          "ledeteksten står ikke rundt det. Uten JavaScript har feltet da " +
          "ingen ledetekst, og en skjermleser leser det opp uten navn. Skriv " +
          "id på feltet og samme for på ledeteksten, eller legg <label> rundt " +
          "feltet. Komponenten lager ikke " +
          "id-en selv: en id serveren ikke sendte, får en oppdatering fra " +
          "serveren til å bytte ut feltet.",
        () => {
          const now = this.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
          const labelNow = this.querySelector("label")
          return (
            now !== null &&
            labelNow !== null &&
            !now.id &&
            !labelNow.contains(now) &&
            !now.hasAttribute("aria-label") &&
            !now.hasAttribute("aria-labelledby")
          )
        },
      )
      // `for` går foran det at ledeteksten står rundt feltet. Peker den på en
      // annen id, har feltet ingen ledetekst, også med JavaScript.
      warnAboutMarkup(
        this,
        "<label> står rundt feltet, men for på ledeteksten peker på en annen " +
          "id enn feltets. for går foran, så feltet har ingen ledetekst, og en " +
          "skjermleser leser det opp uten navn. Ta bort for, eller gi feltet " +
          "den samme id-en.",
        () => {
          const now = this.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
          const labelNow = this.querySelector("label")
          if (!now || !labelNow?.contains(now)) return false
          const target = labelNow.getAttribute("for")
          return target !== null && target !== now.id
        },
      )
    } else {
      // Uten ledetekst inni kan den stå utenfor, med `for` på feltets id.
      // Den får klassen, som i `<fs-field>`; en patch av dette området
      // rører den ikke, så den trenger ingen reparasjon.
      if (control.id) {
        const outside = (
          this.getRootNode() as Document | ShadowRoot
        ).querySelector?.(`label[for="${CSS.escape(control.id)}"]`)
        if (outside) addClass(outside, LABEL_CLASS)
      }
      warnAboutMarkup(
        this,
        "fant ingen <label>. Feltet får da ingen ledetekst, og en " +
          "skjermleser leser det opp uten navn. Står ledeteksten utenfor " +
          "<fs-suggestion>, må for på den peke på id-en til feltet.",
        () => {
          const now = this.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
          if (!now || this.querySelector("label")) return false
          // En <label> rundt hele <fs-suggestion> gir også feltet et navn.
          if ((now.labels?.length ?? 0) > 0) return false
          if (
            now.hasAttribute("aria-label") ||
            now.hasAttribute("aria-labelledby")
          )
            return false
          const rootNow = this.getRootNode() as Document | ShadowRoot
          return !(
            now.id &&
            rootNow.querySelector?.(`label[for="${CSS.escape(now.id)}"]`)
          )
        },
      )
    }

    const list = this.listElement
    if (list) {
      addClass(list, SUGGESTION_LIST_CLASS)
      if (!list.hasAttribute("role")) setAttr(list, "role", "listbox")
      if (!list.id) {
        // Samme regel som for feltet: peker `aria-controls` på ingenting,
        // er det den id-en den nye lista skal ha.
        const wanted = control.getAttribute("aria-controls")
        const free = wanted && !root.getElementById?.(wanted)
        if (free) this.ids.set(list, wanted)
        setAttr(list, "id", this.rememberedId(list, "fs-suggestion-list"))
      }
      if (!control.hasAttribute("aria-controls")) {
        setAttr(control, "aria-controls", list.id)
      }
      if (!control.hasAttribute("aria-expanded")) {
        if (!list.hasAttribute("hidden")) setFlag(list, "hidden", true)
        setAttr(control, "aria-expanded", "false")
      }
    }

    for (const option of this.options) {
      addClass(option, SUGGESTION_OPTION_CLASS)
      if (!option.hasAttribute("role")) {
        setAttr(option, "role", "option")
        this.roledByMe.add(option)
      }
      if (!option.id) {
        setAttr(option, "id", this.rememberedId(option, "fs-suggestion-option"))
      }
    }
  }

  /**
   * Setter brukerens tilstand tilbake etter en patch.
   *
   * Filtreringen regnes ut på nytt av det som står i feltet, så den trenger
   * ingen hukommelse. Det lista viser og hva som er markert gjør det.
   */
  private repair(): void {
    if (!this.control) return

    // Koden settes tilbake også under `server-controlled`. Attributtet gjelder
    // om lista står åpen og hva som er markert, ikke hva brukeren valgte.
    const valueField = this.valueField
    if (
      valueField &&
      this.chosen &&
      this.control.value === this.chosen.label &&
      valueField.value === ""
    ) {
      this.writeCode(valueField, this.chosen.value)
    }

    // Et tømt statuselement får teksten tilbake mens lista står åpen, der
    // antallet er det brukeren holder på med. Ikke ellers: hver patch av
    // området ville ellers lest det gamle antallet opp på nytt. Og ikke når
    // noen andre filtrerer: da er en patch svaret på et tastetrykk, og
    // `announceFiltered` leser det nye antallet rett etter.
    const status = this.querySelector<HTMLElement>(FS_SUGGESTION_PARTS.status)
    if (
      status &&
      this.wantOpen === true &&
      !this.prefiltered &&
      this.announcedText !== undefined &&
      (status.textContent ?? "").trim() === ""
    ) {
      setText(status, this.announcedText)
    }

    if (isServerControlled(this)) return

    // Et felt som ble `readonly` eller `disabled` mens lista sto åpen, lukker
    // den. Ellers holdt reparasjonen den åpen, og Escape gjør ingenting i et
    // låst felt.
    if (this.locked && this.wantOpen) this.setOpen(false)

    if (this.wantOpen !== undefined) {
      /*
       * Begge delene sjekkes hver for seg. En patch som bare rører feltet lot
       * `aria-expanded="false"` stå mens alternativene var synlige, og
       * skjermleseren meldte at lista var lukket mens den sto på skjermen.
       */
      const list = this.listElement
      const expanded = this.control.getAttribute("aria-expanded")
      if (
        (list && list.hidden === this.wantOpen) ||
        expanded !== String(this.wantOpen)
      ) {
        this.applyOpen(this.wantOpen)
      }
      if (this.wantOpen) this.filter()
    }

    if (this.active) {
      /*
       * Teksten er det som gjelder, og alternativet må være synlig. Ellers
       * markerte komponenten noe serveren nettopp hadde filtrert bort, og
       * `aria-activedescendant` pekte på et skjult element. Id-en er en
       * reserve: sender serveren lista på nytt, byttes alternativene ut og
       * får nye id-er, og markeringen gjenfinnes på teksten. Koden teller
       * med, siden to kommuner kan hete det samme.
       */
      const sameText = (o: HTMLElement) =>
        (o.textContent ?? "").trim() === this.active?.label &&
        o.getAttribute("data-value") === this.active?.value
      const option =
        this.visible.find((o) => o.id === this.active?.id && sameText(o)) ??
        this.visible.find(sameText)
      if (!option) {
        // Pekeren må bort sammen med markeringen. Uten dette pekte
        // `aria-activedescendant` på et alternativ som nå heter noe annet, og
        // skjermleseren leste opp en kommune brukeren aldri navigerte til.
        this.active = undefined
        this.control.removeAttribute("aria-activedescendant")
      } else if (
        option.getAttribute("aria-selected") !== "true" ||
        this.control.getAttribute("aria-activedescendant") !== option.id
      ) {
        // Begge sidene av koblingen sjekkes. Rev patchen bare
        // `aria-activedescendant`, mens markeringen sto igjen, mistet
        // skjermleseren lesepunktet sitt uten at noe annet så galt ut.
        this.markOption(option)
      }
    }
  }

  disconnectedCallback(): void {
    this.removeEventListener("focusout", this.handleFocusOut)
    this.observer?.disconnect()
    this.observer = undefined
    this.unbind()
  }

  /**
   * Noen andre har alt filtrert, så komponenten skal la være.
   *
   * Navnet het `server-filtered` før, og det var misvisende: det handler ikke
   * om servere. En React-app som rendrer bare treffene har filtrert like
   * fullt, uten at noen server er involvert.
   *
   * Komponenten skjuler et alternativ når teksten ikke inneholder det som
   * står i feltet. Filtrerer du på noe annet, uten diakritikk, på en kode som
   * ikke vises eller uskarpt, blir de to uenige, og da er det ditt filter som
   * skal gjelde. Attributtet slår av både skjulingen og tommeldingen, altså
   * alt som handler om hva lista viser. Opplesningen av antall treff blir
   * igjen, siden den ikke er markup.
   */
  get prefiltered(): boolean {
    return this.hasAttribute("prefiltered")
  }

  set prefiltered(on: boolean) {
    /*
     * Setteren er ikke pynt. React 19 skriver egenskapen framfor attributtet
     * når en web component har en med det navnet, og en getter alene
     * kaster «Cannot set property prefiltered». Attributtet landet aldri, og
     * komponenten skjulte det React nettopp hadde rendret. Bindestreken i det
     * gamle navnet skjulte problemet: `server-filtered` kan ikke være et
     * egenskapsnavn, så React sendte det som attributt.
     */
    setFlag(this, "prefiltered", on)
  }

  private get listElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>(LIST_SELECTOR)
  }

  private get emptyElement(): HTMLElement | null {
    return this.querySelector<HTMLElement>(FS_SUGGESTION_PARTS.empty)
  }

  private get valueField(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>(FS_SUGGESTION_PARTS.value)
  }

  /** Feltet tar ikke imot noe: `readonly` eller `disabled`. */
  private get locked(): boolean {
    return Boolean(this.control?.readOnly || this.control?.disabled)
  }

  /**
   * Alternativene, kjent igjen på rollen og ikke på klassen.
   *
   * Rollen må stå der uansett, for skjermleseren. En mal som skriver
   * `<li role="option">` med egen styling fikk verken filtrering eller
   * piltaster da komponenten så etter klassen, og ingen sa fra.
   */
  private get options(): HTMLElement[] {
    return derivedParts<HTMLElement>(
      this,
      OPTION_SELECTOR,
      "option",
      this.roledByMe,
    )
  }

  /**
   * Hvilket synlig alternativ som er markert nå.
   *
   * Den leses fra `aria-selected` i markupen, ikke fra en teller inni
   * komponenten. Serveren kan sette markeringen selv med
   * `fs.suggestion({ activeIndex })`, og en parallell teller ville hoppet
   * til toppen av lista ved første piltast i stedet for til alternativet
   * etter. Filtreringen flytter også på alternativene, og da svarer
   * oppslaget riktig av seg selv.
   */
  private get activeIndex(): number {
    return this.selectable.findIndex(
      (option) => option.getAttribute("aria-selected") === "true",
    )
  }

  /** Alternativene som er synlige nå. */
  private get visible(): HTMLElement[] {
    return this.options.filter((option) => !option.hidden)
  }

  /**
   * De synlige alternativene som kan velges. Et alternativ med
   * `aria-disabled="true"` vises, men hoppes over av piltastene og kan ikke
   * velges, verken med tastatur eller mus.
   */
  private get selectable(): HTMLElement[] {
    return this.visible.filter(
      (option) => option.getAttribute("aria-disabled") !== "true",
    )
  }

  private unbind(): void {
    const control = this.control
    if (control) {
      control.removeEventListener("input", this.handleInput)
      control.removeEventListener("keydown", this.handleKeydown)
      control.removeEventListener("focus", this.handleFocus)
      this.control = undefined
    }
    this.boundForm?.removeEventListener("reset", this.handleReset)
    this.boundForm = undefined
    this.list?.removeEventListener("mousedown", this.handleListMouseDown)
    this.list = undefined
    this.empty?.removeEventListener("mousedown", this.handleListMouseDown)
    this.empty = undefined
  }

  /**
   * Sier fra når en oppdatering byttet ut feltet fordi id-en fra serveren
   * endret seg.
   *
   * Beskjeden kommer bare når brukeren hadde noe å miste: det gamle feltet er
   * ute av treet, begge hadde en id fra serveren, id-ene er ulike, `name` er
   * det samme, og det sto noe annet i det gamle feltet enn i det nye. En
   * server som sender teksten tilbake, har ikke mistet den.
   */
  private warnAboutReplacedControl(
    lost: HTMLInputElement,
    control: HTMLInputElement,
  ): void {
    if (lost.isConnected || !lost.id || !control.id || lost.id === control.id)
      return
    if (lost.getAttribute("name") !== control.getAttribute("name")) return
    if (lost.value === control.value) return

    warnAboutMarkup(
      this,
      "en oppdatering fra serveren byttet ut feltet, og det brukeren hadde " +
        "skrevet gikk tapt, sammen med fokus og lista. Id-en på feltet var en " +
        "annen enn sist, og da kjenner oppdateringen ikke feltet igjen. Lag " +
        "id-en av noe som er det samme hver gang, som navnet på feltet eller en " +
        "nøkkel i dataene, ikke av et tilfeldig tall eller en teller.",
      // Byttet har skjedd og kan ikke gå over av seg selv, med mindre en ny
      // oppdatering alt har byttet feltet igjen.
      () =>
        !lost.isConnected &&
        this.querySelector<HTMLInputElement>(CONTROL_SELECTOR) === control,
    )
  }

  private bind(): void {
    const control = this.querySelector<HTMLInputElement>(CONTROL_SELECTOR)
    if (!control) {
      warnAboutMarkup(
        this,
        'fant ingen felt: verken et <input> eller en [role="combobox"]. ' +
          "Uten det vet komponenten ikke hvilket felt den skal lytte på, " +
          "og verken filtrering eller piltaster virker.",
        // Et tomt element er et område serveren ikke har fylt ennå, og det
        // er ikke en feil i markupen.
        () =>
          this.childElementCount > 0 &&
          this.querySelector(CONTROL_SELECTOR) === null,
      )
      // Feltet er borte. Firefox sender ingen `focusout` når noden med fokus
      // fjernes, så lista ville ellers stått åpen uten et felt.
      this.wantOpen = undefined
      this.active = undefined
      const orphan = this.listElement
      if (orphan) setFlag(orphan, "hidden", true)
      return
    }

    warnAboutMarkup(
      this,
      'fant ingen liste: verken en [role="listbox"] eller en ' +
        ".fs-suggestion__list. Alternativene kan da verken vises, " +
        "filtreres eller velges med tastaturet.",
      () => this.querySelector(CONTROL_SELECTOR) !== null && !this.listElement,
    )

    // Antall treff leses opp i et statuselement serveren sender. Uten det
    // får den som ikke ser skjermen ingen beskjed om at lista snevret seg
    // inn, og før sto komponenten da bare stille.
    warnAboutMarkup(
      this,
      'fant ingen [role="status"]. Antall treff leses da ikke opp for den ' +
        "som ikke ser skjermen. Skriv et tomt element med rollen, som " +
        "`fs.suggestion()` gjør.",
      () =>
        this.querySelector(CONTROL_SELECTOR) !== null &&
        this.listElement !== null &&
        this.querySelector(FS_SUGGESTION_PARTS.status) === null,
    )

    if (control !== this.control) {
      if (this.control) this.warnAboutReplacedControl(this.control, control)
      // Det nye feltet har ikke fokus. Åpen liste og markering hørte til det
      // gamle.
      this.wantOpen = undefined
      this.active = undefined
      // Et verdifelt serveren fylte, gjelder teksten som står i feltet nå.
      const valueField = this.valueField
      this.serverChoice =
        valueField && valueField.value !== ""
          ? { label: control.value, value: valueField.value }
          : undefined
      this.chosen = this.serverChoice
      this.control?.removeEventListener("input", this.handleInput)
      this.control?.removeEventListener("keydown", this.handleKeydown)
      this.control?.removeEventListener("focus", this.handleFocus)
      control.addEventListener("input", this.handleInput)
      control.addEventListener("keydown", this.handleKeydown)
      control.addEventListener("focus", this.handleFocus)
      this.control = control
    }
    // Skjemaet leses hver gang: `form` på feltet kan peke på et annet uten
    // at noe flyttes.
    const form = control.form
    if (form !== this.boundForm) {
      this.boundForm?.removeEventListener("reset", this.handleReset)
      form?.addEventListener("reset", this.handleReset)
      this.boundForm = form
    }
    const code = this.valueField?.value ?? ""
    if (
      code !== "" &&
      code !== this.writtenCode &&
      code !== this.chosen?.value
    ) {
      // Noen andre enn komponenten skrev koden: serverens ord.
      this.serverChoice = { label: control.value, value: code }
      this.chosen = this.serverChoice
    }

    /*
     * Et trykk i lista eller på tommeldingen skal ikke ta fokus fra feltet,
     * heller ikke på rullefeltet. Ellers lukket `focusout` lista før valget
     * rakk å skje. Begge kan byttes ut av en patch, så lytterne følger
     * elementene.
     */
    const list = this.listElement
    if (list !== this.list) {
      this.list?.removeEventListener("mousedown", this.handleListMouseDown)
      list?.addEventListener("mousedown", this.handleListMouseDown)
      this.list = list ?? undefined
    }
    const empty = this.emptyElement
    if (empty !== this.empty) {
      this.empty?.removeEventListener("mousedown", this.handleListMouseDown)
      empty?.addEventListener("mousedown", this.handleListMouseDown)
      this.empty = empty ?? undefined
    }

    // Alternativene byttes ut uavhengig av feltet: i en Datastar-app sender
    // serveren en ny liste mens brukeren skriver. Lå dette bak sjekken over,
    // fikk de nye alternativene aldri lytteren sin, og valg med mus sluttet
    // å virke etter første oppdatering.
    for (const option of this.options) {
      if (this.bound.has(option)) continue
      option.addEventListener("mousedown", this.handleOptionMouseDown)
      option.addEventListener("click", this.handleOptionClick)
      this.bound.add(option)
    }
  }

  private setOpen(open: boolean): void {
    /*
     * En liste uten alternativer under et tomt felt har ingenting å vise,
     * og åpnes ikke. Uten dette åpnet fokus en tom liste, og et felt som
     * venter på sitt første søk viste «Ingen treff» før brukeren hadde
     * skrevet et tegn: tommeldingen følger lista, og lista var åpen.
     */
    const show = open && this.hasSomethingToShow()
    this.wantOpen = show
    this.applyOpen(show)
  }

  private hasSomethingToShow(): boolean {
    return this.options.length > 0 || (this.control?.value ?? "").trim() !== ""
  }

  /** Skriver tilstanden ut i markupen, uten å endre hva brukeren ville. */
  private applyOpen(open: boolean): void {
    const list = this.listElement
    if (!list || !this.control) return

    setFlag(list, "hidden", !open)
    setAttr(this.control, "aria-expanded", String(open))
    this.syncEmpty()

    if (!open) {
      this.active = undefined
      this.control.removeAttribute("aria-activedescendant")
      for (const option of this.options) {
        setAttr(option, "aria-selected", "false")
      }
    }
  }

  /**
   * Tommeldingen følger lista: synlig bare når lista er åpen og tom.
   *
   * Den er søsken til lista og ikke barn, så `hidden` på lista skjulte den
   * ikke, og «Ingen treff» ble stående under et lukket felt etter Escape.
   * Har noen andre filtrert, styrer de også tommeldingen.
   */
  private syncEmpty(): void {
    if (this.prefiltered) return
    const empty = this.emptyElement
    const list = this.listElement
    if (!empty || !list) return
    setFlag(empty, "hidden", Boolean(list.hidden) || this.visible.length > 0)
  }

  /**
   * Skjuler det som ikke passer, og melder hvor mange som er igjen.
   *
   * Kjøres når brukeren skriver eller setter fokus i feltet, og på nytt
   * etter en patch mens lista er åpen, siden patchen kan ha byttet ut
   * alternativene.
   */
  private filter(): void {
    /*
     * Har noen andre filtrert, bestemmer de hva lista viser, og tommeldingen er
     * en del av det. Komponenten rører derfor ingenting her, og opplesningen
     * kommer fra `announceFiltered` i stedet.
     *
     * To utgaver var feil før denne. Den første returnerte med en gang, og
     * da satt en Datastar-app igjen uten opplesning av antall treff i det
     * hele tatt. Den andre telte her: da meldte et tomt felt «Ingen treff»
     * allerede ved fokus, før brukeren hadde skrevet et tegn, og et
     * asynkront søk meldte det på nytt ved hvert tastetrykk mens svaret
     * fortsatt var underveis. Komponenten satte samtidig tommeldingen synlig
     * igjen etter at appen hadde skjult den, og det fantes ingen vei utenom.
     */
    if (this.prefiltered) return

    const query = (this.control?.value ?? "").trim().toLowerCase()
    for (const option of this.options) {
      const label = (option.textContent ?? "").trim().toLowerCase()
      setFlag(option, "hidden", query !== "" && !label.includes(query))
    }

    this.dropHiddenMark()
    this.syncEmpty()
    this.announce(this.visible.length)
  }

  /**
   * Tar bort markeringen fra et alternativ filtreringen nettopp skjulte.
   *
   * Ryddingen hører her, der skjulingen skjer, og ikke bare i `repair()`:
   * den returnerer med en gang under `server-controlled`, og da pekte
   * `aria-activedescendant` på et skjult alternativ, som skjermleseren leste
   * opp likevel.
   */
  private dropHiddenMark(): void {
    const control = this.control
    if (!control) return

    const marked = this.options.find(
      (option) => option.getAttribute("aria-selected") === "true",
    )
    if (marked?.hidden) {
      setAttr(marked, "aria-selected", "false")
      if (this.active?.id === marked.id) this.active = undefined
    }

    const pointed = control.getAttribute("aria-activedescendant")
    if (pointed) {
      const target = this.options.find((option) => option.id === pointed)
      if (!target || target.hidden) {
        control.removeAttribute("aria-activedescendant")
      }
    }
  }

  /**
   * Leser opp antallet når noen andre har filtrert.
   *
   * Lista endrer seg da ikke av et tastetrykk, men av at appen rendrer på
   * nytt, og det er nettopp den endringen observatøren ser. Beskjeden hører
   * hjemme her og ikke i `filter()`, for mellom tastetrykket og det nye
   * svaret kan det gå et halvt sekund over nettverket.
   *
   * Bare endringer leses opp. Det første antallet er utgangspunktet og ikke
   * en nyhet, og det står ofte 0 der fordi appen ikke har rendret lista
   * ennå.
   */
  private announceFiltered(): void {
    if (!this.prefiltered) return

    const hits = this.visible.length
    if (hits === this.announcedCount) return

    const first = this.announcedCount === undefined
    this.announcedCount = hits
    if (!first) this.announce(hits)
  }

  /**
   * Melder antall treff.
   *
   * Uten dette får den som ikke ser skjermen ingen beskjed om at lista
   * snevret seg inn mens hun skrev. Teksten er klientgenerert, og
   * `repair()` skriver den tilbake når en oppdatering tømmer elementet.
   * Mangler elementet, har `bind()` alt sagt fra.
   */
  private announce(hits: number): void {
    const status = this.querySelector<HTMLElement>(FS_SUGGESTION_PARTS.status)
    if (!status) return

    this.announcedText = this.countText(hits)
    setText(status, this.announcedText)
  }

  /**
   * Teksten for et antall, på sidens språk.
   *
   * `count-none` gjelder null treff, siden «Ingen treff» er en egen setning
   * og ikke en bøyning. Ellers velger `Intl.PluralRules` formen språket
   * krever, og `count-<form>` gir teksten, med `{n}` for tallet. Mangler
   * formen, gjelder `count-other`. Mangler den også, er teksten norsk.
   */
  private countText(hits: number): string {
    const lang = languageOf(this)
    const written = (name: string) => this.getAttribute(name)
    const form = new Intl.PluralRules(lang).select(hits)
    const template =
      (hits === 0 ? written("count-none") : null) ??
      written(`count-${form}`) ??
      written("count-other")
    const number = new Intl.NumberFormat(lang).format(hits)
    if (template !== null) return template.replaceAll("{n}", number)
    const fallback =
      hits === 0
        ? DEFAULT_TEXTS.suggestionNone
        : hits === 1
          ? DEFAULT_TEXTS.suggestionOne
          : DEFAULT_TEXTS.suggestionOther
    return fallback.replaceAll("{n}", number)
  }

  private markActive(index: number): void {
    const shown = this.selectable
    if (shown.length === 0 || !this.control) return

    const next = (index + shown.length) % shown.length

    this.markOption(shown[next])
    shown[next].scrollIntoView({ block: "nearest" })
  }

  /** Markerer ett alternativ, og husker hvilket. */
  private markOption(option: HTMLElement): void {
    if (!this.control) return

    for (const other of this.options) {
      setAttr(other, "aria-selected", other === option ? "true" : "false")
    }

    this.active = {
      id: option.id,
      label: (option.textContent ?? "").trim(),
      value: option.getAttribute("data-value"),
    }
    // aria-activedescendant flytter skjermleserens lesepunkt uten at fokus
    // forlater feltet. Uten den leses alternativet aldri opp.
    setAttr(this.control, "aria-activedescendant", option.id)
  }

  private choose(option: HTMLElement): void {
    if (!this.control || this.locked) return
    if (option.getAttribute("aria-disabled") === "true") return

    const label = (option.textContent ?? "").trim()
    const value = option.getAttribute("data-value") ?? label
    /*
     * Setteren fra prototypekjeden, forbi en `value` React har lagt på selve
     * noden for å følge med. Satt rett på noden så React ingen endring,
     * `onChange` kom aldri, og ved neste rendring skrev React den gamle
     * teksten tilbake i feltet. Kjeden og ikke bare nærmeste prototype, så
     * `<textarea>` og en underklasse av `<input>` også virker.
     */
    let setter: ((v: string) => void) | undefined
    for (
      let proto = Object.getPrototypeOf(this.control);
      proto && !setter;
      proto = Object.getPrototypeOf(proto)
    ) {
      setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    }
    // Feltet viser teksten. Koden går til verdifeltet, når serveren har
    // skrevet et, og i hendelsen. Før havnet `data-value` i feltet, og
    // brukeren som valgte Bergen, så «4601».
    if (setter) setter.call(this.control, label)
    else this.control.value = label

    const valueField = this.valueField
    if (valueField) {
      this.writeCode(valueField, value)
      this.chosen = { label, value }
    }

    // Flagget må stå før hendelsene sendes. `input` er den samme hendelsen
    // komponenten selv lytter på, så uten dette åpner lista seg igjen i det
    // øyeblikket brukeren har valgt noe.
    this.choosing = true
    this.control.dispatchEvent(new Event("input", { bubbles: true }))
    this.control.dispatchEvent(new Event("change", { bubbles: true }))
    this.choosing = false

    this.setOpen(false)
    this.dispatchEvent(
      new CustomEvent("suggestion-select", {
        detail: { value, label },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * Skriver koden i verdifeltet og sender `input` og `change` på det, så
   * `data-bind` i Datastar ser koden. Hendelsene bobler ikke: en
   * `data-on:input` på verten, som oppskriften bruker til å hente forslag,
   * skal ikke utløse et søk på koden hver gang brukeren velger.
   */
  private writeCode(valueField: HTMLInputElement, code: string): void {
    if (valueField.value === code) return
    this.writtenCode = code
    setAttr(valueField, "value", code)
    // Et skjult felt leser attributtet. Har feltet en annen type, og en
    // morfing alt har satt egenskapen, teller ikke attributtet lenger.
    if (valueField.value !== code) valueField.value = code
    valueField.dispatchEvent(new Event("input"))
    valueField.dispatchEvent(new Event("change"))
  }

  /**
   * Skjemaet tilbakestilles. Nettleseren setter teksten tilbake til
   * serverens etter at hendelsen er sendt, så koden settes i neste omgang,
   * etter at tilbakestillingen er gjort. Teksten som står der da avgjør:
   * er den serverens, gjelder serverens kode; er den det valgte, står koden;
   * ellers koden til alternativet med den teksten, ellers ingen. Serverens
   * står først fordi to alternativer kan hete det samme: valgte brukeren det
   * andre Våler, går tilbakestillingen til serverens. Serveren kan også ha
   * sendt det valgte tilbake, og da er det serverens ord like mye som
   * brukerens.
   */
  private handleReset = (): void => {
    setTimeout(() => {
      const valueField = this.valueField
      if (!valueField || !this.control) return
      const text = this.control.value
      const option = this.options.find(
        (o) => (o.textContent ?? "").trim() === text,
      )
      const code =
        this.serverChoice && text === this.serverChoice.label
          ? this.serverChoice.value
          : this.chosen && text === this.chosen.label
            ? this.chosen.value
            : option
              ? (option.getAttribute("data-value") ?? text)
              : ""
      this.writeCode(valueField, code)
      this.chosen = code !== "" ? { label: text, value: code } : undefined
    }, 0)
  }

  private handleInput = (): void => {
    if (this.choosing) return
    // Brukeren endret teksten etter et valg. Koden gjelder ikke lenger.
    // Skriver brukeren det valgte på nytt, etter at en oppdatering tømte
    // begge, kommer koden tilbake med en gang.
    const valueField = this.valueField
    if (valueField && this.chosen) {
      if (this.control?.value !== this.chosen.label) {
        this.writeCode(valueField, "")
        this.chosen = undefined
      } else if (valueField.value === "") {
        this.writeCode(valueField, this.chosen.value)
      }
    }
    if (this.locked) return
    this.filter()
    this.setOpen(true)
  }

  private handleFocus = (): void => {
    if (this.locked) return
    this.filter()
    this.setOpen(true)
  }

  private handleFocusOut = (event: FocusEvent): void => {
    // Går fokus til noe inne i komponenten, som en knapp ved siden av
    // feltet, står lista.
    const next = event.relatedTarget
    if (next instanceof Node && this.contains(next)) return
    this.setOpen(false)
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    // Under en IME-komposisjon hører tastene til komposisjonen. Enter
    // bekrefter tegnene, og skal ikke velge det markerte alternativet.
    if (event.isComposing || event.keyCode === 229) return
    if (this.locked) return
    const open = this.listElement?.hidden === false

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) {
        this.filter()
        this.setOpen(true)
      }
      this.markActive(this.activeIndex + 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      // Lista må åpnes først, som med pil ned. Uten det pekte
      // `aria-activedescendant` på et alternativ i en liste feltet samtidig
      // meldte som lukket, og skjermleseren leste opp noe som ikke sto på
      // skjermen.
      if (!open) {
        this.filter()
        this.setOpen(true)
      }
      // Er ingenting markert, går pil opp til det siste. `activeIndex - 1`
      // ville gitt det nest siste, siden ingenting markert er -1.
      this.markActive(this.activeIndex < 0 ? -1 : this.activeIndex - 1)
    } else if (
      (event.key === "PageUp" || event.key === "PageDown") &&
      open &&
      this.selectable.length > 0
    ) {
      // Home og End flytter markøren i teksten, og røres ikke. PgUp og PgDn
      // går til første og siste alternativ.
      event.preventDefault()
      this.markActive(event.key === "PageUp" ? 0 : this.selectable.length - 1)
    } else if (event.key === "Enter" && open && this.activeIndex >= 0) {
      event.preventDefault()
      const chosen = this.selectable[this.activeIndex]
      if (chosen) this.choose(chosen)
    } else if (event.key === "Escape" && open) {
      event.preventDefault()
      this.setOpen(false)
    }
  }

  private handleListMouseDown = (event: Event): void => {
    event.preventDefault()
  }

  private handleOptionMouseDown = (event: Event): void => {
    // Holder fokus i feltet. Uten dette mistet feltet fokus før `click`, og
    // `focusout` lukket lista før valget rakk å skje.
    event.preventDefault()
  }

  private handleOptionClick = (event: Event): void => {
    // Valget skjer på `click`, som hjelpemidler også sender når de aktiverer
    // et element. Før skjedde det på `mousedown`, og en `click` alene valgte
    // ingenting.
    this.choose(event.currentTarget as HTMLElement)
  }
}

export function defineFsSuggestion(tagName: string = FS_SUGGESTION_TAG): void {
  defineElement(tagName, FsSuggestion)
}
