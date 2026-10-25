/**
 * Felles byggeklosser for komponent-API-et.
 *
 * Hver komponent eksporterer én funksjon som tar et objekt med valg og returnerer
 * attributtene du sprer inn i elementet. Formen er lik for alle, slik at du
 * bare trenger å lære den én gang.
 */

/**
 * Attributtene hvert sett forvalter, også dem som er av akkurat nå.
 *
 * `attributes()` stryker nøklene uten verdi, og da er det borte hvilke
 * attributter byggefunksjonen har et ord om. `setAttributes` trenger nettopp
 * det: `lt.switch()` forvalter `disabled` og skal kunne fjerne det, mens
 * `lt.button()` aldri har skrevet det og skal la det stå. Lista ligger i et
 * kart ved siden av objektet, ikke på det, så spredning, JSON og React ser
 * det samme som før.
 */
const managed = new WeakMap<object, readonly string[]>()

/** Navnene settet forvalter, eller `undefined` for et sett vi ikke har laget. */
export function managedNames(set: object): readonly string[] | undefined {
  return managed.get(set)
}

/**
 * Gir et sett som er skrevet om fra et annet, de samme forvaltede navnene.
 *
 * `/react` døper `class` om til `className` i et nytt objekt, og det nye
 * objektet sto ikke i kartet. `lt.setAttributes` derfra ryddet da bare
 * `data-*`, og `aria-invalid` ble stående etter at feltet var rettet.
 * Navnene gis slik de heter i det nye settet.
 *
 * For `/react` og andre innganger som skriver settene om, ikke for apper:
 * et sett fra `lt.*` er allerede forvaltet.
 */
export function rememberManaged(set: object, names: readonly string[]): void {
  managed.set(set, names)
}

/**
 * Fjerner attributter uten verdi, så `{...spredning}` ikke setter tomme felt.
 *
 * Bygger settet på et annet, som `lt.search()` på `lt.input()`, sendes det
 * andre inn som `based`. Spredningen har alt mistet nøklene som var av, og
 * uten dette forvaltet søkefeltet `data-state` bare når den tilfeldigvis var
 * satt: den kunne settes, men ikke fjernes.
 */
export function attributes<T extends Record<string, unknown>>(
  values: T,
  ...based: object[]
): T {
  const result = {} as T
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) {
      ;(result as Record<string, unknown>)[name] = value
    }
  }
  const names = new Set(Object.keys(values))
  for (const set of based) {
    for (const name of managed.get(set) ?? []) names.add(name)
  }
  managed.set(result, [...names])
  return result
}

/** Lager en typevakt for en liste av lovlige strenger. */
export function createGuard<T extends string>(allowed: readonly T[]) {
  return (value: string): value is T =>
    (allowed as readonly string[]).includes(value)
}

/**
 * Valideringstilstand for skjemakontroller.
 *
 * Input, textarea og select hadde hver sin identiske type. Nå er det én, så
 * en verdi kan sendes mellom dem uten konvertering.
 */
export const fieldStates = ["default", "invalid", "success"] as const
export type FieldState = (typeof fieldStates)[number]
export type NonDefaultFieldState = Exclude<FieldState, "default">
export const isFieldState = createGuard(fieldStates)

/** Hvordan et påkrevd felt markeres i ledeteksten. */
export const requiredMarkers = ["symbol", "text"] as const
export type RequiredMarker = (typeof requiredMarkers)[number]
export const isRequiredMarker = createGuard(requiredMarkers)

/**
 * Sier fra én gang per melding, i konsollen.
 *
 * Byggefunksjonene er rene funksjoner uten et element å henge beskjeden på,
 * så de kan ikke bruke `warnAboutMarkup`. Dedupliseringen trengs like fullt:
 * en app som rendrer en liste med felt ville ellers sagt det samme per felt og
 * per rendring.
 */
const said = new Set<string>()

export function warnOnce(message: string): void {
  if (typeof console === "undefined" || said.has(message)) return
  said.add(message)
  console.warn(message)
}

