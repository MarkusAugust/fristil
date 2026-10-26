/// <reference path="./types/css.d.ts" />

import { beforeAll, describe, expect, it } from "vitest"

import { lt } from "./lt"

/**
 * The stylesheets the package ships stay within their own namespace.
 *
 * A package that goes into arbitrary apps cannot claim ordinary words. We had
 * `.link` and `.srOnly` in `utilities.css`, without a prefix and outside the
 * layer. Both are silent bugs for the consumer: the class collides with their
 * own, and a rule outside the layer beats theirs whatever the specificity.
 *
 * The tests here read the stylesheets as text, so a new component is caught
 * by itself without anyone remembering to add it.
 */

const stylesheets = import.meta.glob("./**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/**
 * Removes comments, strings and `url(...)`.
 *
 * Without that, `w3.org` inside an inline SVG is read as the class `.org`,
 * and the test reports something that does not exist.
 */
function onlyRules(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/url\([^)]*\)/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/'[^']*'/g, " ")
}

/**
 * What comes after the brace that closes the first block. For a stylesheet
 * that starts with `@layer lotek {`, that is everything outside the layer.
 * Strings and comments must already be removed, as `onlyRules` does. If the
 * block is never closed, it answers with a message saying so, and the check
 * fails.
 */
function afterFirstBlock(rules: string): string {
  let depth = 0
  for (let i = rules.indexOf("{"); i >= 0 && i < rules.length; i++) {
    if (rules[i] === "{") depth++
    else if (rules[i] === "}" && --depth === 0) return rules.slice(i + 1)
  }
  return "(the block is never closed)"
}

/** Stylesheets that only collect other files, and so have no rules of their own. */
function isBundle(source: string): boolean {
  return onlyRules(source)
    .split("\n")
    .every((line) => line.trim() === "" || line.trim().startsWith("@import"))
}

/**
 * Counts the values in a shorthand, without counting inside `var()` and
 * `calc()`.
 *
 * `padding: var(--lt-spacing-2) calc(var(--lt-spacing-4) + var(--lt-spacing-2))` is two values,
 * not five.
 */
function valueCount(value: string): number {
  let depth = 0
  let count = 0
  let inWhitespace = true

  for (const char of value.trim()) {
    if (char === "(") depth += 1
    else if (char === ")") depth -= 1

    const whitespace = /\s/.test(char)
    if (depth === 0 && !whitespace && inWhitespace) count += 1
    if (depth === 0) inWhitespace = whitespace
  }

  return count
}

/** The class selectors in a file, without duplicates. */
function classNames(source: string): string[] {
  const found = onlyRules(source).match(/\.[a-zA-Z_][\w-]*/g) ?? []
  return [...new Set(found.map((name) => name.slice(1)))]
}

/**
 * The Tailwind theme is not a component stylesheet.
 *
 * It is a `@theme` block that gives Tailwind LO-TEK's values, so it is
 * outside the layer on purpose and defines variables in Tailwind's
 * namespace. The rules below therefore do not apply to it, but the file has
 * its own further down.
 */
const isTailwindTheme = (name: string) => name.includes("/tailwind/")

const files = Object.entries(stylesheets).filter(
  ([name, source]) => !isBundle(source) && !isTailwindTheme(name),
)

