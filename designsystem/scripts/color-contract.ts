/**
 * Fargekontrakten for skriptene: familiene og rollene, lest fra
 * `src/tokens/fargekontrakt.json`, som kjernen også leser.
 */

import { readFileSync } from "node:fs"

const kontrakt: {
  families: string[]
  roles: Record<string, unknown>
} = JSON.parse(
  readFileSync(
    new URL("../src/tokens/fargekontrakt.json", import.meta.url),
    "utf8",
  ),
)

/** Familiene Fristil leverer selv. */
export const FAMILIES: readonly string[] = kontrakt.families

/** Rollene, med navnet slik kontrakten skriver det, som `textSubtle`. */
export const ROLES: Record<string, unknown> = kontrakt.roles

/** Rollenavnet slik det skrives i CSS. `textSubtle` blir `text-subtle`. */
export function roleToCss(role: string): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
