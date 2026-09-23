/**
 * Felles byggeklosser for komponent-API-et.
 *
 * Hver komponent eksporterer én funksjon som tar et valgobjekt og returnerer
 * attributtene du sprer inn i elementet. Formen er lik for alle, slik at du
 * bare trenger å lære den én gang.
 */

/** Fjerner attributter uten verdi, så `{...spredning}` ikke setter tomme felt. */
export function attributes<T extends Record<string, unknown>>(values: T): T {
  const result = {} as T
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) {
      ;(result as Record<string, unknown>)[name] = value
    }
  }
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
const sagt = new Set<string>()

function advarEnGang(melding: string): void {
  if (typeof console === "undefined" || sagt.has(melding)) return
  sagt.add(melding)
  console.warn(melding)
}

let idTeller = 0

/**
 * Lager en id som er unik innenfor dokumentet.
 *
 * Trygg bare når markupen rendres én gang. Rendres det samme feltet både på en
 * server og i nettleseren, gir de to kjøringene to ulike id-er, og da er
 * koblingen brutt til rammeverket har rettet den opp.
 */
export function createFieldId(): string {
  idTeller += 1
  return `fs-field-${idTeller}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Id-en byggeren fikk, eller en reserve med en beskjed.
 *
 * Hver bygger som tar en id krever den i typen. Det holder ikke alene: en
 * konsument uten TypeScript ser ingen type, og ren HTML med
 * `<script type="module">` er en førsteklasses måte å bruke Fristil på. Uten
 * reserven ble id-ene til strenger som `undefined-list`, `aria-controls` pekte
 * dit, og koblingen var brutt på en måte som så gyldig ut.
 *
 * Den tomme strengen teller som ingen id. `fs.field({ id: "" })` ga `for=""`
 * og `help.id="-help"`, altså det samme problemet uten at noe sa fra.
 *
 * Navnet på byggeren står i meldingen. Uten det sa forslagsfeltet «fs.field()»
 * og sendte utvikleren til feil sted.
 */
export function idEllerReserve(bygger: string, id: string | undefined): string {
  if (typeof id === "string" && id.trim() !== "") return id

  advarEnGang(
    `${bygger}: ingen id oppgitt, så det lages en tilfeldig. To kjøringer gir ` +
      "da to ulike, og rendres markupen både på en server og i nettleseren, " +
      "peker koblingen på noe som ikke finnes. Oppgi id, i React fra useId().",
  )
  return createFieldId()
}