describe("the stylesheets the package ships", () => {
  it("has stylesheets to check", () => {
    expect(files.length).toBeGreaterThan(5)
  })

  /*
   * The boundary against a host page is the exception. It only works because
   * it is outside the layer, at the same level as the host's CSS; see
   * `boundary.css`.
   */
  const layered = files.filter(([name]) => !name.endsWith("/boundary.css"))

  it.each(layered)("%s is in @layer lotek", (_name, source) => {
    // `@import` must come first in a CSS file, so that part is skipped.
    const withoutImport = onlyRules(source)
      .split("\n")
      .filter((line) => !line.trim().startsWith("@import"))
      .join("\n")

    expect(withoutImport.trimStart().startsWith("@layer lotek")).toBe(true)
    // And nothing after the layer is closed: a rule there is outside the
    // layer and beats the consumer's CSS whatever the specificity.
    expect(afterFirstBlock(withoutImport).trim()).toBe("")
  })

  it("finds a rule after the layer is closed", () => {
    const rules = onlyRules(
      '@layer lotek { .lt-a { color: red } }\n/* } */ .lt-b { content: "}" }',
    )
    expect(afterFirstBlock(rules).trim()).toMatch(/^\.lt-b/)
    expect(
      afterFirstBlock("@layer lotek { .lt-a { color: red } }\n").trim(),
    ).toBe("")
    expect(afterFirstBlock("@layer lotek { .lt-a { color: red }")).not.toBe("")
  })

  it("has no characters outside ASCII except in comments", () => {
    /*
     * `content: " (påkrevd)"` came out as "pÃ¥krevd" on a page without
     * `<meta charset>` from a server that does not send the charset: a
     * stylesheet without `@charset` inherits the charset of the page that
     * links it. The character is written as an escape, `\e5`. A test in the
     * browser does not see the difference, since it gets the file as UTF-8,
     * so the rule is read from the source. The comments are stripped by
     * `build-css.ts` and do not matter.
     */
    const findings: string[] = []
    let read = 0
    for (const [name, source] of Object.entries(stylesheets)) {
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "")
      for (const line of withoutComments.split("\n")) {
        // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII is exactly what is being looked for
        if (/[^\x00-\x7f]/.test(line)) findings.push(`${name}: ${line.trim()}`)
      }
      read++
    }

    expect(read).toBeGreaterThan(30)
    expect(findings).toEqual([])
  })

  it.each(files)("%s only uses lt-prefixed classes", (_name, source) => {
    const unprefixed = classNames(source).filter(
      (name) => !name.startsWith("lt-"),
    )
    expect(unprefixed).toEqual([])
  })

  /*
   * The components must mirror themselves in languages written right to
   * left. That takes logical properties all the way: `margin-inline-start`
   * rather than `margin-left`. A single `padding-left` is enough to put a
   * component wrong, and it does not show until someone switches language.
   *
   * `background-position` has no logical variant, and is flipped with
   * `:dir(rtl)`.
   */
  it.each(
    files,
  )("%s uses logical properties, not left and right", (_name, source) => {
    const physical = [
      ...onlyRules(source).matchAll(
        /(?:^|[\s;{])((?:margin|padding|border)-(?:left|right)|left|right|text-align)\s*:\s*([^;}]+)/g,
      ),
    ]
      .filter(([, property, value]) =>
        property === "text-align" ? /\b(left|right)\b/.test(value) : true,
      )
      .map(([, property]) => property)

    expect([...new Set(physical)]).toEqual([])
  })

  /*
   * Four values in `padding`, `margin` or `inset` are top, right, bottom,
   * left. Two of them are physical sides, and they do not flip with the
   * language. `.lt-select` had `padding: … calc(…) … var(--lt-spacing-3)` to
   * keep room for its arrow, and in RTL the room ended up on the wrong side
   * while the text lay on top of the arrow. Three values are safe: the middle
   * one is then both physical sides, and equal on both.
   */
  it.each(
    files,
  )("%s uses no physical four-value shorthands", (_name, source) => {
    const wrong = [
      ...onlyRules(source).matchAll(
        /(?:^|[\s;{])(padding|margin|inset|border-width|border-color|border-style)\s*:\s*([^;}]+)/g,
      ),
    ]
      .filter(([, , value]) => valueCount(value) >= 4)
      .map(([, property, value]) => `${property}: ${value.trim()}`)

    expect(wrong).toEqual([])
  })

  /*
   * The focus ring must come from `--lt-focus-ring`, not be written out.
   *
   * It was written with width and colour in twenty rules spread over
   * eighteen stylesheets. The selectors differ in each component, so it
   * could not be collected in one rule, but the value is the same everywhere
   * and belongs in a token. A component that needs a different colour, like
   * the skip link, writes `outline-color` after the shorthand and inherits
   * the width.
   */
  it.each(
    files,
  )("%s does not write out the focus ring by hand", (name, source) => {
    if (name.includes("/tokens/")) return

    const written = [
      ...onlyRules(source).matchAll(/outline:\s*([^;}]*\bsolid\b[^;}]*)/g),
    ].map((match) => match[1].trim())

    expect(written).toEqual([])
  })

  it.each(files)("%s names the classes in kebab-case", (_name, source) => {
    const wrongForm = classNames(source).filter(
      (name) =>
        !/^lt-[a-z0-9]+(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?$/.test(name),
    )
    expect(wrongForm).toEqual([])
  })
})

