/// <reference path="../../../types/css.d.ts" />

import { beforeEach, describe, expect, it } from "vitest"
import {
  expectNoAccessibilityViolations,
  mount,
  waitForPaint,
} from "../../../testing/a11y"
import { color } from "../../../testing/color"

import "../../../tokens/tokens.css"
import "./badge.css"

function css(id: string) {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element #${id}`)
  }

  return getComputedStyle(element)
}

describe("lt-badge", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="default" class="lt-badge">Info</span>
      <span id="success" class="lt-badge" data-color="success">Active</span>
      <span id="warning" class="lt-badge" data-color="warning">Warning</span>
      <span id="danger" class="lt-badge" data-color="danger">Error</span>
      <span id="neutral" class="lt-badge" data-color="neutral">Inactive</span>
    `
  })

  it("applies default (interactive) colors", () => {
    const badge = css("default")
    expect(badge.backgroundColor).toBe(color("--lt-color-accent-surface"))
    expect(badge.color).toBe(color("--lt-color-accent-text"))
  })

  it("applies success colors", () => {
    const badge = css("success")
    expect(badge.backgroundColor).toBe(color("--lt-color-success-surface"))
    expect(badge.color).toBe(color("--lt-color-success-text"))
  })

  it("applies warning colors", () => {
    const badge = css("warning")
    expect(badge.backgroundColor).toBe(color("--lt-color-warning-surface"))
    expect(badge.color).toBe(color("--lt-color-warning-text"))
  })

  it("applies danger colors", () => {
    const badge = css("danger")
    expect(badge.backgroundColor).toBe(color("--lt-color-danger-surface"))
    expect(badge.color).toBe(color("--lt-color-danger-text"))
  })

  it("applies neutral colors", () => {
    const badge = css("neutral")
    expect(badge.backgroundColor).toBe(color("--lt-color-neutral-surface"))
    expect(badge.color).toBe(color("--lt-color-neutral-text"))
  })
})

describe("lt-badge accessibility", () => {
  it("has enough contrast in every colour variant", async () => {
    mount(`
      <span class="lt-badge">In progress</span>
      <span class="lt-badge" data-color="success">Granted</span>
      <span class="lt-badge" data-color="warning">Missing attachment</span>
      <span class="lt-badge" data-color="danger">Rejected</span>
      <span class="lt-badge" data-color="neutral">Archived</span>
    `)

    await waitForPaint()
    await expectNoAccessibilityViolations()
  })
})
