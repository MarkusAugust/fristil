import {
  addClass,
  defineElement,
  HostElement,
  languageOf,
  setAttr,
  setText,
  uniqueId,
  warnAboutMarkup,
  whenUpgraded,
} from "../../host-element.js"
import {
  SESSION_LOGOUT,
  SESSION_TIMEOUT_CLASS,
  SESSION_TIMEOUT_COUNT_CLASS,
  SESSION_TIMEOUT_DIALOG_CLASS,
  SESSION_TIMEOUT_TEXT_CLASS,
} from "./session-timeout.js"

export const FS_SESSION_TIMEOUT_TAG = "fs-session-timeout" as const

const DEFAULT_WARN_AT = 25 * 60
const DEFAULT_EXPIRES_AT = 30 * 60

/** Sekundene som skal leses opp underveis. Hvert sekund ville vært uutholdelig. */
const ANNOUNCE_AT = new Set([120, 60, 30, 10])

/**
 * Det brukeren gjør, ikke det siden gjør.
 *
 * `scroll` sto her, men den kommer også når kode ruller, som en logg som
 * følger med eller `scrollIntoView`, og da holdt siden økten i live mens
 * brukeren var borte. `wheel` og `touchmove` er brukerens rulling, og
 * rulling med tastaturet er `keydown`. Fangstfasen, så en hendelse et
 * panel stopper, teller likevel.
 */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchmove",
] as const
const ACTIVITY_OPTIONS = { passive: true, capture: true } as const

/** Sekunder mellom hver `session-activity`. */
const DEFAULT_ACTIVITY_INTERVAL = 60

/**
 * Grunnene komponenten selv lukker dialogen med.
 *
 * De sammenlignes nøyaktig, og navnene er valgt så de ikke kolliderer med en
 * `value` den som rendrer har gitt en knapp.
 * `reset()` lukket før med «extend», og lukkingen ble da lest som at
 * brukeren trykket på knappen med den verdien.
 */
const CLOSED_BY_RESET = "fs-session-reset"
const CLOSED_BY_EXPIRY = "fs-session-expired"

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Varigheten slik den uttales, på sidens språk.
 *
 * `Intl` kjenner ordene og bøyningen, så «2 minutter og 30 sekunder» blir
 * «2 minutes and 30 seconds» på en engelsk side uten at noen oversetter det.
 * Rundet av sa opplesningen «2 minutter» mens tallet viste 1:30, så sekundene
 * er med.
 */
function spoken(seconds: number, lang: string | undefined): string {
  const unit = (value: number, name: "minute" | "second") =>
    new Intl.NumberFormat(lang, {
      style: "unit",
      unit: name,
      unitDisplay: "long",
    }).format(value)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (m > 0) parts.push(unit(m, "minute"))
  if (s > 0 || m === 0) parts.push(unit(s, "second"))
  return new Intl.ListFormat(lang, { type: "conjunction" }).format(parts)
}

/**
 * Teksten i en node, med tallet byttet ut med varigheten slik den uttales.
 *
 * Teksten leses, den skrives ikke: en kopi av avsnittet med ny tekst i
 * ville vært en skriving, og ingen skriving i `ramme/` går utenom hjelperne.
 */
function readAloud(
  node: Node,
  count: Element | null,
  duration: string,
): string {
  if (node === count) return duration
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? ""
  return [...node.childNodes]
    .map((child) => readAloud(child, count, duration))
    .join("")
}

function isSeconds(raw: string | null): boolean {
  if (raw === null) return true
  const value = Number(raw)
  return raw.trim() !== "" && Number.isFinite(value) && value >= 0
}

