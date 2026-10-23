import {
  defineElement,
  derivedParts,
  HostElement,
  isServerControlled,
  SERVER_CONTROLLED,
  setAttr,
  setFlag,
  uniqueId,
  warnAboutMarkup,
} from "../../host-element.js"
export const FS_TABS_TAG = "fs-tabs" as const

/**
 * Delene fanene finner, som selektorer relativt til elementet. Komponenten
 * finner delene med disse, og manifestet beskriver dem for den som setter
 * sammen markupen selv, så de to ikke kan si noe ulikt.
 */
export const FS_TABS_PARTS = {
  /** Raden: den serveren har gitt rollen, eller klassen fra `tabs.css`. */
  list: "[role='tablist'], .fs-tabs__list",
  /**
   * En fane er en lenke til et panel i raden. En lenke er det eneste
   * fanemønsteret som virker uten JavaScript: uten skriptet er raden en
   * innholdsfortegnelse, og lenkene fører til panelene. Har serveren skrevet
   * rollene, er bare lenkene med `role="tab"` faner.
   */
  tab: "a[role='tab'][href^='#'], .fs-tabs__list a[href^='#']:not([role])",
  /** Et panel: rollen når den står der, ellers klassen uten rolle. */
  panel: "[role='tabpanel'], .fs-tabs__panel:not([role])",
} as const

const LIST_SELECTOR = FS_TABS_PARTS.list
const TAB_SELECTOR = FS_TABS_PARTS.tab
/** Det serveren har kalt en fane, også det som ikke er en lenke. */
const ANY_TAB_SELECTOR = "[role='tab']"
/** Overskriften i et panel, som gir panelet navnet sitt. */
const HEADING_SELECTOR = ":scope > :is(h1, h2, h3, h4, h5, h6)"

/**
 * Id-en en fane peker på, eller `null` når den ikke er en lenke til et
 * fragment. `href="#"` alene peker på ingenting.
 *
 * `href` er sannheten, og `aria-controls` skrives fra den. Fragmentet slås
 * opp slik nettleseren gjør: som det står, og ellers dekodet, så både
 * `#vedlegg` og `#s%C3%B8knaden` finner panelet sitt.
 */
function linkTarget(tab: Element): string | null {
  if (tab.localName !== "a") return null
  const href = tab.getAttribute("href") ?? ""
  if (!href.startsWith("#") || href.length < 2) return null
  return href.slice(1)
}

function decoded(fragment: string): string | null {
  try {
    const plain = decodeURIComponent(fragment)
    return plain === fragment ? null : plain
  } catch {
    return null
  }
}

/** Tekst slik et navn regnes ut: mellomrom slått sammen, uten luft rundt. */
function flat(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** Er elementet skjult for hjelpemidler: `hidden`, `aria-hidden` eller CSS? */
function hiddenFromAT(element: Element): boolean {
  if (element.getAttribute("aria-hidden") === "true") return true
  if (element.hasAttribute("hidden")) return true
  if (!(element instanceof HTMLElement) || !element.isConnected) return false
  const style = getComputedStyle(element)
  return style.display === "none" || style.visibility === "hidden"
}

/**
 * Teksten et element gir et navn, slik AccName 1.2 regner den ut fra steg 2.
 *
 * `aria-labelledby` (2B), `aria-label` på noe inni, `alt` på et bilde, og
 * teksten, men ikke det som er skjult for hjelpemidler. `textContent` tok med
 * skjult tekst, som «Meldinger (3)», og ga et tomt navn til en fane med bare
 * et ikon og `aria-label`.
 *
 * - `includeHidden`: pekes det direkte på et skjult element med
 *   `aria-labelledby`, tas det likevel med, og alt inni det (2A).
 * - `inReference`: noden står i en `aria-labelledby` som alt følges, og da
 *   følges ikke en til (2B).
 *
 * Tekst fra CSS, `::before` og `::after` (2F.ii), tas ikke med. Fristils
 * faner bruker det ikke, og å lese `content` riktig er mye kode for noe ingen
 * trenger (avgjort av eieren 23. oktober).
 */
function textOf(
  node: Node,
  includeHidden = false,
  inReference = false,
): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
  if (!(node instanceof Element)) return ""
  if (!includeHidden && hiddenFromAT(node)) return ""
  if (!inReference) {
    const referenced = referencedText(node)
    if (referenced !== "") return ` ${referenced} `
  }
  const label = node.getAttribute("aria-label")
  if (label && flat(label) !== "") return ` ${label} `
  if (node.localName === "img") return ` ${node.getAttribute("alt") ?? ""} `
  let text = ""
  for (const child of node.childNodes)
    text += textOf(child, includeHidden, inReference)
  return text
}

/** Teksten fra elementene `aria-labelledby` peker på, eller tom (AccName 2B). */
function referencedText(element: Element): string {
  const ids = element.getAttribute("aria-labelledby")
  if (!ids) return ""
  const root = element.getRootNode() as Document | ShadowRoot
  return flat(
    ids
      .split(/\s+/)
      .map((id) => (id === "" ? null : root.getElementById?.(id)))
      .filter((e): e is HTMLElement => Boolean(e))
      .map((e) => textOf(e, hiddenFromAT(e), true))
      .join(" "),
  )
}

/** Navnet på et element, slik en skjermleser regner det ut. */
function accessibleName(element: Element): string {
  const referenced = referencedText(element)
  if (referenced !== "") return referenced
  const label = element.getAttribute("aria-label")
  if (label && flat(label) !== "") return flat(label)
  let text = ""
  for (const child of element.childNodes) text += textOf(child)
  if (flat(text) !== "") return flat(text)
  return flat(element.getAttribute("title") ?? "")
}

/**
 * Navnet et panel får når det peker på elementet med `aria-labelledby`.
 *
 * Ikke det samme som elementets eget navn: inni en `aria-labelledby` følges
 * ikke elementets egen `aria-labelledby` (AccName 2B), og et skjult element
 * tas med (2A). En overskrift med `aria-labelledby` mot «Vedlegg» og teksten
 * «Bilag» ga panelet navnet «Bilag», mens komponenten trodde det var
 * «Vedlegg».
 */
function nameAsReferenced(element: Element): string {
  return flat(textOf(element, hiddenFromAT(element), true))
}

