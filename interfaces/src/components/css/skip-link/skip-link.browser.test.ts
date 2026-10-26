/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"

import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { skipLink } from "./skip-link"
import skipLinkCss from "./skip-link.css?inline"

import "../../../tokens/tokens.css"
import "./skip-link.css"

/** `transform` when the link is in place: the identity matrix, or `none`. */
const VISIBLE = /matrix\(1, 0, 0, 1, 0, 0\)|none/

describe("lt-skip-link", () => {
  beforeEach(() => {
    mount(`
      <a class="lt-skip-link" href="#main-content" id="skip">Skip to main content</a>
      <main id="main-content" tabindex="-1">
        <p>The content of the page.</p>
      </main>
    `)
  })

  it("stays in the tab order while it is hidden", () => {
    const link = document.getElementById("skip") as HTMLElement
    const style = getComputedStyle(link)

    // display: none or visibility: hidden would take the link out of the
    // tab order, and then it does not exist for the person who needs it.
    expect(style.display).not.toBe("none")
    expect(style.visibility).not.toBe("hidden")
  })

  it("appears when it gets focus", async () => {
    const link = document.getElementById("skip") as HTMLElement
    const hidden = getComputedStyle(link).transform

    // The link slides into place, so the value is read until it is there,
    // not after a fixed pause or on `transitionend`: 250 milliseconds was
    // not always enough in Firefox, and the event did not always arrive
    // there either.
    link.focus()
    await vi.waitFor(
      () => expect(getComputedStyle(link).transform).toMatch(VISIBLE),
      {
        timeout: 3000,
      },
    )

    expect(hidden).not.toMatch(VISIBLE)
    expect(document.activeElement).toBe(link)
  })

  it("appears on :focus, not on :focus-visible", () => {
    // Had the link used `:focus-visible`, it stayed hidden for someone who
    // jumps there from a script after a mouse click. The rule is read from
    // the stylesheet, and tried with an attribute instead of the
    // pseudo-class, so the answer does not depend on whether the window has
    // focus in the engine the test runs in.
    expect(skipLinkCss).toContain(".lt-skip-link:focus {")
    expect(skipLinkCss).not.toMatch(/\.lt-skip-link:focus-visible/)
    mount(`
      <style>
        ${skipLinkCss.replaceAll(":focus", "[data-focus]")}
        .lt-skip-link { transition: none; }
      </style>
      <a class="lt-skip-link" href="#main-content" id="skip">Skip to main content</a>
      <main id="main-content" tabindex="-1"><p>The content of the page.</p></main>
    `)
    const link = document.getElementById("skip") as HTMLElement
    expect(getComputedStyle(link).transform).not.toMatch(VISIBLE)

    link.setAttribute("data-focus", "")
    expect(getComputedStyle(link).transform).toMatch(VISIBLE)
  })

  it("does not treat focus set from code after a mouse click as visible focus", async () => {
    // That is why the stylesheet uses `:focus`. After a key press,
    // `:focus-visible` matches from code too, so the mouse click is what
    // decides, and the click must be real, from the pointer.
    mount(`
      <a class="lt-skip-link" href="#main-content" id="skip">Skip to main content</a>
      <main id="main-content" tabindex="-1">
        <p>The content of the page.</p>
        <button type="button" id="top">Back to top</button>
      </main>
    `)
    const link = document.getElementById("skip") as HTMLElement
    const button = document.getElementById("top") as HTMLElement
    let clicks = 0
    button.addEventListener("click", () => {
      clicks += 1
      link.focus()
    })

    // In Firefox in CI the pointer click from Playwright does not always
    // reach the page, so it is repeated until the listener has run.
    for (let attempt = 0; attempt < 5 && clicks === 0; attempt++) {
      await userEvent.click(button)
      await new Promise((done) => setTimeout(done, 100))
    }
    expect(
      clicks,
      "the pointer click did not reach the button",
    ).toBeGreaterThan(0)

    const state = () =>
      `activeElement=${document.activeElement?.id ?? document.activeElement?.tagName}, hasFocus=${document.hasFocus()}, :focus=${link.matches(":focus")}`
    await vi.waitFor(() => expect(document.activeElement, state()).toBe(link), {
      timeout: 3000,
    })
    expect(link.matches(":focus-visible"), state()).toBe(false)
  })

  it("moves focus to the target when it has tabindex", async () => {
    // Without `tabindex="-1"` the browser scrolls to the target but does not
    // move focus, so the screen reader is not told that the user has
    // arrived. The page said that the next Tab then continued in the menu,
    // but the browser continues from the target either way: it is the focus
    // that is missing.
    mount(`
      <a class="lt-skip-link" href="#main-content" id="skip">Skip to main content</a>
      <header><a href="#menu" id="menu">Menu</a></header>
      <main id="main-content" tabindex="-1">
        <input id="inside" aria-label="Search the content" />
      </main>
    `)
    // A text field and not a link first in the content: WebKit on macOS,
    // like Safari, skips links and buttons with Tab, but stops in a text
    // field. What the test asks, where the next Tab continues from, is the
    // same.
    const link = document.getElementById("skip") as HTMLAnchorElement
    const target = document.getElementById("main-content") as HTMLElement

    // The jump to the fragment does not happen in the same turn as the click
    // in every engine: Chromium moves focus at once, Firefox in a later
    // task. So the test waits for the focus, not for the click.
    link.focus()
    link.click()
    await vi.waitFor(() => expect(document.activeElement).toBe(target))

    await userEvent.tab()
    expect(document.activeElement?.id).toBe("inside")

    target.removeAttribute("tabindex")
    location.hash = ""
    link.focus()
    link.click()
    await vi.waitFor(() => expect(document.activeElement).toBe(document.body))

    await userEvent.tab()
    expect(document.activeElement?.id).toBe("inside")
  })

  it("sets the attributes from the builder function", () => {
    expect(skipLink()).toEqual({ class: "lt-skip-link" })
  })

  it("has no accessibility violations", async () => {
    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