/**
 * Varsler før en innlogget økt går ut.
 *
 * Dette er tingen hver store organisasjon bygger selv og gjør feil. Enten
 * kommer det ingen advarsel, og brukeren mister et halvutfylt søknadsskjema,
 * eller så stjeler dialogen fokus midt i en setning, eller så leser
 * skjermleseren nedtellingen hvert sekund.
 *
 * Den som rendrer, skriver dialogen og teksten, så varselet står på det
 * språket appen bruker, med det oversettelsesverktøyet appen alt har.
 * Komponenten tar tiden: den teller aktivitet, åpner dialogen med
 * `showModal()`, fyller inn tallet og leser opp nedtellingen. Det er alt den
 * skriver, sammen med det en mal kan ha glemt: klassen
 * `fs-session-timeout__dialog` på dialogen, `role="alertdialog"`, og navnet
 * fra den første overskriften, med en id på overskriften når den mangler.
 *
 * Delene kjennes igjen på det som uansett må stå der: `<dialog>` inne i
 * verten, `.fs-session-timeout__count` for tallet, `[role=status]` for
 * opplesningen og knappene i et `<form method="dialog">`. En knapp med
 * `value="logout"` logger ut. Alle andre måter å lukke dialogen på, Escape
 * og knappen med `value="extend"` medregnet, betyr «jeg er her», og forlenger.
 *
 * ```html
 * <fs-session-timeout warn-at="1500" expires-at="1800" data-ignore-morph>
 *   <dialog class="fs-session-timeout__dialog" role="alertdialog" aria-labelledby="okt">
 *     <h2 class="fs-session-timeout__title" id="okt">Du blir snart logget ut</h2>
 *     <p class="fs-session-timeout__text">
 *       Vi logger deg ut om <span class="fs-session-timeout__count" aria-hidden="true"></span>.
 *     </p>
 *     <span class="fs-sr-only" role="status"></span>
 *     <form method="dialog" class="fs-session-timeout__actions">
 *       <button class="fs-button" value="extend">Fortsett å være innlogget</button>
 *       <button class="fs-button" data-variant="secondary" value="logout">Logg ut nå</button>
 *     </form>
 *   </dialog>
 * </fs-session-timeout>
 * ```
 *
 * ```ts
 * document.querySelector("fs-session-timeout")
 *   .addEventListener("session-extend", () => fetch("/forleng", { method: "POST" }))
 * ```
 */
export class FsSessionTimeout extends HostElement {
  static observedAttributes = [
    "warn-at",
    "expires-at",
    "activity-interval",
  ] as const

  private ticker?: number
  private lastActivity = Date.now()
  /**
   * Da komponenten sist sendte `session-activity`, og om brukeren har gjort
   * noe siden.
   *
   * Klokka nullstilles av aktivitet i nettleseren, men serverøkten vet ikke
   * om den. En bruker som skrev i et langt skjema uten et eneste kall til
   * serveren, fikk aldri varselet, og innsendingen feilet fordi serverøkten
   * var ute. Hendelsen lar appen holde serverøkten i live. Den sendes i
   * starten av et intervall, og på slutten hvis brukeren har gjort noe
   * siden, så serveren aldri er mer enn ett intervall bak klokka her.
   */
  private lastActivityEvent = 0
  private activitySinceEvent = false
  /** Sekundene som var igjen ved forrige tikk, så en terskel ikke hoppes over. */
  private previousLeft?: number
  private previousFocus: HTMLElement | null = null
  /**
   * Sant fra økten gikk ut, eller brukeren valgte å logge ut, til `extend()`
   * eller `reset()` er kalt.
   *
   * Uten dette startet syklusen på nytt av seg selv, og en app som ikke
   * navigerte bort fikk ny dialog og ny `session-expired` hvert
   * `expires-at`-sekund, for en økt som alt var borte.
   */
  private expired = false
  /** Id-en komponenten ga overskriften, så den samme kommer tilbake. */
  private titleId?: string
  /**
   * Dialogen komponenten åpnet, til `close` er kommet.
   *
   * `close` kommer i en senere oppgave enn klikket som lukket dialogen. Tikket
   * klokka imellom, åpnet `tick()` dialogen igjen og nullstilte
   * `returnValue`, og den køede hendelsen leste da `""` og forlenget økten:
   * brukeren trykket «Logg ut nå», og appen fikk `session-extend`.
   */
  private shownDialog?: HTMLDialogElement
  /** Ser etter `open` som forsvinner fra en dialog i topplaget. Se `repairOpen()`. */
  private openObserver?: MutationObserver

  /** Sekunder uten aktivitet før varselet kommer. */
  get warnAt(): number {
    return this.readSeconds("warn-at", DEFAULT_WARN_AT)
  }

  set warnAt(value: number) {
    setAttr(this, "warn-at", String(value))
  }

  /** Sekunder mellom hver `session-activity` mens brukeren er aktiv. */
  get activityInterval(): number {
    return this.readSeconds("activity-interval", DEFAULT_ACTIVITY_INTERVAL)
  }

  set activityInterval(value: number) {
    setAttr(this, "activity-interval", String(value))
  }

  /** Sekunder uten aktivitet før økten er ute. */
  get expiresAt(): number {
    return this.readSeconds("expires-at", DEFAULT_EXPIRES_AT)
  }

  set expiresAt(value: number) {
    setAttr(this, "expires-at", String(value))
  }