/**
 * Det komponenten sist skrev på en node, og hva serveren sist sa.
 *
 * `aria-selected` på fanene og `hidden` på panelene både leses og skrives.
 * En naiv avlesning er komponentens eget ekko: bar markup fikk
 * `aria-selected="true"` på første fane av komponenten, og da serveren
 * byttet fane med en patch som bare rørte panelene, leste komponenten sin
 * egen markering tilbake og skjulte panelet serveren nettopp viste. Står
 * det noe annet enn det komponenten skrev, har serveren rørt det, og det er
 * serverens ord. Står det det samme, gjelder det serveren sa sist.
 */
type Word = { written: string | null; server: string | null }

/**
 * Tastaturet i en fanerad, og koblingen når markupen kommer uten.
 *
 * Fanene er lenker til panelene sine, slik GOV.UK gjør det:
 *
 * ```html
 * <fs-tabs>
 *   <ul class="fs-tabs__list" aria-label="Deler av saken">
 *     <li><a href="#soknaden">Søknaden</a></li>
 *     <li><a href="#vedlegg">Vedlegg</a></li>
 *   </ul>
 *   <section class="fs-tabs__panel" id="soknaden"><h2>Søknaden</h2>…</section>
 *   <section class="fs-tabs__panel" id="vedlegg"><h2>Vedlegg</h2>…</section>
 * </fs-tabs>
 * ```
 *
 * Uten JavaScript er det en innholdsfortegnelse med alle panelene etter
 * hverandre, og lenkene virker. Det malen skriver er id på panelene, og den
 * krever lenkene uansett.
 *
 * Komponenten skriver aldri id på en fane eller et panel. Datastar og
 * idiomorph kjenner igjen et element på id, og et element med en id
 * serveren ikke sendte, blir byttet ut ved neste oppdatering, med fanevalget
 * og fokus. Panelenes id kommer fra serveren, så de beholdes. Det komponenten
 * fyller inn, regner den ut fra markupen: rollene, `aria-controls` fra
 * `href`, `role="presentation"` på listepunktene, og panelets navn, som er
 * fanens. Overskriften i panelet er navnet når den sier det samme som fanen.
 * Bare det valgte panelet er en tabbestopp.
 *
 * Panelene som ikke er valgt, skjules med `hidden="until-found"`, så søk i
 * siden og en lenke til noe i et panel finner dem, og nettleseren sender
 * `beforematch`, som komponenten velger fanen fra. Har serveren skrevet
 * `hidden` selv, skrives det tilbake i serverens form, i hele raden:
 * `fs.tabs()` fra `@fristil/designsystem/react` gir `hidden=""`, fordi React
 * ikke kan skrive `until-found`. Adressen velger fanen når siden lastes og når
 * den endres, og hvert valg skrives i adressen, med mindre den alt peker på
 * det valgte panelet eller noe i det. Ved lasting gjelder serverens
 * `aria-selected` foran adressen, og under `server-controlled` velger
 * adressen aldri.
 *
 * Det serveren har skrevet står. Hvilken fane som er valgt leses fra
 * `aria-selected`, og mangler den, fra hvilket panel som ikke er skjult; er
 * ingenting sagt, er det den første. Før komponenten er registrert viser
 * `tabs.css` bare det første synlige panelet, så innholdet ikke hopper når
 * resten skjules.
 *
 * Det komponenten gjør etterpå er det nettleseren ikke gjør selv: Tab hopper
 * forbi hele raden og inn i panelet, mens piltastene flytter mellom fanene.
 * Med `activation="manual"` flytter piltastene bare fokus, og Enter eller
 * mellomrom velger.
 *
 * Fanevalget er brukerens, og komponenten setter det tilbake når en patch
 * river det bort. Skal serveren kunne flytte fanen, som i «gå videre til
 * steg 2», settes `server-controlled` på verten, og da bestemmer hver patch.
 */
export class FsTabs extends HostElement {
  /**
   * `server-controlled` og `activation`. Hvilken fane som er valgt står i
   * markupen serveren sendte, som `aria-selected` på fanen og `hidden` på
   * panelene, og leses derfra. Et eget `selected` ville vært en parallell
   * utgave av det samme.
   */
  static observedAttributes = [SERVER_CONTROLLED, "activation"] as const

  private observer?: MutationObserver
  /**
   * Fanen brukeren valgte, husket så en patch ikke kan ta den.
   *
   * Selve noden, ikke indeksen og ikke `href`. En indeks er ingen identitet:
   * setter serveren inn en fane først i lista, peker den samme indeksen på
   * noe annet, og valget hopper til en fane brukeren aldri trykket på.
   *
   * En morfing beholder lenkene, siden de ikke har id. Bytter patchen ut
   * selve lenken, som `innerHTML` gjør, er fanen en annen, og da glemmer
   * komponenten valget framfor å gjette; adressen har det da, se
   * `selectFromAddress`.
   *
   * `undefined` betyr at brukeren ikke har valgt noe ennå, og da er det
   * serverens markup som gjelder.
   */
  private chosenTab?: HTMLElement
  /**
   * Roller komponenten selv har satt. Skiller en bar rad, der hver lenke er
   * en fane, fra en rad serveren har skrevet rollene i, der en lenke uten
   * rolle er noe annet, som en hjelpelenke.
   */
  private readonly roledByMe = new WeakSet<Element>()
  private selectedMemory = new WeakMap<Element, Word>()
  private hiddenMemory = new WeakMap<Element, Word>()
  /**
   * Formen serveren skjuler panelene i, sist den skjulte noe: `""` fra
   * `fs.tabs()`, `"until-found"` eller noe annet. Komponenten skriver
   * `hidden` i den formen på alle panelene i raden, også på et panel
   * serveren aldri har skjult. Ellers fikk ett panel `until-found` og de
   * andre `""` i samme rad. Har serveren aldri skjult noe, er det
   * `until-found`, så søk i siden finner panelet.
   */
  private hiddenForm = "until-found"
  /**
   * Id-en komponenten ga overskriften i et panel, per panel. En morfing
   * river id-en av overskriften og `aria-labelledby` av panelet, siden
   * ingen av dem sto i serverens HTML, og panelet skal få den samme tilbake,
   * så en skjermleser ikke følger en peker som skifter under den.
   */
  private readonly headingIds = new WeakMap<Element, string>()
  /** Navnet komponenten skrev i `aria-label` på et panel uten overskrift. */
  private readonly labelByMe = new WeakMap<Element, string>()
  /**
   * Fanen brukeren klikket under `server-controlled`, til serveren svarer.
   *
   * Det er ikke brukerens valg i betydningen `chosenTab`: det settes aldri
   * tilbake mot serverens ord. Det står bare til noen andre har rørt
   * `aria-selected` eller `hidden`, lagt til en fane eller et panel, fjernet
   * fanen, eller tatt bort `server-controlled`. Uten det leste `repair()` serverens
   * gamle ord fra minnet i neste mikrotask og angret klikket, så fanene lot
   * seg ikke bytte, og en `data-attr:hidden` som skrev det samme som
   * komponenten nettopp hadde skrevet, ble aldri sett.
   */
  private pendingTab?: HTMLElement
  /**
   * Panelet nettleseren holder på å avdekke etter `beforematch`.
   *
   * Nettleseren fjerner `hidden` selv etter hendelsen, og går så videre til
   * forfedrene, som et ytre panel eller en lukket `<details>`. Men bare så
   * lenge panelet fortsatt har `hidden="until-found"` når hendelsen er ferdig.
   * Kommer søket fra brukeren, kjører nettleseren mikrooppgavene etter hver
   * lytter, også observatøren, og fjernet komponenten `hidden` i den runden,
   * stoppet Chromium og WebKit. Treffet i en fanerad inne i et skjult panel
   * ble stående usynlig. Panelet røres derfor ikke før i neste oppgave,
   * når nettleseren er ferdig, se `revealed()`.
   */
  private revealing?: Element
  /**
   * Om raden er lastet: om adressen eller serverens valg er lest. Det skjer
   * første gang raden har faner og adressen kan besvares, se `sync()`, ikke
   * når elementet kobles til. En `<fs-tabs>` som serveren fyller etterpå,
   * fikk ellers alltid første fane.
   */
  private started = false
  /**
   * Rota `beforematch` lyttes etter på. Hendelsen bobler, men er ikke
   * `composed`, så fra et panel i en shadow root når den aldri dokumentet.
   */
  private root?: Document | ShadowRoot

