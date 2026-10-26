/// <reference path="./types/css.d.ts" />
/// Without this, Vitest's `CDPSession` is an empty interface. The provider
/// fills it, and here it is Playwright that gives us `send`.
/// <reference types="@vitest/browser-playwright" />

import { afterEach, describe, expect, it } from "vitest"
import { cdp, server } from "vitest/browser"
import { waitForPaint } from "./testing/a11y"
import tokenSource from "./tokens/tokens.css?inline"

import "./tokens/tokens.css"

/**
 * `data-theme` is a theme boundary, and LO-TEK leaves the host alone.
 *
 * Both came from a component that is embedded in a host page it does not
 * own. It sets `data-theme="light"` on its own root element and expects
 * light colours whatever the machine is set to.
 *
 * Two things failed. `[data-theme="light"]` only declared `color-scheme`,
 * while `[data-theme="dark"]` declared all 90 tokens, so the light theme only
 * worked on `<html>`: a child cannot override a variable it inherits without
 * declaring it again. And `color-scheme: light dark` was on `:root`, so the
 * whole host page got dark scrollbars and form controls in dark mode.
 *
 * The file is split in two. What is only about the attributes runs in all
 * three engines, since that is where the rules live. What needs to know what
 * the machine is set to has to emulate `prefers-color-scheme`, and that goes
 * through CDP, which only Chromium has from here.
 */

const LIGHT = "#0d4e8c"
const DARK = "#99c8ff"
const TOKEN = "--lt-color-accent-text"

/** The value an element actually sees, inheritance included. */
function token(el: Element): string {
  return getComputedStyle(el).getPropertyValue(TOKEN).trim()
}

function get(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`did not find #${id}`)
  return el
}

function cleanUp() {
  document.documentElement.removeAttribute("data-theme")
  document.body.innerHTML = ""
}

describe("data-theme is a theme boundary in every engine", () => {
  afterEach(cleanUp)

  it("gives light tokens in a div, whatever the machine is set to", () => {
    document.body.innerHTML = `<div data-theme="light"><p id="i">i</p></div>`
    expect(token(get("i"))).toBe(LIGHT)
  })

  it("gives dark tokens in a div, whatever the machine is set to", () => {
    document.body.innerHTML = `<div data-theme="dark"><p id="i">i</p></div>`
    expect(token(get("i"))).toBe(DARK)
  })

  it("lets one theme sit inside another, both ways", () => {
    document.body.innerHTML = `
      <div data-theme="dark">
        <p id="outer">outer</p>
        <div data-theme="light"><p id="inner">inner</p></div>
      </div>
    `
    expect(token(get("outer"))).toBe(DARK)
    expect(token(get("inner"))).toBe(LIGHT)

    document.body.innerHTML = `
      <div data-theme="light">
        <p id="outer">outer</p>
        <div data-theme="dark"><p id="inner">inner</p></div>
      </div>
    `
    expect(token(get("outer"))).toBe(LIGHT)
    expect(token(get("inner"))).toBe(DARK)
  })

  it("sets color-scheme where a theme is chosen, and only there", () => {
    // Without this, a light field gets a black dropdown under it. But the
    // property is inherited, so a value on `:root` applies to the whole
    // document. It must therefore never be there unless someone asked for it.
    document.body.innerHTML = `
      <div id="light" data-theme="light"></div>
      <div id="dark" data-theme="dark"></div>
    `
    expect(getComputedStyle(get("light")).colorScheme).toBe("light")
    expect(getComputedStyle(get("dark")).colorScheme).toBe("dark")
    expect(getComputedStyle(document.documentElement).colorScheme).toBe(
      "normal",
    )
  })
})

/**
 * Reads one rule block out of the source, as name to value.
 *
 * Throws if the selector is not found. An `indexOf` that returns -1 would
 * otherwise give an empty string, and an assertion that something is *not*
 * there would pass without having read a single line.
 */
function block(selector: string): Map<string, string> {
  // The selector stands alone ("… {") or first in a list ("…,"), since the
  // theme blocks got `.lt-theme-control` as an extra line.
  const start = [`${selector} {`, `${selector},`]
    .map((m) => tokenSource.indexOf(m))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0]
  if (start === undefined)
    throw new Error(`did not find ${selector} in tokens.css`)
  const opened = tokenSource.indexOf("{", start)
  const end = tokenSource.indexOf("\n  }", opened)
  if (end < 0) throw new Error(`found no end to ${selector}`)
  return new Map(
    [...tokenSource.slice(opened, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
      (m) => [m[1], m[2].trim()],
    ),
  )
}