let idCounter = 0

/**
 * Lager en id som er unik innenfor dokumentet.
 *
 * Trygg bare når markupen rendres én gang. Rendres det samme feltet både på en
 * server og i nettleseren, gir de to kjøringene to ulike id-er, og da er
 * koblingen brutt til rammeverket har rettet den opp.
 */
export function createFieldId(): string {
  idCounter += 1
  return `lt-field-${idCounter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Nøklene en byggefunksjon lager id-er av, sjekket.
 *
 * En nøkkel er det samme som `key` i React: en fast verdi fra dataene, som
 * et kommunenummer. Id-en blir den samme ved hver rendring, og en
 * oppdatering fra serveren kjenner elementet igjen. En indeks er ingen
 * nøkkel: setter serveren inn en rad først, peker den samme indeksen på noe
 * annet.
 *
 * Kaster, framfor å si fra og lage en reserve som `idOrFallback` gjør: en
 * tom nøkkel, en med mellomrom eller to like gir id-er som er tomme, ugyldige
 * eller like, og det finnes ingen reserve som er riktig. Mellomrom er det
 * JavaScript regner som mellomrom (`\s`), som Kotlin-utgaven skriver ut.
 */
export function checkedKeys(builder: string, keys: unknown): string[] {
  if (!Array.isArray(keys)) {
    throw new Error(
      `${builder}: keys mangler. Gi en liste med én nøkkel per element, fra dataene, som et kommunenummer.`,
    )
  }
  const seen = new Set<string>()
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new Error(
        `${builder}: en nøkkel i keys er ikke tekst, men ${typeof key}. Nøklene blir id-er; gjør tall om til tekst, som String(kommunenummer).`,
      )
    }
    if (key === "") {
      throw new Error(
        `${builder}: en nøkkel i keys er tom. Nøklene blir id-er, og hver må være en fast verdi fra dataene.`,
      )
    }
    if (/\s/.test(key)) {
      throw new Error(
        `${builder}: nøkkelen «${key}» har mellomrom. Nøklene blir id-er, og en id kan ikke ha mellomrom.`,
      )
    }
    if (seen.has(key)) {
      throw new Error(
        `${builder}: nøkkelen «${key}» står to ganger i keys. Nøklene blir id-er, og to like id-er peker på det samme elementet.`,
      )
    }
    seen.add(key)
  }
  return keys
}

/**
 * Id-en byggefunksjonen fikk, eller en reserve med en beskjed.
 *
 * Hver byggefunksjon som tar en id krever den i typen. Det holder ikke alene: en
 * konsument uten TypeScript ser ingen type, og ren HTML med
 * `<script type="module">` er en førsteklasses måte å bruke LO-TEK på. Uten
 * reserven ble id-ene til strenger som `undefined-list`, `aria-controls` pekte
 * dit, og koblingen var brutt på en måte som så gyldig ut.
 *
 * Den tomme strengen teller som ingen id. `lt.field({ id: "" })` ga `for=""`
 * og `help.id="-help"`, altså det samme problemet uten at noe sa fra.
 *
 * Navnet på byggefunksjonen står i meldingen. Uten det sa forslagsfeltet «lt.field()»
 * og sendte utvikleren til feil sted.
 */
export function idOrFallback(
  builder: string,
  id: string | undefined,
  option = "id",
): string {
  if (typeof id === "string" && id.trim() !== "") return id

  warnOnce(
    `${builder}: ingen ${option} oppgitt, så det lages en tilfeldig. To kjøringer gir ` +
      "da to ulike, og rendres markupen både på en server og i nettleseren, " +
      "peker koblingen på noe som ikke finnes. Sender serveren området på " +
      "nytt med en ny id, kjenner morfingen ikke elementene igjen og bytter " +
      `dem ut, og det brukeren gjorde i dem er borte. Oppgi ${option}, i React fra useId().`,
  )
  return createFieldId()
}
