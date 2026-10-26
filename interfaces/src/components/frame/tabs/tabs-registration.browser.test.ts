/// <reference path="../../../types/css.d.ts" />

import { describe, expect, it } from "vitest"

import { mount, waitForPaint } from "../../../testing/a11y"
import { goTo } from "../../../testing/address"
import { defineLtTabs } from "./lt-tabs"

import "../../../tokens/tokens.css"
import "./tabs.css"

/*
 * The file runs in its own frame, so `lt-tabs` is unregistered until the test
 * registers it itself. The transition is what the test is about: what
 * `tabs.css` shows before registration must be what the component shows
 * afterwards (requirement A4).
 */
const PAGE = `
  <lt-tabs>
    <ul class="lt-tabs__list" aria-label="Outer"><li><a href="#ya">YA</a></li><li><a href="#yb">YB</a></li></ul>
    <section class="lt-tabs__panel" id="ya"><h2>YA</h2>Outer a</section>
    <section class="lt-tabs__panel" id="yb"><h2>YB</h2>
      <lt-tabs>
        <ul class="lt-tabs__list" aria-label="Middle"><li><a href="#ma">MA</a></li><li><a href="#mb">MB</a></li></ul>
        <section class="lt-tabs__panel" id="ma"><h3>MA</h3>Middle a</section>
        <section class="lt-tabs__panel" id="mb"><h3>MB</h3>
          <lt-tabs server-controlled>
            <ul class="lt-tabs__list" aria-label="Inner"><li><a href="#ia">IA</a></li><li><a href="#ib">IB</a></li></ul>
            <section class="lt-tabs__panel" id="ia"><h4>IA</h4>Inner a</section>
            <section class="lt-tabs__panel" id="ib"><h4>IB</h4><p id="deep">Deep</p></section>
          </lt-tabs>
        </section>
      </lt-tabs>
    </section>
  </lt-tabs>
  <lt-tabs>
    <ul class="lt-tabs__list" aria-label="Beside"><li><a href="#sa">SA</a></li><li><a href="#sb">SB</a></li></ul>
    <section class="lt-tabs__panel" id="sa"><h2>SA</h2>Beside a</section>
    <section class="lt-tabs__panel" id="sb"><h2>SB</h2>Beside b</section>
  </lt-tabs>`

const IDS = ["ya", "yb", "ma", "mb", "ia", "ib", "sa", "sb"]

/**
 * The panels whose content is visible. The heading, not the panel: a panel
 * with `hidden="until-found"` keeps its box but not its content, and itself
 * answers `true` to `checkVisibility()`.
 */
function visible(): string[] {
  return IDS.filter((id) =>
    (
      document.getElementById(id)?.firstElementChild as HTMLElement
    ).checkVisibility(),
  )
}

describe("the transition from tabs.css to the component", () => {
  it("shows the same panels before and after registration", async () => {
    expect(customElements.get("lt-tabs")).toBeUndefined()
    mount(PAGE)
    await goTo("#deep")
    await waitForPaint()
    const before = visible()

    defineLtTabs()
    await customElements.whenDefined("lt-tabs")
    await waitForPaint()
    await waitForPaint()

    // The target is in a tab list with server-controlled, where the address
    // does not select. The two outer tab lists show the panel holding the
    // target, and the tab list beside them shows its first.
    expect(before).toEqual(["yb", "mb", "ia", "sa"])
    expect(visible()).toEqual(before)
  })
})