  connectedCallback(): void {
    /*
     * Attributtene er med, ikke bare barna. En morfing river bort det som
     * ikke står i serverens HTML, og fanevalget er nettopp det: noe brukeren
     * gjorde etter at siden kom. Hver skriving sammenligner først, ellers
     * ville observatøren utløst seg selv.
     */
    // Én lytter på verten, ikke én per fane. Fangstfasen, så en lytter på
    // raden som stopper hendelsen, ikke tar klikk og piltaster fra fanene.
    this.addEventListener("click", this.handleClick, true)
    this.addEventListener("keydown", this.handleKeydown, true)
    // Søk i siden, eller en lenke til noe i et panel skjult med
    // `until-found`. På dokumentet, ikke på verten: et panel kan stå utenfor
    // `<fs-tabs>`, og da når hendelsen aldri verten.
    document.addEventListener("beforematch", this.handleBeforematch, true)
    const root = this.getRootNode() as Document | ShadowRoot
    if (root !== document) {
      this.root = root
      root.addEventListener("beforematch", this.handleBeforematch, true)
    }
    window.addEventListener("hashchange", this.handleHashchange)
    this.observer = new MutationObserver((records) => {
      if (this.concerns(records)) this.sync()
    })
    this.observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      // Navnet på panelet er fanens. idiomorph endrer teksten i en
      // tekstnode, uten noe annet observatøren ser.
      characterData: true,
      // `disabled` er med fordi komponenten leser det: deaktiverer en patch
      // fanen som er valgt, flyttes tabbestoppet til en som kan få fokus.
      // `alt`, `aria-hidden` og `title` endrer navnet på en fane.
      attributeFilter: [
        "aria-selected",
        "tabindex",
        "hidden",
        "disabled",
        "aria-disabled",
        // Koblingen komponenten setter når markupen kom uten den, og setter
        // tilbake når en patch tar den.
        "role",
        "id",
        "href",
        "aria-controls",
        "aria-labelledby",
        "aria-label",
        "alt",
        "aria-hidden",
        "title",
      ],
    })
    this.sync()
  }

  attributeChangedCallback(name: string): void {
    // `server-controlled` slått på midt i: da skal komponenten slippe taket,
    // og neste patch bestemmer.
    if (name === SERVER_CONTROLLED && isServerControlled(this)) {
      this.chosenTab = undefined
      this.pendingTab = undefined
      // Det som står der nå er utgangspunktet. Uten dette hoppet raden
      // tilbake til fanen serveren sa sist, før brukeren valgte en annen.
      this.selectedMemory = new WeakMap()
      this.hiddenMemory = new WeakMap()
    }
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = undefined
    this.removeEventListener("click", this.handleClick, true)
    this.removeEventListener("keydown", this.handleKeydown, true)
    document.removeEventListener("beforematch", this.handleBeforematch, true)
    this.root?.removeEventListener("beforematch", this.handleBeforematch, true)
    this.root = undefined
    window.removeEventListener("hashchange", this.handleHashchange)
    // Kobles elementet til igjen, leses adressen på nytt.
    this.started = false
  }

  /**
   * Fanene som hører til denne raden, og bare dem.
   *
   * Faner i faner er vanlig markup. Uten avgrensningen ble en indre rad en
   * del av den ytre: et klikk på en indre fane skjulte det ytre panelet den
   * sto i, og begge komponentene festet lyttere på de samme fanene.
   */
  private get tabs(): HTMLElement[] {
    return derivedParts<HTMLElement>(
      this,
      TAB_SELECTOR,
      "tab",
      this.roledByMe,
    ).filter((tab) => linkTarget(tab) !== null)
  }

  /** Serverens ord om et attributt, mot hva komponenten selv skrev sist. */
  private serverWord(
    memory: WeakMap<Element, Word>,
    element: Element,
    now: string | null,
  ): string | null {
    const known = memory.get(element)
    if (!known) return now
    return now !== known.written ? now : known.server
  }

  /** Står det noe annet på en fane eller et panel enn komponenten skrev? */
  private touchedByOthers(): boolean {
    return this.tabs.some((tab) => {
      const selected = this.selectedMemory.get(tab)
      if (!selected || tab.getAttribute("aria-selected") !== selected.written) {
        return true
      }
      const panel = this.panelFor(tab)
      if (!panel) return false
      const hidden = this.hiddenMemory.get(panel)
      return !hidden || panel.getAttribute("hidden") !== hidden.written
    })
  }

  /**
   * Slipper klikket, og gjør det som står i markupen nå til serverens ord.
   *
   * Minnet har serverens ord fra før klikket, og de er foreldet: serveren
   * har svart. Et attributt serveren skrev likt med komponenten, kan ikke
   * skilles fra et den ikke rørte, så de gamle ordene vant, og raden hoppet
   * tilbake til fanen fra før klikket idet serveren bekreftet den nye.
   *
   * `hidden` på panelene leses derfor som det står. `aria-selected` leses
   * som det står når serveren har rørt minst én fane, altså når serveren
   * snakker i `aria-selected`. Har den ikke det, er verdiene komponentens
   * egne fra klikket, og da sier panelene hvilken fane som gjelder.
   */
  private releasePending(): void {
    this.pendingTab = undefined
    const tabs = this.tabs
    const serverSpoke = tabs.some((tab) => {
      const now = tab.getAttribute("aria-selected")
      const known = this.selectedMemory.get(tab)
      // En ny, bar fane har ikke sagt noe. Telte den, ble klikkets
      // `aria-selected` lest som serverens, og en senere flytting med bare
      // `hidden` ble satt tilbake.
      return known ? now !== known.written : now !== null
    })
    this.hiddenMemory = new WeakMap()
    if (serverSpoke) {
      this.selectedMemory = new WeakMap()
      return
    }
    for (const tab of tabs) {
      this.selectedMemory.set(tab, {
        written: tab.getAttribute("aria-selected"),
        server: null,
      })
    }
  }

  private serverSelected(tab: Element): string | null {
    return this.serverWord(
      this.selectedMemory,
      tab,
      tab.getAttribute("aria-selected"),
    )
  }

  /** Serverens ord om `hidden` på panelet: formen, eller `null` for synlig. */
  private serverHidden(panel: Element): string | null {
    return this.serverWord(
      this.hiddenMemory,
      panel,
      panel.getAttribute("hidden"),
    )
  }

  /**
   * Kan noen av endringene angå raden?
   *
   * Observatøren ser hele treet, og et forslagsfelt, en teller eller en
   * indre fanerad i et panel endrer `aria-selected`, `hidden` og tekst for
   * hvert tastetrykk. Hver av dem ga en hel runde, med stilen lest for
   * navnene. Bare det som står dypt i et av radens paneler, hoppes over, og
   * bare når det verken er en overskrift i panelet, noe `aria-labelledby`
   * peker på, eller en id, som kan gjøre et element til noe en fane peker
   * på. Alt annet gir en runde, som før.
   */
  private concerns(records: MutationRecord[]): boolean {
    let panels: HTMLElement[] | undefined
    let names: Set<string> | undefined
    for (const record of records) {
      if (record.type === "attributes" && record.attributeName === "id")
        return true
      const target =
        record.target instanceof Element
          ? record.target
          : record.target.parentElement
      if (!target) return true
      panels ??= this.tabs.flatMap((tab) => this.panelFor(tab) ?? [])
      const panel = panels.find((p) => p !== target && p.contains(target))
      if (!panel) return true
      const heading = target.closest("h1, h2, h3, h4, h5, h6")
      if (heading && heading.parentElement === panel) return true
      names ??= this.watchedIds(panels)
      if (this.within(target, names)) return true
      if (record.type === "childList") {
        for (const node of [...record.addedNodes, ...record.removedNodes])
          if (this.carries(node, names)) return true
      }
    }
    return false
  }

  /**
   * Id-ene `aria-labelledby` peker på fra fanene, det som er inni dem, og
   * panelene. Før raden er lastet, også id-en adressen peker på: raden venter
   * på det elementet, se `sync()`, og det kan komme dypt i et panel.
   */
  private watchedIds(panels: HTMLElement[]): Set<string> {
    const ids = new Set<string>()
    if (!this.started) {
      const hash = location.hash.slice(1)
      if (hash !== "") ids.add(hash)
      const plain = decoded(hash)
      if (plain !== null) ids.add(plain)
    }
    const from = (element: Element) => {
      for (const id of (element.getAttribute("aria-labelledby") ?? "").split(
        /\s+/,
      ))
        if (id !== "") ids.add(id)
    }
    for (const tab of this.tabs) {
      from(tab)
      for (const inner of tab.querySelectorAll("[aria-labelledby]")) from(inner)
    }
    for (const panel of panels) from(panel)
    return ids
  }

  /** Står elementet i et element med en av id-ene, eller er det selv ett? */
  private within(element: Element, ids: Set<string>): boolean {
    if (ids.size === 0) return false
    for (let e: Element | null = element; e; e = e.parentElement)
      if (e.id && ids.has(e.id)) return true
    return false
  }

  /** Har en lagt til eller fjernet node en av id-ene, selv eller inni seg? */
  private carries(node: Node, ids: Set<string>): boolean {
    if (!(node instanceof Element) || ids.size === 0) return false
    if (node.id && ids.has(node.id)) return true
    for (const inner of node.querySelectorAll("[id]"))
      if (ids.has(inner.id)) return true
    return false
  }

  /** Raden fanene står i, når den er denne komponentens. */
  private get list(): HTMLElement | null {
    // Den første raden som er denne komponentens, ikke den første i treet:
    // står panelene med en indre fanerad før den ytre raden, var den indre
    // først.
    for (const list of this.querySelectorAll<HTMLElement>(LIST_SELECTOR))
      if (list.closest(this.localName) === this) return list
    return null
  }

  /**
   * Panelet en fane styrer, gjennom id-en den peker på.
   *
   * Panelet kan stå utenfor verten. Det ligger likevel ikke i det
   * komponenten observerer, så river en patch `hidden` av det, kommer det
   * ikke tilbake av seg selv. Peker fanen på ingenting, er svaret
   * ingenting, og komponenten sier fra. Rekkefølgen er ingen reserve: to
   * faner kunne da fått det samme panelet, og de to skrev motsatt `hidden`
   * på det i hver eneste runde.
   */
  private panelFor(tab: HTMLElement): HTMLElement | null {
    const target = linkTarget(tab)
    return target === null ? null : this.byFragment(target)
  }

  /** Elementet et fragment peker på, som det står eller dekodet. */
  private byFragment(fragment: string): HTMLElement | null {
    const root = this.getRootNode() as Document | ShadowRoot
    const found = root.getElementById?.(fragment)
    if (found) return found
    // Et fragment kan være kodet, som `#s%C3%B8knaden`.
    const plain = decoded(fragment)
    return plain === null ? null : (root.getElementById?.(plain) ?? null)
  }

  /**
   * En fane som ikke kan velges, verken med mus eller tastatur: deaktivert,
   * eller skjult med `hidden`. En skjult fane kan ikke få fokus, så valgte
   * piltasten den, ble tabbestoppet stående på noe Tab aldri når.
   */
  private isDisabled(tab: HTMLElement): boolean {
    return (
      tab.hasAttribute("disabled") ||
      tab.getAttribute("aria-disabled") === "true" ||
      tab.hasAttribute("hidden")
    )
  }

  /** Piltastene flytter bare fokus, og Enter eller mellomrom velger. */
  private get manual(): boolean {
    return this.getAttribute("activation") === "manual"
  }

  /**
   * Indeksen på fanen som er markert, eller `-1` når ingen er det.
   *
   * `selected` svarer 0 i det tilfellet, fordi den er offentlig API og en
   * fanerad i praksis alltid har en valgt fane. Men den løgnen kan ikke
   * brukes internt: sa den 0 når ingenting var markert, returnerte
   * `select(0)` med en gang, og raden svarte ikke på et klikk i det hele
   * tatt.
   */
  private get markedIndex(): number {
    return this.tabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    )
  }

  /** Indeksen på fanen som er valgt. */
  get selected(): number {
    const index = this.markedIndex
    return index < 0 ? 0 : index
  }

  set selected(index: number) {
    // React 19 skriver egenskapen når den finnes, og dokumentasjonen viser
    // `faner.selected` som API. En getter alene kastet ved tilordning.
    this.select(index)
  }

  private sync(): void {
    /*
     * Første gang raden har faner, er den lastet. Har serveren sagt hvilken
     * fane som er valgt, gjelder det: serveren ser ikke adressen, og
     * React-inngangens `fs.tabs()` skriver `aria-selected`. Valgte
     * komponenten fra adressen før React hydrerte, meldte React et avvik for
     * hvert attributt den endret. Ellers velger adressen. Serverens ord leses
     * før komponenten skriver noe.
     */
    // Lastet når raden har faner og adressen kan besvares: den er tom, eller
    // elementet den peker på finnes. Kom raden før panelene, eller innholdet
    // etter panelet, fant adressen ellers ingenting, og den første fanen ble
    // valgt over den brukeren ba om. Å vente på at alle fanene har panel
    // holdt ikke: med én lenke som peker på ingenting, ble raden aldri
    // lastet. Peker adressen på noe som aldri kommer, som `#/sak/1`, er det
    // heller ingenting å velge. Serverens ord leses gjennom minnet, så en ny
    // tilkobling ikke tar komponentens egen skriving for serverens.
    const tabs = this.tabs
    const hash = location.hash.slice(1)
    const loading =
      !this.started &&
      tabs.length > 0 &&
      (hash === "" || this.byFragment(hash) !== null)
    const serverChose =
      loading && tabs.some((tab) => this.serverSelected(tab) === "true")
    this.wire()
    this.bind()
    this.repair()
    if (!loading) return
    this.started = true
    if (serverChose) this.alignAddress(this.markedIndex)
    else this.selectFromAddress()
  }

  /**
   * Fyller inn koblingen der markupen kom uten den.
   *
   * Bare det som mangler, med ett unntak: `aria-controls` skrives fra
   * `href`, siden de to er den samme opplysningen og `href` er den som virker
   * uten JavaScript. Et attributt serveren ellers har skrevet er serverens
   * ord, også når det sier noe annet enn komponenten ville sagt.
   */
  private wire(): void {
    const list = this.list
    if (list && !list.hasAttribute("role")) setAttr(list, "role", "tablist")
    // I en liste er hvert listepunkt bare innpakning rundt fanen. Uten
    // rollen leser skjermleseren «liste, 2 punkter» før hver fane.
    if (list && (list.localName === "ul" || list.localName === "ol")) {
      for (const item of list.children) {
        if (item.localName === "li" && !item.hasAttribute("role")) {
          setAttr(item, "role", "presentation")
        }
      }
    }

    /*
     * Hvert panel får navnet sitt én gang, fra den første fanen som peker på
     * det. Peker to faner på det samme, ved en feil i markupen, ga hver av
     * dem panelet sitt navn i hver runde, og observatøren kalte seg selv i
     * det uendelige.
     */
    const named = new Set<HTMLElement>()
    for (const tab of this.tabs) {
      if (!tab.hasAttribute("role")) {
        setAttr(tab, "role", "tab")
        this.roledByMe.add(tab)
      }
      const panel = this.panelFor(tab)
      setAttr(tab, "aria-controls", panel?.id ?? linkTarget(tab))
      if (!panel) continue

      if (!panel.hasAttribute("role")) {
        setAttr(panel, "role", "tabpanel")
        this.roledByMe.add(panel)
      }
      if (named.has(panel)) continue
      named.add(panel)
      this.name(panel, tab)
    }
  }

  /**
   * Gir panelet et navn, når serveren ikke har gitt det ett.
   *
   * Panelet heter det fanen heter, slik APG gir det. APG lar panelet peke på
   * fanen, men fanen har ingen id her, og komponenten skriver ingen. Sier
   * overskriften i panelet det samme som fanen, er overskriften navnet, og den
   * kan få id av komponenten: den har ingen tilstand brukeren kan miste.
   * Ellers er navnet fanens, som `aria-label`.
   *
   * En `aria-label` eller `aria-labelledby` serveren skrev, endres aldri, også
   * når pekeren viser til noe som ikke finnes ennå. Til det kommer, står
   * fanens navn som `aria-label`: en peker uten treff regnes ikke med når
   * navnet regnes ut, og da gjelder `aria-label`.
   */
  private name(panel: HTMLElement, tab: HTMLElement): void {
    const ownLabel = this.labelByMe.get(panel)
    const label = panel.getAttribute("aria-label")
    if (label !== null && label !== ownLabel) return

    const tabName = accessibleName(tab)
    const named = panel.getAttribute("aria-labelledby")
    const remembered = this.headingIds.get(panel)
    if (named !== null && named !== remembered) {
      if (this.resolves(named)) this.dropOwnLabel(panel)
      else this.setOwnLabel(panel, tabName)
      return
    }

    // Uten et navn på fanen er det ingenting å gi panelet. Et tomt
    // `aria-label` ville tatt navnet fra overskriften i tillegg.
    if (tabName === "") {
      this.dropOwnLabel(panel)
      return
    }
    const heading = panel.querySelector<HTMLElement>(HEADING_SELECTOR)
    if (heading && nameAsReferenced(heading) === tabName) {
      this.dropOwnLabel(panel)
      // Er pekeren komponentens, og overskriften mistet id-en sin i en
      // morfing, får den den samme tilbake.
      let id = heading.id
      if (!id) {
        id = remembered ?? uniqueId("fs-tabs-heading")
        setAttr(heading, "id", id)
      }
      this.headingIds.set(panel, id)
      setAttr(panel, "aria-labelledby", id)
      return
    }

    if (named !== null) {
      setAttr(panel, "aria-labelledby", null)
      this.headingIds.delete(panel)
    }
    this.setOwnLabel(panel, tabName)
  }

  /** Skriver fanens navn som `aria-label`, og husker at det er komponentens. */
  private setOwnLabel(panel: HTMLElement, text: string): void {
    setAttr(panel, "aria-label", text)
    this.labelByMe.set(panel, text)
  }

  /** Tar bort reserven, når et navn som finnes har tatt over. */
  private dropOwnLabel(panel: HTMLElement): void {
    if (!this.labelByMe.has(panel)) return
    setAttr(panel, "aria-label", null)
    this.labelByMe.delete(panel)
  }

  /** Peker minst én av id-ene på et element som finnes? */
  private resolves(ids: string): boolean {
    const root = this.getRootNode() as Document | ShadowRoot
    return ids
      .split(/\s+/)
      .some((id) => id !== "" && (root.getElementById?.(id) ?? null) !== null)
  }

  /**
   * Fanen serveren sier er valgt, når brukeren ikke har valgt noe.
   *
   * Serverens ord, ikke det som står der: det komponenten selv skrev
   * teller ikke, se `Word`. `aria-selected` først. Mangler den, som i markup
   * skrevet uten JavaScript, sier `hidden` på panelene det samme: det
   * første panelet serveren viser hører til den valgte fanen. Sier markupen
   * ingenting, eller skjuler den alle panelene, er det den første, som er
   * det en fanerad uansett starter på.
   */
  private get derivedIndex(): number {
    const tabs = this.tabs
    const marked = tabs.findIndex((tab) => this.serverSelected(tab) === "true")
    if (marked >= 0) return marked

    const shown = tabs.findIndex((tab) => {
      const panel = this.panelFor(tab)
      return panel !== null && this.serverHidden(panel) === null
    })
    return shown < 0 ? 0 : shown
  }

  /**
   * Setter brukerens valg tilbake etter en patch.
   *
   * Uten dette måtte malen skrive `data-preserve-attr="aria-selected tabindex"`
   * på hver fane og `hidden` på hvert panel, altså liste opp attributtene
   * komponenten kom til å røre. Ingen kompilator så på den lista.
   *
   * `apply()` kalles uansett om fanene ser riktige ut, for en patch kan ha
   * rørt bare panelene. Det er den smale patchen dokumentasjonen selv
   * anbefaler, og en sjekk på `aria-selected` alene så den ikke: fanen sa én
   * ting og skjermen en annen.
   */
  private repair(): void {
    if (this.pendingTab) {
      const index = this.tabs.indexOf(this.pendingTab)
      if (isServerControlled(this) && index >= 0 && !this.touchedByOthers()) {
        this.apply(index)
        return
      }
      this.releasePending()
    }

    if (!this.chosenTab || isServerControlled(this)) {
      /*
       * Ingen brukervalg å sette tilbake, så serverens ord bestemmer, og det
       * skrives helt ut: `aria-selected`, tabbestoppet og `hidden` i takt.
       * Bar struktur uten `aria-selected` får dermed den første fanen valgt
       * og resten av panelene skjult, og en patch som bare rørte panelene
       * flytter også markeringen. Det gjelder også under
       * `server-controlled`: komponenten setter ikke brukerens valg tilbake
       * der, men skriver fortsatt ut det serverens markup sier. Stemmer alt
       * fra før, skriver `apply()` ingenting.
       */
      if (this.tabs.length > 0) {
        const index = this.derivedIndex
        this.apply(index)
        if (this.started) this.alignAddress(index)
      }
      return
    }

    const index = this.tabs.indexOf(this.chosenTab)
    if (index < 0) {
      /*
       * Fanen finnes ikke lenger. Serveren har sendt noe annet, og da er det
       * serverens markup som gjelder.
       *
       * Med ett unntak: markupen må henge sammen etterpå. Fjernet patchen
       * fanen som var markert, står raden igjen uten en eneste
       * `aria-selected="true"`, alle panelene er skjult, og et klikk gjør
       * ingenting. Da velger komponenten det serverens markup sier, på
       * samme måte som når brukeren ikke hadde valgt noe: `aria-selected`,
       * så det første panelet serveren viser, så den første fanen.
       *
       * Valget meldes, for dette er komponentens eget og ikke brukerens.
       * Uten hendelsen ville en app som laster innholdet i panelet eller
       * skriver valget i adressen aldri fått vite at det flyttet seg.
       */
      const lostPanel = this.panelFor(this.chosenTab)
      this.chosenTab = undefined
      // Serveren markerte en fane selv. Da gjelder den, og panelene og
      // tabbestoppet skrives i samsvar med den, også når ingenting annet ga
      // observatøren en runde til.
      if (this.markedIndex >= 0) {
        const marked = this.derivedIndex
        this.apply(marked)
        this.alignAddress(marked)
        return
      }
      if (this.tabs.length > 0) {
        // Adressen sier hvilken fane brukeren var på, og er det eneste som
        // overlever at lenkene byttes ut. Er det det samme panelet som før,
        // har valget ikke endret seg, bare lenkene, og da meldes ingenting.
        const fromAddress = this.addressIndex
        const index = fromAddress >= 0 ? fromAddress : this.derivedIndex
        const tab = this.tabs[index]
        this.apply(index)
        if (this.panelFor(tab) === lostPanel) {
          this.chosenTab = tab
          return
        }
        if (fromAddress >= 0) this.chosenTab = tab
        this.showInAddress(index)
        this.notify(index)
      }
      return
    }

    this.apply(index)
  }

  private bind(): void {
    const tabs = this.tabs

    if (tabs.length === 0) {
      warnAboutMarkup(
        this,
        "fant ingen faner. Raden trenger en .fs-tabs__list med lenker til " +
          'panelene, som <a href="#vedlegg">. Uten dem sier skjermleseren ' +
          "«lenke» der den skulle sagt «fane, 2 av 3, valgt», og piltastene " +
          "gjør ingenting.",
        // En tom `<fs-tabs>` er et område serveren ikke har fylt ennå, og
        // det er ikke en feil i markupen.
        () => this.childElementCount > 0 && this.tabs.length === 0,
      )
      return
    }

    // Uten tallene i meldingen. Interpolerer den et tall, er hver runde en
    // ny melding, og advarselen kommer på nytt for hvert panel som dukker
    // opp framfor én gang.
    warnAboutMarkup(
      this,
      "har faner uten et panel: lenken peker på en id som ikke finnes. " +
        "Skriv id på hvert .fs-tabs__panel, den samme som lenken peker på. " +
        "Fanene uten et panel kan velges uten at noe vises.",
      () => this.tabs.some((tab) => this.panelFor(tab) === null),
    )

    warnAboutMarkup(
      this,
      'har en fane uten href: role="tab" står på noe som ikke er en lenke ' +
        'til et panel. Fanene er lenker, som <a href="#vedlegg">, så de ' +
        "virker uten JavaScript. Komponenten rører ikke det som ikke er en lenke.",
      () => this.nonLinkTabs().length > 0,
    )

    warnAboutMarkup(
      this,
      "har en fanerad uten navn. Skriv aria-label på .fs-tabs__list, som " +
        'aria-label="Deler av saken", eller aria-labelledby mot en overskrift. ' +
        "Uten navn sier skjermleseren bare «faneliste».",
      () => {
        const list = this.list
        if (!list || this.tabs.length === 0) return false
        const label = list.getAttribute("aria-label")
        const labelledby = list.getAttribute("aria-labelledby")
        return (
          (label === null || flat(label) === "") &&
          (labelledby === null || !this.resolves(labelledby))
        )
      },
    )
  }

  /** Det serveren har kalt en fane i raden, men som ikke er en lenke til et panel. */
  private nonLinkTabs(): Element[] {
    const list = this.list
    if (!list) return []
    const tabs = new Set<Element>(this.tabs)
    return [...list.querySelectorAll(ANY_TAB_SELECTOR)].filter(
      (e) => e.closest(this.localName) === this && !tabs.has(e),
    )
  }

  /**
   * Fanen i denne raden hendelsen kom fra, eller -1.
   *
   * `indexOf` og ikke bare `closest`: en fanerad inne i et panel bobler
   * klikkene sine hit også, og de er ikke denne radens.
   */
  private tabIndexOf(event: Event): number {
    const target = event.target
    if (!(target instanceof Element)) return -1
    const tab = target.closest("[role='tab']")
    return tab ? this.tabs.indexOf(tab as HTMLElement) : -1
  }

  private handleClick = (event: MouseEvent): void => {
    const index = this.tabIndexOf(event)
    if (index < 0) return
    const tab = this.tabs[index]
    // Med en modifikator åpner nettleseren lenken et annet sted, og det er
    // brukerens valg, ikke et fanevalg.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return
    }
    // Uten dette hoppet siden til panelet.
    event.preventDefault()
    if (this.isDisabled(tab)) return
    this.select(index)
  }

  /** Søk i siden eller en lenke avdekket et skjult panel. */
  private handleBeforematch = (event: Event): void => {
    // Også under `server-controlled`, som et klikk: valget står til serveren
    // svarer, og `tab-select` sier fra til appen. Ellers skjulte komponenten
    // treffet igjen i neste runde.
    const panel = event.target
    const index = this.tabs.findIndex((tab) => this.panelFor(tab) === panel)
    if (index < 0 || !(panel instanceof Element)) return
    // `hidden` på panelet fjerner nettleseren selv, se `revealing`.
    this.revealing = panel
    try {
      this.select(index)
    } finally {
      // En hendelse fra et skript avdekker ingen nettleser etterpå.
      if (event.isTrusted) setTimeout(() => this.revealed(panel), 0)
      else this.revealing = undefined
    }
  }

  /**
   * Slipper panelet etter `beforematch`, i oppgaven etter at nettleseren er
   * ferdig med å avdekke, og skriver raden.
   *
   * Som regel har nettleseren fjernet `hidden` da. Det gjør den ikke når
   * panelet ble tatt ut av dokumentet under hendelsen, og uten denne runden
   * ble panelet stående skjult selv om fanen var valgt.
   */
  private revealed(panel: Element): void {
    if (this.revealing !== panel) return
    this.revealing = undefined
    if (this.isConnected) this.sync()
  }

  private handleHashchange = (): void => {
    this.selectFromAddress()
  }

  /**
   * Indeksen på fanen adressen peker på, eller -1: panelet selv, som
   * `#vedlegg`, eller noe inni det, som en overskrift i panelet.
   */
  private get addressIndex(): number {
    const hash = location.hash.slice(1)
    if (!hash) return -1
    const target = this.byFragment(hash)
    if (!target) return -1
    return this.tabs.findIndex((tab) => {
      const panel = this.panelFor(tab)
      return panel !== null && (panel === target || panel.contains(target))
    })
  }

  /**
   * Retter adressen når den peker på en annen fane i raden enn den som er
   * valgt, som når serveren har flyttet valget. En adresse til noe utenfor
   * raden står.
   */
  private alignAddress(index: number): void {
    const pointsAt = this.addressIndex
    if (pointsAt >= 0 && pointsAt !== index) this.showInAddress(index)
  }

  /**
   * Skriver fanen i adressen, så den kan deles, og så valget overlever at
   * serveren bytter ut lenkene.
   *
   * Peker adressen alt på det valgte panelet eller noe i det, står den: en
   * lenke inn til innholdet skal ikke gå tapt. `replaceState`, så valget ikke
   * blir en oppføring i historikken.
   */
  private showInAddress(index: number): void {
    const tab = this.tabs[index]
    const panel = tab ? this.panelFor(tab) : null
    if (!tab || !panel) return
    if (this.addressIndex === index) return
    // Løst mot adressen siden har, ikke mot `<base>`: med `<base href="/">`,
    // som Angular har, ble stien byttet i stillhet, og med en `<base>` til et
    // annet opphav kastet `replaceState`.
    const url = new URL(tab.getAttribute("href") ?? "", location.href).href
    try {
      history.replaceState(history.state, "", url)
    } catch {
      // Safari kaster etter hundre kall på ti sekunder. Adressen er et
      // tillegg, så valget gjelder uansett.
    }
  }

  /**
   * Velger fanen adressen peker på.
   *
   * Ved lasting, ved `hashchange`, og når serveren bytter ut lenkene uten å
   * si hvilken som er valgt: da står valget fortsatt i adressen. Ikke under
   * `server-controlled`, der serveren bestemmer.
   */
  private selectFromAddress(): void {
    if (isServerControlled(this)) return
    const index = this.addressIndex
    if (index >= 0) this.select(index)
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    // Hvert tastetrykk i et felt i et panel kommer hit. Det billige først.
    if (!(event.target instanceof Element)) return
    if (!event.target.closest("[role='tab']")) return
    const tabs = this.tabs
    const current = this.tabIndexOf(event)
    if (current < 0) return
    // Alt+venstrepil er «tilbake» i nettleseren, og Cmd+pil flytter i
    // historikken på macOS. Med en modifikator er tasten ikke fanenes.
    if (event.altKey || event.ctrlKey || event.metaKey) return

    // Mellomrom velger ved manuell aktivering. En lenke gjør ingenting på
    // mellomrom selv, og Enter sender et klikk, som `handleClick` tar.
    if (this.manual && event.key === " ") {
      event.preventDefault()
      this.select(current)
      return
    }

    // I en side som leses fra høyre står neste fane til venstre. Uten dette
    // flyttet høyrepil fokus visuelt bakover.
    const rtl = getComputedStyle(this).direction === "rtl"
    // Pil opp og ned stjal siderullingen i en vannrett rad og avvek fra
    // WAI-ARIA. De gjelder bare når raden sier den står loddrett.
    const vertical =
      tabs[current]
        .closest("[role='tablist']")
        ?.getAttribute("aria-orientation") === "vertical"
    const steps: Record<string, number> = vertical
      ? { ArrowDown: 1, ArrowUp: -1 }
      : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }

    let next: number | undefined

    if (event.key in steps) {
      next = this.nextEnabled(current, steps[event.key])
    } else if (event.key === "Home") {
      next = this.nextEnabled(-1, 1)
    } else if (event.key === "End") {
      next = this.nextEnabled(tabs.length, -1)
    }

    if (next === undefined) return

    event.preventDefault()
    if (!this.manual) this.select(next)
    tabs[next].focus()
  }

  /**
   * Neste fane som kan velges, i en retning, rundt om nødvendig.
   *
   * En fane som ikke kan velges, hoppes over. Ble en skjult fane valgt, fikk
   * den tabbestoppet, og Tab nådde aldri raden. Tastaturbrukeren var låst ute.
   */
  private nextEnabled(from: number, step: number): number | undefined {
    const tabs = this.tabs
    for (let i = 1; i <= tabs.length; i++) {
      const index = (from + step * i + tabs.length * i) % tabs.length
      if (!this.isDisabled(tabs[index])) return index
    }
    return undefined
  }

  /** Velger en fane og melder fra. */
  select(index: number): void {
    const tabs = this.tabs
    if (index < 0 || index >= tabs.length) return
    if (this.isDisabled(tabs[index])) return
    // `markedIndex` og ikke `selected`: den siste svarer 0 også når ingenting
    // er markert, og da lot den første fanen seg aldri velge.
    if (index === this.markedIndex) return

    // Ingen hukommelse når serveren bestemmer valget. Uten dette ville et
    // valg gjort mens attributtet sto der blitt satt tilbake i det noen
    // fjernet det igjen.
    if (!isServerControlled(this)) this.chosenTab = tabs[index]
    this.apply(index)
    if (isServerControlled(this)) this.pendingTab = tabs[index]
    this.showInAddress(index)
    this.notify(index)
  }

  /** Sier fra om hvilken fane som er valgt nå. */
  private notify(index: number): void {
    this.dispatchEvent(
      new CustomEvent("tab-select", {
        detail: { index },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * Skriver valget ut i markupen.
   *
   * Hver skriving sammenligner først. Komponenten observerer de samme
   * attributtene den setter, så en skriving uten sammenligning ville utløst
   * observatøren, som ville skrevet på nytt, i det uendelige.
   */
  private apply(index: number): void {
    const tabs = this.tabs
    /*
     * Tabbestoppet er den valgte fanen, med mindre en patch har deaktivert
     * eller skjult den. Da får den neste fanen som kan velges det, ellers
     * hopper Tab forbi hele raden.
     */
    const stop = this.isDisabled(tabs[index])
      ? (this.nextEnabled(index, 1) ?? index)
      : index
    /*
     * Et panel er synlig når noen fane som peker på det er valgt, og skrives
     * én gang. Peker to faner på det samme, ved en feil i markupen, ville de
     * ellers skrevet motsatt `hidden` på det i hver runde, og siden frosset.
     */
    const panels = new Map<HTMLElement, boolean>()

    tabs.forEach((tab, i) => {
      const chosen = i === index
      // Serverens ord noteres før skrivingen, ellers ble skrivingen lest
      // som serverens i neste runde.
      const server = this.serverSelected(tab)
      setAttr(tab, "aria-selected", String(chosen))
      this.selectedMemory.set(tab, { written: String(chosen), server })
      setAttr(tab, "tabindex", i === stop ? "0" : "-1")

      const panel = this.panelFor(tab)
      if (panel) panels.set(panel, (panels.get(panel) ?? false) || chosen)
    })

    // Formen leses fra et panel serveren skjuler før noe skrives, ellers ble
    // et panel som skal skjules først i raden skrevet i en annen form enn
    // de serveren skjuler.
    for (const panel of panels.keys()) {
      const form = this.serverHidden(panel)
      if (form !== null) {
        this.hiddenForm = form
        break
      }
    }

    for (const [panel, shown] of panels) {
      const server = this.serverHidden(panel)
      const written = shown ? null : this.hiddenForm
      if (panel !== this.revealing) {
        if (written === null) setFlag(panel, "hidden", false)
        else setAttr(panel, "hidden", written)
        this.hiddenMemory.set(panel, { written, server })
      }
      /*
       * Bare det valgte panelet er en tabbestopp, så Tab fra raden går rett
       * inn i innholdet som nettopp ble vist. Et panel med
       * `hidden="until-found"` beholder boksen sin, så med `tabindex="0"` var
       * det et usynlig stopp for tastaturet. En annen verdi serveren skrev,
       * som `-1`, står.
       */
      const tabindex = panel.getAttribute("tabindex")
      if (shown && tabindex === null) setAttr(panel, "tabindex", "0")
      else if (!shown && tabindex === "0") setAttr(panel, "tabindex", null)
    }
  }
}

export function defineFsTabs(tagName: string = FS_TABS_TAG): void {
  defineElement(tagName, FsTabs)
}