describe("the two theme blocks are symmetric", () => {
  it("declares exactly the same tokens", () => {
    const light = block('[data-theme="light"]')
    const dark = block('[data-theme="dark"]')

    // The asymmetry was the whole bug: light had zero tokens, dark had 90.
    expect(light.size).toBeGreaterThan(0)
    expect([...dark.keys()].filter((t) => !light.has(t))).toEqual([])
    expect([...light.keys()].filter((t) => !dark.has(t))).toEqual([])
  })

  it("gives the light block exactly the values from :root", () => {
    // The names alone are not enough. Had `lightLines` been taken from the
    // wrong source, or had `--lt-icon-*` got its dark stroke colours, the
    // names would still have matched while the colours were wrong.
    const root = block("  :root")
    const mismatches = [...block('[data-theme="light"]')].filter(
      ([name, value]) => root.get(name) !== value,
    )
    expect(mismatches).toEqual([])
  })

  it("gives the dark block exactly the values from the media query", () => {
    const media = block('    :root:not([data-theme="light"])')
    const mismatches = [...block('[data-theme="dark"]')].filter(
      ([name, value]) => media.get(name) !== value,
    )
    expect(mismatches).toEqual([])
  })

  it("does not set color-scheme on bare :root", () => {
    // `block` throws if the selector is missing, so this cannot pass empty.
    expect([...block("  :root").keys()]).not.toContain("color-scheme")
    expect(tokenSource.slice(0, tokenSource.indexOf("\n  }"))).not.toContain(
      "color-scheme",
    )
  })
})

/**
 * Writes a theme picker into body and checks one of the options.
 *
 * `:root:has()` sees the whole document, so the control can be anywhere.
 * `checked` is set as a property and not as an attribute, because the
 * property is what `:checked` reads, and it is what the user's click changes.
 */
function choose(theme: "auto" | "light" | "dark" | "none"): void {
  document.body.innerHTML = `
    <fieldset class="lt-toggle-group">
      <legend class="lt-sr-only">Theme</legend>
      ${["auto", "light", "dark"]
        .map(
          (v) => `<label class="lt-toggle-group__option">
            <input class="lt-theme-control" type="radio" name="theme"
                   value="${v}" id="option-${v}"> ${v}
          </label>`,
        )
        .join("")}
    </fieldset>
    <p id="outside">outside</p>
  `
  if (theme !== "none")
    (get(`option-${theme}`) as HTMLInputElement).checked = true
}

/**
 * `.lt-theme-control` lets the user choose a theme without a line of
 * JavaScript.
 *
 * The control must win over `data-theme` on `<html>`, because the server
 * sends the choice it has stored, and the click must take effect at once
 * rather than wait for a POST to come back. The order is a matter of
 * specificity, and it is checked here rather than argued in the generator.
 *
 * Each test sets `data-theme` on `<html>` to the opposite of what it expects.
 * Without that, a test would pass just because the machine happened to be set
 * to the same, and then it would not have asserted anything.
 */
