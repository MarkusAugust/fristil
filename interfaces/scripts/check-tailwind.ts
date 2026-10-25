/**
 * Checks that the Tailwind theme gives the values it promises.
 *
 * The file `src/tailwind/tailwind.css` is plain CSS, and the package has no
 * dependency on Tailwind. So no type error or version conflict can report a
 * problem: a typo in a variable name just gives a utility class that silently
 * does not exist.
 *
 * Here the theme is compiled with a real Tailwind, and the check confirms
 * that the classes actually come out with LO-TEK's tokens in them.
 *
 * Run with: bun scripts/check-tailwind.ts
 */

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"
import { colorTokens } from "../src/tokens/tokens.js"

const packageRoot = fileURLToPath(new URL("../", import.meta.url))

async function loadStylesheet(id: string, basedir: string) {
  const path = id.startsWith(".")
    ? join(basedir, id)
    : Bun.resolveSync(id, basedir)
  return {
    path,
    base: dirname(path),
    content: await readFile(path, "utf8"),
  }
}

const theme = await readFile(
  join(packageRoot, "src/tailwind/tailwind.css"),
  "utf8",
)

const input = `
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
${theme}
`

const compiler = await compile(input, { base: packageRoot, loadStylesheet })

/*
 * Every colour, not a sample.
 *
 * The list used to have seven hand-picked cells and a comment that said "one
 * cell per role, and one per family". Counted, it was seven of 86 colours,
 * so neither every role nor every family, and a generator that skipped the
 * `warning` row or the `content` column went unnoticed. Now the list is
 * built from `colorTokens`, the same source the generator reads, so the
 * coverage is complete by definition.
 *
 * That is not circular: what is checked is not that the names match, but
 * that a real Tailwind makes a class from each of them, with the token in it.
 */
const colorClasses: [className: string, contains: string][] = Object.keys(
  colorTokens,
)
  .filter((name) => name.startsWith("--lt-color-"))
  .map((name) => [`bg-lt-${name.slice("--lt-color-".length)}`, `var(${name})`])

/** The class, and what it must contain for the connection to be real. */
const expected: [className: string, contains: string][] = [
  ["p-4", "calc(var(--lt-spacing-1) * 4)"],
  ["gap-2", "calc(var(--lt-spacing-1) * 2)"],
  // Tailwind's own `px` is the fixed pixel, like `--lt-spacing-px`. The table
  // on the Design tokens page gives it as the counterpart, and that must be true.
  ["p-px", "1px"],
  ...colorClasses,
  // One colour as text as well, so the namespace does not only work for backgrounds.
  ["text-lt-accent-text", "var(--lt-color-accent-text)"],
  ["border-lt-neutral-border", "var(--lt-color-neutral-border)"],
  ["text-lt-xxs", "var(--lt-font-size-xxs)"],
  ["text-lt-mega", "var(--lt-font-size-mega)"],
  ["max-w-lt-aside", "384px"],
  ["shadow-lt-overlay", "var(--lt-shadow-overlay)"],
]

const css = compiler.build(expected.map(([className]) => className))
const failures: string[] = []

for (const [className, contains] of expected) {
  const rule = new RegExp(
    `\\.${className.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{[^}]*\\}`,
  ).exec(css)

  if (!rule) {
    failures.push(`.${className} was not generated at all`)
  } else if (!rule[0].includes(contains)) {
    failures.push(
      `.${className} does not contain ${contains}: ${rule[0].trim()}`,
    )
  }
}

/** Classes that would mean we have taken over something that is Tailwind's own. */
const mustNotTouch: [className: string, notContains: string][] = [
  ["bg-neutral-100", "--lt-color"],
  ["max-w-md", "--container-lt"],
]

const otherCss = compiler.build(mustNotTouch.map(([className]) => className))

for (const [className, notContains] of mustNotTouch) {
  const rule = new RegExp(
    `\\.${className.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{[^}]*\\}`,
  ).exec(otherCss)

  if (rule?.[0].includes(notContains)) {
    failures.push(`.${className} is overridden by LO-TEK: ${rule[0].trim()}`)
  }
}

if (failures.length > 0) {
  console.error(
    `The Tailwind theme does not keep its promise:\n\n${failures
      .map((line) => `  ${line}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `The Tailwind theme gives ${expected.length} checked classes LO-TEK's values, ${colorClasses.length} of them one colour each, and leaves Tailwind's own alone.`,
)
