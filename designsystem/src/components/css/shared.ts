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