  connectedCallback(): void {
    addClass(this, SESSION_TIMEOUT_CLASS)

    for (const name of ACTIVITY_EVENTS) {
      document.addEventListener(name, this.registerActivity, ACTIVITY_OPTIONS)
    }
    /*
     * `close` bobler ikke, men den går gjennom verten i fangstfasen. Da
     * fanges lukkingen også når den som rendrer har byttet ut dialogen,
     * uten at komponenten må holde på en bestemt node.
     */
    this.addEventListener("close", this.handleClose, true)
    this.openObserver = new MutationObserver(() => this.repairOpen())
    this.openObserver.observe(this, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    })
    this.ticker = window.setInterval(() => this.tick(), 1000)
    this.validate()

    /*
     * Flyttes elementet mens varselet står, tar nettleseren dialogen ut av
     * topplaget og lar `open` stå. Den var da en boks uten bakteppe og
     * fokusfelle, og `tick()` åpnet den aldri på nytt, siden den alt var
     * «åpen». `removeAttribute` og ikke `close()`: en lukking leses som at
     * brukeren forlenget økten.
     */
    const dialog = this.dialog
    if (dialog?.open && !dialog.matches(":modal")) {
      dialog.removeAttribute("open")
      dialog.showModal()
    }
  }

  disconnectedCallback(): void {
    for (const name of ACTIVITY_EVENTS) {
      document.removeEventListener(
        name,
        this.registerActivity,
        ACTIVITY_OPTIONS,
      )
    }
    this.removeEventListener("close", this.handleClose, true)
    this.openObserver?.disconnect()
    this.openObserver = undefined
    if (this.ticker) window.clearInterval(this.ticker)
    this.ticker = undefined
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.validate()
  }

  /** Dialogen komponenten styrer: den første `<dialog>` inne i verten. */
  private get dialog(): HTMLDialogElement | null {
    return this.querySelector("dialog")
  }

  private readSeconds(name: string, fallback: number): number {
    const raw = this.getAttribute(name)
    return isSeconds(raw) && raw !== null ? Number(raw) : fallback
  }

  /**
   * Sier fra om markup og tall som ikke henger sammen, framfor å tie.
   *
   * `warn-at="1800" expires-at="1500"` ga `session-expired` uten at
   * dialogen noen gang ble vist, og et negativt tall ga dialog i første
   * tikk. Standardverdiene brukes når et tall ikke er et tall.
   */
  private validate(): void {
    warnAboutMarkup(
      this,
      "har warn-at eller expires-at som ikke er et tall større enn eller " +
        "lik null. Standardverdiene brukes i stedet.",
      () =>
        !isSeconds(this.getAttribute("warn-at")) ||
        !isSeconds(this.getAttribute("expires-at")),
    )
    warnAboutMarkup(
      this,
      "har warn-at som ikke er mindre enn expires-at, så varselet kommer " +
        "aldri før økten er ute.",
      () => this.warnAt >= this.expiresAt,
    )
    // Et tomt element er et område som ikke er fylt ennå, og skal tie her.
    // Det sies fra om i det varselet skulle vist seg. Se `openDialog()`.
    warnAboutMarkup(
      this,
      "fant ingen <dialog>. Varselet kan ikke vises, og økten går ut uten " +
        "advarsel.",
      () => this.childElementCount > 0 && this.dialog === null,
    )
    this.validateParts()
  }

  /** Delene inne i dialogen. Hver av dem gjør varselet dårligere å mangle. */
  private validateParts(): void {
    const dialog = this.dialog
    if (!dialog) return
    warnAboutMarkup(
      this,
      `fant ingen .${SESSION_TIMEOUT_COUNT_CLASS} i dialogen. Brukeren ser ` +
        "ikke hvor lenge det er igjen.",
      () => !this.dialog?.querySelector(`.${SESSION_TIMEOUT_COUNT_CLASS}`),
    )
    warnAboutMarkup(
      this,
      "fant ingen [role=status] i dialogen. Nedtellingen leses ikke opp for " +
        "den som bruker skjermleser.",
      () => !this.dialog?.querySelector("[role=status]"),
    )
    warnAboutMarkup(
      this,
      'fant ingen knapp i et <form method="dialog">. Brukeren kan bare ' +
        "forlenge økten med Escape, og kan ikke logge ut fra varselet.",
      () => !this.dialog?.querySelector('form[method="dialog" i] button'),
    )
  }

  /**
   * Fyller inn det tilgjengeligheten krever og en mal kan ha glemt: rollen,
   * og navnet fra den første overskriften. Bare det som mangler: et navn
   * fra `aria-label` eller `aria-labelledby` er skrevet av den som rendrer,
   * og blir stående.
   */
  private wire(dialog: HTMLDialogElement): void {
    addClass(dialog, SESSION_TIMEOUT_DIALOG_CLASS)
    if (!dialog.hasAttribute("role")) setAttr(dialog, "role", "alertdialog")
    if (
      dialog.hasAttribute("aria-labelledby") ||
      dialog.hasAttribute("aria-label")
    ) {
      return
    }
    const title = dialog.querySelector("h1, h2, h3, h4, h5, h6")
    if (!title) return
    if (!title.id) {
      this.titleId ??= uniqueId("fs-session-timeout-title")
      setAttr(title, "id", this.titleId)
    }
    setAttr(dialog, "aria-labelledby", title.id)
  }

  /**
   * Setter `open` tilbake på en dialog som fortsatt står i topplaget.
   *
   * `showModal()` setter attributtet selv, og den som rendrer sendte det
   * ikke. En morfing uten `data-ignore-morph` tar det derfor, og dialogen
   * ble stående i topplaget, usynlig, med resten av siden inert. Siden sto
   * fast. Tallet kommer tilbake ved neste tikk.
   *
   * `:modal` og ikke `open` er vilkåret: lukker brukeren dialogen, forlater
   * den topplaget, og da er det manglende attributtet ekte. Samme regel som
   * i `<fs-dialog>`.
   */
  private repairOpen(): void {
    const dialog = this.dialog
    if (!dialog?.matches(":modal") || dialog.open) return
    setAttr(dialog, "open", "")
  }

  private registerActivity = (): void => {
    if (this.dialog?.open || this.expired) return
    this.lastActivity = Date.now()
    this.activitySinceEvent = true
    this.reportActivity()
  }

  /** Sender `session-activity` når et intervall er gått og brukeren var aktiv. */
  private reportActivity(): void {
    if (!this.activitySinceEvent) return
    const now = Date.now()
    if (now - this.lastActivityEvent < this.activityInterval * 1000) return
    this.lastActivityEvent = now
    this.activitySinceEvent = false
    this.emit("session-activity")
  }

  /**
   * Brukeren lukket dialogen, eller komponenten gjorde det.
   *
   * Komponentens egne lukkinger har sine egne grunner, og gjør ingenting her. `value="logout"` logger ut. Alt annet, Escape og
   * knappen med `value="extend"` medregnet, er «jeg er her». Det gjelder
   * også en knapp med en annen verdi: ellers ble dialogen lukket, og neste
   * tikk åpnet den igjen ett sekund senere.
   */
  private handleClose = (event: Event): void => {
    const dialog = event.target
    if (!(dialog instanceof HTMLDialogElement) || dialog !== this.dialog) return
    this.shownDialog = undefined

    const live = dialog.querySelector("[role=status]")
    if (live) setText(live, "")
    this.previousFocus?.focus()
    this.previousFocus = null

    const reason = dialog.returnValue
    if (reason === CLOSED_BY_RESET || reason === CLOSED_BY_EXPIRY) return
    if (reason === SESSION_LOGOUT) {
      // Som ved utløp: komponenten står stille til `extend()` eller
      // `reset()`. Ellers så neste tikk en lukket dialog etter
      // varselgrensen og åpnet den igjen mens appen logget ut.
      this.expired = true
      this.emit("session-logout")
      return
    }
    this.extend()
  }

  private tick(): void {
    if (this.expired) return
    // Slutten av et intervall: brukeren var aktiv, men ingen hendelse er
    // sendt siden starten.
    this.reportActivity()

    // En lukking er på vei. Vent på `close`, så den blir lest riktig. Er
    // dialogen byttet ut imens, kommer den aldri, og da slippes minnet.
    const current = this.dialog
    if (this.shownDialog && this.shownDialog !== current) {
      this.shownDialog = undefined
    }
    if (this.shownDialog && !this.shownDialog.open) return

    const elapsed = Math.floor((Date.now() - this.lastActivity) / 1000)
    const left = this.expiresAt - elapsed
    const dialog = this.dialog

    if (left <= 0) {
      // Flagget først, så lukkingen ikke leses som en forlengelse.
      this.expired = true
      this.closeDialog(CLOSED_BY_EXPIRY)
      this.emit("session-expired")
      return
    }

    // Står dialogen alt åpen, går nedtellingen videre selv om `warn-at` er
    // hevet imens. Ellers frøs tallet, og økten gikk ut uten flere varsler.
    if (elapsed < this.warnAt && !dialog?.open) return

    if (!dialog?.open) {
      this.openDialog(left)
      return
    }
    /*
     * Når en terskel krysses, ikke bare når den treffes nøyaktig. Et tikk
     * kan komme sent, eller strupes i en fane i bakgrunnen, og hoppet klokka
     * fra 61 til 59, ble «1 minutt» aldri lest opp.
     */
    const previous = this.previousLeft ?? left + 1
    this.previousLeft = left
    const crossed = [...ANNOUNCE_AT].some(
      (limit) => previous > limit && left <= limit,
    )
    this.show(dialog, left, crossed)
  }

  /** Skriver tallet, og opplesningen når `announce` er sant. */
  private show(
    dialog: HTMLDialogElement,
    left: number,
    announce: boolean,
  ): void {
    const count = dialog.querySelector(`.${SESSION_TIMEOUT_COUNT_CLASS}`)
    if (count) setText(count, clock(left))
    if (!announce) return

    const live = dialog.querySelector("[role=status]")
    if (!live) return
    const duration = spoken(left, languageOf(this))
    /*
     * Opplesningen er avsnittet, med tallet uttalt. Da står den på det
     * språket den som rendrer skrev, uten en egen tekst for skjermleseren.
     * Uten et avsnitt med tallet i leses varigheten alene.
     */
    const text = dialog.querySelector(`.${SESSION_TIMEOUT_TEXT_CLASS}`)
    // Står tallet utenfor avsnittet, ville avsnittet blitt lest uten tall.
    if (!text || !count || !text.contains(count)) {
      setText(live, duration)
      return
    }
    const sentence = readAloud(text, count, duration)
    setText(live, sentence.replace(/\s+/g, " ").trim())
  }

  private openDialog(left: number): void {
    const dialog = this.dialog
    if (!dialog) {
      // Her har siden for lengst falt til ro, så et tomt element er ikke et
      // område som venter på innhold. Det er et varsel som aldri kommer.
      // Har elementet innhold uten dialog, har `validate()` alt sagt fra.
      warnAboutMarkup(
        this,
        "skulle vist varselet, men fant ingen <dialog>. Den som rendrer må " +
          "skrive dialogen og teksten selv. Brukeren får ingen advarsel før " +
          "økten går ut.",
        () => this.dialog === null && this.childElementCount === 0,
      )
      return
    }
    if (dialog.open) return

    this.wire(dialog)
    // Dialogen kan ha kommet etter tilkoblingen, med HTML som strømmer inn.
    // Da så `validate()` den aldri.
    this.validateParts()
    // Fokus skal tilbake dit brukeren var. Uten dette starter neste
    // tastetrykk på toppen av siden, midt i et skjema.
    this.previousFocus = document.activeElement as HTMLElement | null
    /*
     * Teksten skal stå før dialogen åpnes, siden `alertdialog` leses opp i
     * det den kommer. Tallet i avsnittet er `aria-hidden`, så uten
     * opplesningen her hørte skjermleseren avsnittet uten tall, og første
     * tall kom først ved neste terskel, minutter senere.
     */
    this.show(dialog, left, true)
    this.previousLeft = left
    dialog.returnValue = ""
    dialog.showModal()
    this.shownDialog = dialog
    this.emit("session-warn")
  }

  private closeDialog(reason: string): void {
    const dialog = this.dialog
    if (!dialog?.open) return
    dialog.close(reason)
  }

  private emit(name: string): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }))
  }

  /**
   * Forlenger økten, lukker varselet og sender `session-extend`.
   *
   * Lytter appen på `session-extend` for å be serveren forlenge, skal den
   * kalle `reset()` når svaret kommer, ikke denne. Ellers sender svaret en ny
   * `session-extend`, som sender et nytt kall.
   */
  extend(): void {
    this.reset()
    this.emit("session-extend")
  }

  /**
   * Nullstiller klokka uten å sende `session-extend`.
   *
   * For en app som alt har forlenget økten på egen hånd, som når en
   * autolagring gikk gjennom. `extend()` ville bedt serveren om det en gang
   * til.
   */
  reset(): void {
    this.lastActivity = Date.now()
    this.expired = false
    this.closeDialog(CLOSED_BY_RESET)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fs-session-timeout": FsSessionTimeout
  }
}

export function defineFsSessionTimeout(tagName = FS_SESSION_TIMEOUT_TAG): void {
  defineElement(tagName, FsSessionTimeout)
}

/** `element.extend()`, men venter først på registreringen. Se `whenUpgraded`. */
export async function extendSession(element: Element): Promise<void> {
  const session = await whenUpgraded<FsSessionTimeout>(element)
  session.extend()
}

/** `element.reset()`, men venter først på registreringen. Se `whenUpgraded`. */
export async function resetSession(element: Element): Promise<void> {
  const session = await whenUpgraded<FsSessionTimeout>(element)
  session.reset()
}
