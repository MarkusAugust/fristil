/**
 * The core's accessibility tree, for the tests and the checks.
 *
 * Not part of the package: the input must carry what a browser computed on
 * each element (`renderedMarkup()` in `rendered.ts` writes it), and the
 * package ships no browser. The calls go through `instantiate()` in
 * `diagnostics/core.ts`, the same as every other call into the core.
 */
import { instantiate } from "../diagnostics/core"

/**
 * One element as a screen reader is given it: the WAI-ARIA role, the name
 * and description from AccName, and the Core-AAM states. What AT-SPI, AX or
 * UIA call the role is `platform.ts`'s, not the core's.
 */
export type AxNode = {
  role: string
  name: string
  description: string
  states: string[]
  id: string | null
}

export type AccessibilityCore = {
  /** The tree of a page `renderedMarkup()` wrote. Throws, with the core's reason, on what it would have to guess. */
  tree(html: string): AxNode[]
  /** The facts the core requires on every element, from the core itself. */
  facts: string[]
  /** The WAI-ARIA roles the core knows. */
  roles: string[]
  /** The states the core can give, by WAI-ARIA name. */
  states: string[]
}

export function accessibilityCore(
  source: BufferSource | WebAssembly.Module,
): AccessibilityCore {
  const { e, write, read, answer } = instantiate(source)
  e.accessibility_facts_raw()
  const facts = read<string[]>()
  e.accessibility_roles_raw()
  const roles = read<string[]>()
  e.accessibility_states_raw()
  const states = read<string[]>()
  return {
    tree: (html) => answer(e.accessibility_tree_raw(...write(html))),
    facts,
    roles,
    states,
  }
}