/**
 * `tokens.css` as text, the source both the token names and the kinds are
 * read from.
 *
 * If the glob does not find it, it throws here. A `?? ""` used to be here,
 * and then `TOKEN_KINDS` was empty, `isToken()` always false, and every
 * `--lt-*` name counted as a component variable. The check was then back in
 * exactly the state it was written to get out of, without a word.
 */
const tokenSource = Object.entries(stylesheets).find(([name]) =>
  name.endsWith("/tokens/tokens.css"),
)?.[1]

if (!tokenSource)
  throw new Error("Did not find tokens.css among the stylesheets")

/** Everything actually defined in `tokens.css`, both themes. */
const definedTokens = new Set(
  [...tokenSource.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]),
)

describe("the variables the components read", () => {
  const componentFiles = files.filter(([name]) => !name.includes("/tokens/"))

  it.each(
    componentFiles,
  )("%s defines no variables of its own outside the lt namespace", (_name, source) => {
    const defined = [...onlyRules(source).matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(
      (match) => match[1],
    )
    expect(defined.filter((name) => !name.startsWith("--lt-"))).toEqual([])
  })

  it.each(
    componentFiles,
  )("%s only reads tokens and its own component variables", (_name, source) => {
    const read = [...onlyRules(source).matchAll(/var\((--[\w-]+)/g)].map(
      (match) => match[1],
    )

    /*
     * The list of allowed names is taken from `tokens.css`, not from a list
     * of prefixes written here.
     *
     * The prefix list was here for a long time, and said `--semantic-`,
     * `--size` and `--font-size`. When `--font-weight-medium` became a token,
     * the test failed on a component that did exactly what it should, and the
     * failure pointed at the component rather than at the list. With the
     * token file as the reference, a new token can be used without a test
     * having to change, and a name that does not exist is still caught.
     *
     * The exception is component variables, which are the consumer's to set
     * and are outside `tokens.css` on purpose. The exception once covered the
     * whole `--lt-` prefix, and the day the tokens were renamed from
     * `--semantic-*` to `--lt-color-*` the test silently stopped looking at
     * tokens at all. `--lt-color-accent-fill-hover`, which does not exist,
     * was then in `button.css` and made the primary button invisible on
     * hover without any of the guards saying so. The exception is therefore
     * `isToken`, not the prefix.
     */
    const unknown = read.filter((name) => {
      if (name.startsWith("--lt-") && !isToken(name)) return false
      return !definedTokens.has(name)
    })
    expect([...new Set(unknown)]).toEqual([])
  })
})

describe("the fallbacks the components have", () => {
  const componentFiles = files.filter(([name]) => !name.includes("/tokens/"))

  it.each(
    componentFiles,
  )("%s gives every component variable a fallback", (_name, source) => {
    /*
     * `var(--lt-x)` without a fallback gives nothing when the consumer has
     * not set it, and then the whole declaration drops out. The rule in the
     * project is that shape and size are read from a component variable
     * *with the token value as the fallback*, and the fallback is what this
     * test looks for.
     *
     * The test above says that every name exists. This one says that there
     * is something after the comma. The two were once the same check written
     * twice.
     */
    /*
     * Tokens need no fallback, component variables do.
     *
     * A token is always set by `tokens.css`, while `--lt-button-padding` is
     * the consumer's to set and is empty until they do. The kind in the name
     * tells them apart: `--lt-color-*` is a token, `--lt-<component>-*` is
     * not.
     */
    const without = [
      ...onlyRules(source).matchAll(/var\(\s*(--lt-[\w-]+)\s*([,)])/g),
    ]
      .filter((match) => match[2] === ")")
      .map((match) => match[1])
      .filter((name) => !isToken(name))

    expect([...new Set(without)]).toEqual([])
  })
})

/**
 * The kinds a token can have. Everything else is a component variable.
 *
 * The list is read out of `tokens.css` rather than written here. Had it been
 * written here, a new kind would have slipped through as component
 * variables, and a name that does not exist would never have been caught:
 * that is exactly how `--lt-color-accent-fill-hover` got in.
 *
 * The kind is the first segment after `--lt-`, so `--lt-line-height-default`
 * gives `line`. Coarser than the name, and on purpose: a component variable
 * called `--lt-line-something` would then be required in `tokens.css`, and
 * that is right, because the name would read as a token.
 */
const TOKEN_KINDS = [
  ...new Set(
    [...tokenSource.matchAll(/^\s*--lt-([a-z]+)(?:-[a-z0-9-]+)?\s*:/gm)].map(
      (match) => match[1],
    ),
  ),
]

function isToken(name: string): boolean {
  return TOKEN_KINDS.some(
    (kind) => name === `--lt-${kind}` || name.startsWith(`--lt-${kind}-`),
  )
}

describe("the Tailwind theme", () => {
  const theme = Object.entries(stylesheets).find(([name]) =>
    isTailwindTheme(name),
  )?.[1]

  it("exists", () => {
    expect(theme).toBeTypeOf("string")
  })

  it("only adds names in the lt namespace", () => {
    const defined = [
      ...onlyRules(theme ?? "").matchAll(/^\s*(--[\w-]+)\s*:/gm),
    ].map((match) => match[1])

    // `--spacing` is the exception, on purpose: it is Tailwind's spacing
    // unit, and the whole point is that `p-4` becomes `--lt-spacing-4`.
    const outside = defined.filter(
      (name) =>
        name !== "--spacing" &&
        !/^--(color|text|container|shadow|font|radius|leading|tracking|breakpoint)-lt-/.test(
          name,
        ),
    )

    expect(outside).toEqual([])
  })

  it("takes every value from LO-TEK's tokens", () => {
    const read = [...onlyRules(theme ?? "").matchAll(/var\((--[\w-]+)/g)].map(
      (match) => match[1],
    )

    const foreign = read.filter((name) => !isToken(name))

    expect([...new Set(foreign)]).toEqual([])
  })
})

/**
 * Every allowed value a builder function advertises exists in the CSS.
 *
 * `lt.fieldset.states` listed `success` from the day the component arrived,
 * while `fieldset.css` only had a rule for `invalid`. The attribute was
 * written, and nothing happened. The builder function promised something the
 * package did not deliver, and no test saw it: `dom.browser.test.ts` checks
 * that the value can be set and removed, not that it means anything.
 *
 * Values that write no attribute are skipped. That is the default, which the
 * CSS already has, and values that are not meant to look different, like
 * most `input.types`. Two separate tests make sure the skip list does not
 * become a back door: the option name must be one the builder function
 * knows, and every list must give at least one case.
 */
describe("every allowed value exists in the CSS", () => {
  // The stylesheets must be in the document for the computed style to mean
  // anything. They are taken from the same glob the rest of the file reads as
  // text, so no list can get out of step.
  /*
   * `onlyRules` removes strings, and an attribute value in a selector is
   * exactly that: `[data-color="success"]` became `[data-color= ]`. Here only
   * comments and `url(...)` are removed, which is what otherwise gives false
   * matches.
   */
  const allRules = Object.values(stylesheets)
    .map((source) =>
      source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/url\([^)]*\)/g, " "),
    )
    .join("\n")

  /**
   * The selectors that actually apply in this engine, taken from CSSOM.
   *
   * A rule can be in the stylesheet without doing anything here: `@supports
   * (appearance: base-select)` does not hold in Firefox, and `@media
   * (forced-colors: active)` does not apply until the mode is on. The styled
   * dropdown is in both, and a text search sees no difference between them
   * and a rule that applies. The test then reported a failure in one of
   * three engines on something that is entirely correct. The browser knows
   * the answer itself, so we ask it.
   */
  const active: { selector: string; rule: CSSStyleRule }[] = []

  function collect(rules: CSSRuleList, applies: boolean): void {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (applies) {
          for (const part of rule.selectorText.split(",")) {
            active.push({ selector: part.trim(), rule })
          }
        }
        collect(rule.cssRules, applies)
      } else if (rule instanceof CSSSupportsRule) {
        collect(rule.cssRules, applies && CSS.supports(rule.conditionText))
      } else if (rule instanceof CSSMediaRule) {
        collect(
          rule.cssRules,
          applies && matchMedia(rule.conditionText).matches,
        )
      } else if (rule instanceof CSSGroupingRule) {
        collect(rule.cssRules, applies)
      }
    }
  }

  beforeAll(() => {
    for (const [path, source] of Object.entries(stylesheets)) {
      const sheet = document.createElement("style")
      sheet.dataset.from = path
      /*
       * `@import` must go. Each file is added on its own, so the neighbour is
       * already there, and a relative path would give a 404 from here anyway.
       * In WebKit it is not harmless: a stylesheet with an unresolved
       * `@import` is not applied at all, and `.lt-legend[data-required]::after`
       * from `fieldset.css` computed to `content: none` while the identical
       * rule in `label.css` worked. Chromium and Firefox just skipped the
       * dead import.
       */
      sheet.textContent = source.replace(/@import[^;]*;/g, "")
      document.head.append(sheet)
      if (sheet.sheet) collect(sheet.sheet.cssRules, true)
    }
  })

  /**
   * The list on the builder function, the option that picks the value, and
   * the attribute it ends up in.
   *
   * All three are written out. When we derived the option name from the
   * plural s, `markers` became `marker`, while the option is called
   * `required`. The call then gave no attributes, and the loop below read
   * that as "this is the default" and skipped it. Four values were never
   * checked, and nothing said so.
   */
  const LISTS: [list: string, option: string, attribute: string][] = [
    ["variants", "variant", "data-variant"],
    ["colors", "color", "data-color"],
    ["sizes", "size", "data-size"],
    ["states", "state", "data-state"],
    ["pickers", "picker", "data-picker"],
    ["markers", "required", "data-required"],
    ["types", "type", "data-variant"],
  ]

  type BuilderFunction = ((
    options?: Record<string, unknown>,
  ) => Record<string, unknown>) &
    Record<string, unknown>

  /**
   * A fixed id for the builder functions that require one. Without it
   * `idOrFallback` makes a random id per call, and two calls never give the
   * same answer, so the default could not be recognised. The flat builder
   * functions ignore the keys.
   */
  const STABLE_ID = { id: "guard", titleId: "guard" }

  /** The attribute set that carries the attribute, in a flat or composite answer. */
  function partWith(
    answer: Record<string, unknown>,
    attribute: string,
  ): Record<string, unknown> | undefined {
    if (answer[attribute] !== undefined) return answer
    for (const part of Object.values(answer)) {
      if (part && typeof part === "object" && !Array.isArray(part)) {
        const found = partWith(part as Record<string, unknown>, attribute)
        if (found) return found
      }
    }
    return undefined
  }

  /** One case: a builder function, a value, and the element it must match. */
  type Case = {
    name: string
    list: string
    classes: string[]
    attribute: string
    value: string
  }

  const cases: Case[] = []
  const skipped: string[] = []

  for (const [name, value] of Object.entries(lt)) {
    if (typeof value !== "function") continue
    const builder = value as unknown as BuilderFunction

    for (const [list, option, attribute] of LISTS) {
      const values = builder[list]
      if (!Array.isArray(values)) continue

      for (const v of values) {
        // The composite builder functions give one attribute set per part,
        // like `lt.dialog()` with `host`, `dialog` and `header`. The attribute
        // is then on the part that carries it, and that is the one rendered.
        const out = partWith(builder({ ...STABLE_ID, [option]: v }), attribute)

        // Values that give no attribute have no rule to check. There are two
        // kinds: the default, which the CSS already has, and values that are
        // not meant to look different, like `input.types=text`, where only a
        // few types get an icon.
        if (out === undefined) {
          skipped.push(`${name}.${list}=${v}`)
          continue
        }

        cases.push({
          name,
          list: `${name}.${list}`,
          classes: String(out.class ?? "")
            .split(" ")
            .filter(Boolean),
          attribute,
          value: String(out[attribute]),
        })
      }
    }
  }

  it("has values to check", () => {
    expect(cases.length).toBeGreaterThan(30)
  })

  it("uses an option name the builder function actually knows", () => {
    /*
     * If `LISTS` has the wrong option name, the builder function takes
     * nothing in, and answers the same as it does without arguments, whatever
     * the value. The loop above reads that as "this is the default" and skips
     * the whole list without saying so. That is how `markers` went missing:
     * the option is called `required`, not `marker`.
     *
     * Only one value in a list can give the same as the default call, namely
     * the default itself. If two do, the name is wrong.
     */
    for (const [name, value] of Object.entries(lt)) {
      if (typeof value !== "function") continue
      const builder = value as unknown as BuilderFunction

      for (const [list, option] of LISTS) {
        const values = builder[list]
        if (!Array.isArray(values)) continue

        const standard = JSON.stringify(builder(STABLE_ID))
        const same = values.filter(
          (v) =>
            JSON.stringify(builder({ ...STABLE_ID, [option]: v })) === standard,
        )
        expect(
          same,
          `${name}.${list} answers the same for ${same.join(", ")}`,
        ).toHaveLength(same.length > 1 ? 0 : same.length)
      }
    }
  })

  it("checks every list a builder function has", () => {
    /*
     * `LISTS` is written by hand, and a list missing there is never checked
     * without anything saying so. It is the same class of bug as the list
     * `setAttributes` used to clean up after: an attribute that is not in a
     * handwritten table is invisible to the test, not to the user.
     */
    const known = new Set(LISTS.map(([list]) => list))
    const unknown: string[] = []

    for (const [name, value] of Object.entries(lt)) {
      if (typeof value !== "function") continue
      const builder = value as unknown as BuilderFunction
      for (const [list, values] of Object.entries(builder)) {
        // `Object.assign` hangs both allowed values and guards on the
        // function. The lists are what we are after.
        if (!Array.isArray(values)) continue
        if (!known.has(list)) unknown.push(`${name}.${list}`)
      }
    }

    expect(unknown).toEqual([])
  })

  it("covers every list with at least one case", () => {
    const lists = new Set<string>()
    for (const [name, value] of Object.entries(lt)) {
      if (typeof value !== "function") continue
      const builder = value as unknown as BuilderFunction
      for (const [list] of LISTS) {
        if (Array.isArray(builder[list])) lists.add(`${name}.${list}`)
      }
    }

    const covered = new Set(cases.map((c) => c.list))
    expect([...lists].filter((l) => !covered.has(l))).toEqual([])
  })

  /**
   * The value actually does something, not just that the selector exists.
   *
   * A text search passes on a rule with an empty block, on one that only
   * applies in forced colours mode, and on one that is overridden further
   * down. So the element is rendered twice, with and without the attribute,
   * and something in the computed style must differ. The pseudo-elements are
   * included, because `data-required` only shows through `::after`.
   *
   * Some states colour a child rather than the element itself: the fieldset
   * colours `.lt-legend`, and the striped table colours the rows. Then there
   * is no rule on the element to compare, and the test falls back to the
   * selector being in a stylesheet. The fallback is limited to exactly those
   * cases: if there is a rule on the element itself, the difference is
   * required.
   */
  it.each(
    cases.map((c) => [c.list, c.value, c] as const),
  )("%s=%s changes something", (_list, _value, testCase) => {
    // The bare selector is included because some rules cover all the values
    // at once: `.lt-label[data-required]` gives the asterisk whether the
    // value is `symbol` or `text`.
    const selectors = testCase.classes.flatMap((cls) => [
      `.${cls}[${testCase.attribute}="${testCase.value}"]`,
      `.${cls}[${testCase.attribute}]`,
    ])

    const exists = selectors.some((s) => allRules.includes(s))
    expect(exists, `no rule for ${selectors[0]}`).toBe(true)

    /*
     * If a rule that applies here matches the element itself, it must be
     * visible: the element is rendered twice, with and without the
     * attribute, and something in the computed style must differ. The
     * pseudo-elements are included one by one, because `data-required` only
     * shows through `::after`.
     */
    const pseudos = ["", "::after", "::before"]
    const matchesSelf = pseudos.filter((pseudo) =>
      active.some(({ selector }) =>
        selectors.some((s) => selector === `${s}${pseudo}`),
      ),
    )

    if (matchesSelf.length === 0) {
      /*
       * Otherwise the rule colours a child: the fieldset colours
       * `.lt-legend`, and the striped table colours every other row. Then
       * there is nothing on the element itself to compare, and the
       * requirement is instead that a rule that applies here actually
       * declares something. A text search alone passed on an empty block,
       * and an empty rule was exactly what I managed to add without the test
       * saying so.
       *
       * A rule in a `@supports` the engine does not have, or in a `@media`
       * that does not match, is not in `active`, and must not count either.
       */
      const declaring = active.filter(
        ({ selector, rule }) =>
          selectors.some((s) => selector.startsWith(s)) &&
          rule.style.length > 0,
      )
      if (declaring.length > 0) return

      // If the engine has no active rule at all, it is because the rule is
      // behind a condition it does not meet. Then it is right that it does
      // nothing here.
      const anyAtAll = active.some(({ selector }) =>
        selectors.some((s) => selector.startsWith(s)),
      )
      expect(
        anyAtAll,
        `${selectors[0]} only matches children, and the rule declares nothing`,
      ).toBe(false)
      return
    }

    const without = document.createElement("span")
    without.className = testCase.classes.join(" ")
    const withAttribute = document.createElement("span")
    withAttribute.className = testCase.classes.join(" ")
    withAttribute.setAttribute(testCase.attribute, testCase.value)

    document.body.append(without, withAttribute)
    try {
      const differs = (pseudo: string) => {
        const a = getComputedStyle(without, pseudo || undefined)
        const b = getComputedStyle(withAttribute, pseudo || undefined)
        for (let i = 0; i < a.length; i += 1) {
          const name = a.item(i)
          if (a.getPropertyValue(name) !== b.getPropertyValue(name)) return true
        }
        return false
      }

      for (const pseudo of matchesSelf) {
        expect(
          differs(pseudo),
          `${selectors[0]}${pseudo} changes nothing`,
        ).toBe(true)
      }
    } finally {
      without.remove()
      withAttribute.remove()
    }
  })
})
