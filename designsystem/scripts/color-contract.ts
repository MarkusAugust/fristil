/**
 * The colour contract for the scripts: the families and the roles, read from
 * `src/tokens/color-contract.json`, which the core also reads.
 */

import { readFileSync } from "node:fs"

const contract: {
  families: string[]
  roles: Record<string, unknown>
} = JSON.parse(
  readFileSync(
    new URL("../src/tokens/color-contract.json", import.meta.url),
    "utf8",
  ),
)

/** The families LO-TEK ships itself. */
export const FAMILIES: readonly string[] = contract.families

/** The roles, named as the contract writes them, such as `textSubtle`. */
export const ROLES: Record<string, unknown> = contract.roles

/** The role name as it is written in CSS. `textSubtle` becomes `text-subtle`. */
export function roleToCss(role: string): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
