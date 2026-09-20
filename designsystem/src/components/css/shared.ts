/**
 * Felles byggeklosser for komponent-API-et.
 *
 * Hver komponent eksporterer én funksjon som tar et valgobjekt og returnerer
 * attributtene du sprer inn i elementet. Formen er lik for alle, slik at du
 * bare trenger å lære den én gang.
 */

/** Fjerner attributter uten verdi, så `{...spredning}` ikke setter tomme felt. */
export function attributter<T extends Record<string, unknown>>(verdier: T): T {
  const ut = {} as T
  for (const [navn, verdi] of Object.entries(verdier)) {
    if (verdi !== undefined) {
      ;(ut as Record<string, unknown>)[navn] = verdi
    }
  }
  return ut
}

/** Lager en typevakt for en liste av lovlige strenger. */
export function lagVakt<T extends string>(lovlige: readonly T[]) {
  return (verdi: string): verdi is T =>
    (lovlige as readonly string[]).includes(verdi)
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
export const isFieldState = lagVakt(fieldStates)

/** Hvordan et påkrevd felt markeres i ledeteksten. */
export const requiredMarkers = ["symbol", "text"] as const
export type RequiredMarker = (typeof requiredMarkers)[number]
export const isRequiredMarker = lagVakt(requiredMarkers)

