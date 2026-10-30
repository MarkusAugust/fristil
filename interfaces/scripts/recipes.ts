/**
 * The stylesheets the recipes link, read from the package's own `exports`,
 * and the reading of the pages from `src/testing/recipes.ts`, which the
 * browser tests use too.
 */
import pkg from "../package.json"

export {
  CDN,
  dedent,
  htmlBlocks,
  tabItems,
  VERSION_PLACEHOLDER,
} from "../src/testing/recipes"

/**
 * The file behind a stylesheet name such as "input" or "tokens", read from
 * the package's own `exports`, as `Example.astro` reads it.
 */
export function stylesheetPath(name: string): string {
  const target = (pkg.exports as Record<string, unknown>)[`./${name}.css`]
  if (typeof target !== "string")
    throw new Error(`"./${name}.css" is not in the package's exports`)
  return target.slice(2)
}