describe("the theme picker works without JavaScript", () => {
  afterEach(cleanUp)

  it("beats the server's light choice when the user picks dark", () => {
    document.documentElement.setAttribute("data-theme", "light")
    choose("dark")
    expect(token(get("outside"))).toBe(DARK)
  })

  it("beats the server's dark choice when the user picks light", () => {
    document.documentElement.setAttribute("data-theme", "dark")
    choose("light")
    expect(token(get("outside"))).toBe(LIGHT)
  })

  it("lets the server decide when the user chooses to follow the system", () => {
    // "Follow the system" has no rule, and that is the whole point: three
    // states out of two selectors. If `auto` matches anything, it is one rule
    // too many.
    document.documentElement.setAttribute("data-theme", "dark")
    choose("auto")
    expect(token(get("outside"))).toBe(DARK)
  })

  it("does nothing until someone has chosen", () => {
    // Without `:checked` in the selector, an untouched group would set the
    // theme at once.
    document.documentElement.setAttribute("data-theme", "dark")
    choose("none")
    expect(token(get("outside"))).toBe(DARK)
  })

  it("leaves a theme boundary inside the page alone", () => {
    // The control is on `:root`, and a boundary further down is closer to
    // the inheriting element. Without that, a preview panel would follow the
    // picker against its will.
    choose("dark")
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div data-theme="light"><p id="inside">inside</p></div>`,
    )
    expect(token(get("outside"))).toBe(DARK)
    expect(token(get("inside"))).toBe(LIGHT)
  })

  it("is on both theme blocks in tokens.css", () => {
    // Had it been only on the dark one, the user could never get back to light.
    for (const theme of ["light", "dark"]) {
      const selector = `:root:has(.lt-theme-control[value="${theme}"]:checked)`
      expect(tokenSource).toContain(selector)
      expect(block(`  [data-theme="${theme}"]`).size).toBeGreaterThan(0)
    }
  })

  it('lets each option decide color-scheme, "follow the system" included', () => {
    /*
     * This is the one rule `auto` has, and it came from a trap.
     *
     * The advice was that the consumer writes `color-scheme: light dark` on
     * `<html>` themselves. If they do that outside a layer, the rule beats
     * `@layer lotek`, and a chosen dark theme got light scrollbars. The
     * control takes care of it instead, so whoever uses it does not write
     * `color-scheme` at all.
     */
    const scheme = () => getComputedStyle(document.documentElement).colorScheme

    choose("auto")
    expect(scheme()).toBe("light dark")

    choose("light")
    expect(scheme()).toBe("light")

    choose("dark")
    expect(scheme()).toBe("dark")
  })

  it('lets "follow the system" give way to the server\'s data-theme', () => {
    /*
     * The tokens and `color-scheme` must always say the same thing.
     *
     * `auto` has no token block, so the server's `data-theme="dark"` stays.
     * Without `:not([data-theme])` on the `auto` rule, `auto` still won on
     * `color-scheme`, since `:has()` is more specific than the attribute. The
     * result was dark colours with light scrollbars, exactly the mismatch the
     * theme blocks exist to prevent.
     */
    document.documentElement.setAttribute("data-theme", "dark")
    choose("auto")

    expect(token(get("outside"))).toBe(DARK)
    expect(getComputedStyle(document.documentElement).colorScheme).toBe("dark")

    // And light, to show that it is not only dark that happens to match.
    document.documentElement.setAttribute("data-theme", "light")
    choose("auto")

    expect(token(get("outside"))).toBe(LIGHT)
    expect(getComputedStyle(document.documentElement).colorScheme).toBe("light")
  })

  it("lets a data-theme without a block behave like no data-theme", () => {
    /*
     * The condition on the `auto` rule asks about the value, not about
     * whether the attribute exists.
     *
     * Had it asked `:not([data-theme])`, a value without a block, such as
     * `auto` or a typo, blocked the whole rule. The tokens fell back to
     * `:root` and the media query, while `color-scheme` was left unset: the
     * same mismatch as above, triggered from the other end.
     */
    choose("auto")
    const without = token(get("outside"))

    document.documentElement.setAttribute(
      "data-theme",
      "something-that-does-not-exist",
    )
    expect(token(get("outside"))).toBe(without)
    expect(getComputedStyle(document.documentElement).colorScheme).toBe(
      "light dark",
    )
  })
})

/*
 * The emulation goes through CDP and only exists in Chromium. The rules are
 * plain CSS without script, so the block above covers the other two engines.
 */
describe.skipIf(server.browser !== "chromium")(
  "against what the machine is set to",
  () => {
    async function setSystemTheme(scheme: "light" | "dark") {
      await cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: scheme }],
      })
      await waitForPaint()
    }

    afterEach(async () => {
      // The emulation applies to the whole page and would otherwise carry
      // over into the tests that run after this file.
      await cdp().send("Emulation.setEmulatedMedia", { features: [] })
      cleanUp()
    })

    it("follows the system when nobody has chosen a theme", async () => {
      document.body.innerHTML = `<p id="outside">outside</p>`
      await setSystemTheme("light")
      expect(token(get("outside"))).toBe(LIGHT)

      await setSystemTheme("dark")
      expect(token(get("outside"))).toBe(DARK)
    })

    it("keeps a light component light on a dark machine", async () => {
      // This was the bug: before the fix, the div inherited the dark value
      // from `:root`, because the block did not declare the tokens again.
      document.body.innerHTML = `
        <p id="outside">outside</p>
        <div data-theme="light"><p id="inside">inside</p></div>
      `
      await setSystemTheme("dark")
      expect(token(get("inside"))).toBe(LIGHT)
      expect(token(get("outside"))).toBe(DARK)
    })

    it("lets the user choose light on a dark machine", async () => {
      /*
       * The only one of the picker's rules that needs emulation.
       *
       * Here the opponent is the media query and not an attribute, and it
       * has a different specificity. Without emulation the test would pass
       * by itself on a light machine, that is without having seen what it is
       * named after.
       */
      choose("light")
      await setSystemTheme("dark")
      expect(token(get("outside"))).toBe(LIGHT)

      // And back: "follow the system" gives the dark machine its own answer.
      ;(get("option-auto") as HTMLInputElement).checked = true
      await waitForPaint()
      expect(token(get("outside"))).toBe(DARK)
    })

    it("lets an app force the light theme on the whole document", async () => {
      document.body.innerHTML = `<p id="outside">outside</p>`
      document.documentElement.setAttribute("data-theme", "light")
      await setSystemTheme("dark")
      expect(token(get("outside"))).toBe(LIGHT)
    })

    it("leaves color-scheme on html alone in both modes", async () => {
      for (const scheme of ["light", "dark"] as const) {
        await setSystemTheme(scheme)
        expect(getComputedStyle(document.documentElement).colorScheme).toBe(
          "normal",
        )
      }
    })
  },
)
