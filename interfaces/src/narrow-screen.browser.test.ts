/// <reference path="./types/css.d.ts" />

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"

import { defineLt } from "./register"
import { mount, waitForPaint } from "./testing/a11y"

import "./tokens/tokens.css"

// Every stylesheet in every component folder, so no component can be forgotten here.
import.meta.glob("./components/*/*/*.css", { eager: true })

/**
 * That the components stay within the screen on a phone.
 *
 * A component that becomes wider than the screen lets the whole page be
 * dragged sideways. It is one of the most common mistakes in a design system,
 * and it does not show in a development window 1400 pixels wide.
 *
 * The window itself is set to 320 pixels, not just a box in a wide window. A
 * dialog, a popover and a toast compute their width from the window, and sit
 * in the top layer or with `position: fixed`, where they do not make the page
 * wider but can still stick out of the screen. The test therefore checks
 * both: that the page cannot scroll sideways, and that everything visible is
 * within the window horizontally, except what is clipped on purpose. Top and
 * bottom are not checked: a page scrolls vertically.
 *
 * The text is long on purpose: it is "Submit the housing benefit application
 * for the whole of calendar year 2026" that breaks a button, not "Submit".
 */

/** The width of a small phone. */
const NARROW = 320

const LONG =
  "Submit the housing benefit application for the whole of calendar year 2026"

type Case = {
  markup: string
  /** What opens the component or shows the state to be checked. */
  open?: () => void | Promise<void>
  /** What must be visible after `open`, so a case does not check a closed component. */
  opened?: string
}

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`Missing ${selector}`)
  return found
}

/** One case per component folder, keyed by the folder's name. */
const COMPONENTS: Record<string, Case[]> = {
  accordion: [
    {
      markup: `<details class="lt-accordion" open>
        <summary>Who can apply for housing benefit for the whole of calendar year 2026?</summary>
        <p>Everyone over 18 who lives in an approved dwelling.</p>
      </details>`,
    },
  ],
  alert: [
    {
      markup: `<div class="lt-alert" data-color="danger">
        <p class="lt-alert__title">The application was not sent</p>
        <p>The network did not respond. Try again in a moment.</p>
      </div>`,
    },
  ],
  avatar: [
    {
      markup: `<span class="lt-avatar" data-size="lg" role="img" aria-label="Jane Smith">JS</span>`,
    },
  ],
  badge: [
    {
      markup: `<span class="lt-badge" data-color="warning">Waiting for documentation from the employer</span>`,
    },
  ],
  breadcrumbs: [
    {
      markup: `<ol class="lt-breadcrumbs">
        <li><a href="#">Home</a></li>
        <li><a href="#">My cases and applications</a></li>
        <li><a href="#" aria-current="page">Application 2026-0481</a></li>
      </ol>`,
    },
  ],
  button: [
    { markup: `<button class="lt-button">${LONG}</button>` },
    {
      markup: `<div style="white-space: nowrap">
        <button class="lt-button">${LONG}</button>
      </div>`,
    },
    {
      markup: `<button class="lt-button">Submit the application now</button>
        <button class="lt-button" data-variant="secondary">Save as draft</button>`,
    },
  ],
  card: [
    {
      markup: `<div class="lt-card">
        <h3 class="lt-card__title">Housing benefit application for 2026</h3>
        <p>Sent 4 March. Case number 2026-0481.</p>
      </div>`,
    },
  ],
  checkbox: [
    {
      markup: `<label><input class="lt-checkbox" type="checkbox" /> I confirm that the information in the application is correct and complete</label>`,
    },
  ],
  divider: [{ markup: `<hr class="lt-divider" />` }],
  "error-text": [
    {
      markup: `<p class="lt-error-text">Enter the national identity number as eleven digits, without spaces or hyphens</p>`,
    },
  ],
  fieldset: [
    {
      markup: `<fieldset class="lt-fieldset">
        <legend class="lt-legend">Who lives in the household with you in 2026?</legend>
        <label><input class="lt-radio" type="radio" name="h" /> Only me</label>
      </fieldset>`,
    },
  ],
  "file-upload": [
    { markup: `<input class="lt-file-upload" type="file" multiple />` },
    {
      markup: `<ul class="lt-file-upload-list">
        <li>
          housing-benefit-application-2026-attachment-1.pdf
          <button class="lt-button" data-variant="ghost" type="button">Remove housing-benefit-application-2026-attachment-1.pdf</button>
        </li>
      </ul>`,
    },
  ],
  heading: [
    {
      markup: `<h1 class="lt-heading" data-size="xl">Housing benefit application for the whole of calendar year 2026</h1>`,
    },
  ],
  "help-text": [
    {
      markup: `<p class="lt-help-text">Eleven digits. You will find it on your bank card or in your tax return.</p>`,
    },
  ],
  icon: [
    {
      markup: `<button class="lt-button" type="button"><svg class="lt-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" /></svg>${LONG}</button>`,
    },
  ],
  input: [
    { markup: `<input class="lt-input" value="${LONG}" />` },
    { markup: `<input class="lt-input" type="date" data-variant="date" />` },
  ],
  label: [
    {
      markup: `<label class="lt-label" data-required>National identity number of the person applying for housing benefit</label>`,
    },
  ],
  link: [
    {
      markup: `<a class="lt-link" href="#">Read more about who can apply for housing benefit for the whole of calendar year 2026</a>`,
    },
  ],
  list: [
    {
      markup: `<ul class="lt-list">
        <li>Payslips for the last three months before the application was sent</li>
        <li>Tenancy agreement</li>
      </ul>`,
    },
  ],
  pagination: [
    {
      markup: `<ul class="lt-pagination">
        <li><a href="#">Previous</a></li><li><a href="#">1</a></li><li><a href="#">2</a></li>
        <li><a href="#">3</a></li><li><a href="#">4</a></li><li><a href="#">Next</a></li>
      </ul>`,
    },
  ],
  paragraph: [
    {
      markup: `<p class="lt-paragraph">The deadline is 1 March. We process the application within four weeks, and send the answer to your inbox.</p>`,
    },
  ],
  progress: [
    {
      markup: `<progress class="lt-progress" value="40" max="100" aria-label="Uploaded"></progress>
        <progress class="lt-progress" aria-label="Uploading"></progress>`,
    },
  ],
  radio: [
    {
      markup: `<label><input class="lt-radio" type="radio" name="r" /> I rent council housing for the whole of calendar year 2026</label>`,
    },
  ],
  search: [
    {
      markup: `<input class="lt-input lt-search" type="search" aria-label="Search" value="${LONG}" />`,
    },
  ],
  select: [
    {
      markup: `<select class="lt-select" aria-label="Municipality">
        <option>Bergen</option>
        <option>Nordre Follo and surrounding inter-municipal housing benefit office</option>
      </select>`,
    },
  ],
  skeleton: [{ markup: `<div class="lt-skeleton"></div>` }],
  "skip-link": [
    {
      markup: `<a class="lt-skip-link" href="#main">Skip to the main content of the housing benefit page</a>`,
      // The link is out of view until it gets focus. One real key press
      // first: a programmatic `focus()` alone sometimes gave no `:focus` in
      // Firefox in CI.
      open: async () => {
        await userEvent.tab()
        element<HTMLAnchorElement>(".lt-skip-link").focus()
      },
      opened: ".lt-skip-link:focus",
    },
  ],
  spinner: [
    {
      markup: `<span class="lt-spinner" role="status" aria-label="Loading the case"></span>`,
    },
  ],
  "sr-only": [
    {
      markup: `<span class="lt-sr-only">${LONG}, and a long help text only screen readers hear</span>`,
    },
  ],
  switch: [
    {
      markup: `<label><input class="lt-switch" type="checkbox" role="switch" /> Send me a text message when the case has been processed</label>`,
    },
  ],
  table: [
    {
      markup: `<div class="lt-table-scroll" tabindex="0">
        <table class="lt-table">
          <thead><tr><th>Invoice number</th><th>Due date</th><th>Amount</th></tr></thead>
          <tbody><tr><td>2026-0481</td><td>4 March 2026</td><td>NOK 1,240</td></tr></tbody>
        </table>
      </div>`,
    },
  ],
  tag: [
    {
      markup: `<button class="lt-tag" data-selectable aria-pressed="true">In progress</button>
        <button class="lt-tag" data-selectable aria-pressed="false">Processed</button>`,
    },
  ],
  textarea: [
    {
      markup: `<textarea class="lt-textarea" aria-label="Reason">${LONG}</textarea>`,
    },
  ],
  "toggle-group": [
    {
      markup: `<fieldset class="lt-toggle-group">
        <legend>View</legend>
        <label class="lt-toggle-group__option"><input type="radio" name="v" checked /> List of cases</label>
        <label class="lt-toggle-group__option"><input type="radio" name="v" /> Calendar view</label>
      </fieldset>`,
    },
  ],
  tooltip: [
    {
      /*
       * The button is in the middle of the row. The bubble is centred over the
       * button and not moved in from the edge, so at the left edge of a phone
       * it is partly outside. That is a known limitation, described on the
       * component page, and it needs anchor positioning or JavaScript.
       */
      markup: `<div style="text-align: center">
        <span class="lt-tooltip">
          <button class="lt-button" type="button" aria-describedby="hint">Archive</button>
          <span class="lt-tooltip__bubble" role="tooltip" id="hint" style="display: block">The case is moved to the archive, and can be retrieved again later</span>
        </span>
      </div>`,
    },
  ],

  "connection-status": [
    {
      markup: `<lt-connection-status></lt-connection-status>`,
      open: async () => {
        const status = element<HTMLElement & { reportFailure(): void }>(
          "lt-connection-status",
        )
        status.reportFailure()
      },
    },
  ],
  toast: [
    {
      markup: `<lt-toast></lt-toast>`,
      open: () =>
        element<HTMLElement & { show(text: string): void }>("lt-toast").show(
          `${LONG} has been received, and you will get an answer within four weeks`,
        ),
      opened: "lt-toast > *",
    },
  ],

  dialog: [
    {
      markup: `<lt-dialog open>
        <dialog class="lt-dialog" aria-labelledby="box-title" open>
          <h2 class="lt-dialog__title" id="box-title">Do you want to withdraw the housing benefit application for the whole of calendar year 2026?</h2>
          <div class="lt-dialog__body"><p>The case will be closed, and you will have to apply again.</p></div>
          <form method="dialog" class="lt-dialog__footer">
            <button class="lt-button" value="withdraw">Withdraw the application</button>
            <button class="lt-button" data-variant="secondary" value="cancel">Cancel</button>
          </form>
        </dialog>
      </lt-dialog>`,
    },
  ],
  "error-summary": [
    {
      markup: `<lt-error-summary class="lt-error-summary" role="alert" tabindex="-1" data-autofocus="false">
        <h2 class="lt-error-summary__title">The form has two errors that must be fixed before you can submit</h2>
        <ul class="lt-list">
          <li><a href="#nin">Enter the national identity number as eleven digits, without spaces</a></li>
          <li><a href="#municipality">Choose the municipality you lived in on 1 January 2026</a></li>
        </ul>
      </lt-error-summary>`,
    },
  ],
  field: [
    {
      markup: `<lt-field>
        <label class="lt-label" for="narrow-email">The email address we should send the decision to</label>
        <input class="lt-input" id="narrow-email" value="jane.smith.with.a.rather.long.name@example.com" />
        <p class="lt-help-text">We never send advertising or newsletters.</p>
        <p class="lt-error-text">Enter an email address with @ and a domain</p>
      </lt-field>`,
    },
  ],
  popover: [
    {
      markup: `<lt-popover open>
        <button class="lt-button" aria-expanded="false" aria-controls="actions">Actions</button>
        <div popover id="actions" class="lt-popover">
          <p>Move the case to another caseworker in the same office</p>
        </div>
      </lt-popover>`,
    },
  ],
  "session-timeout": [
    {
      markup: `<lt-session-timeout warn-at="600" expires-at="900">
        <dialog class="lt-session-timeout__dialog" role="alertdialog" aria-labelledby="session-title">
          <h2 class="lt-session-timeout__title" id="session-title">You will soon be signed out of the housing benefit application</h2>
          <p class="lt-session-timeout__text">We will sign you out in
            <span class="lt-session-timeout__count" aria-hidden="true"></span>.</p>
          <span class="lt-sr-only" role="status"></span>
          <form method="dialog" class="lt-session-timeout__actions">
            <button class="lt-button" value="extend">Stay signed in</button>
            <button class="lt-button" data-variant="secondary" value="logout">Sign out now</button>
          </form>
        </dialog>
      </lt-session-timeout>`,
      // The warning as if time were nearly up.
      open: () =>
        element<HTMLDialogElement>(".lt-session-timeout__dialog").showModal(),
    },
  ],
  suggestion: [
    {
      markup: `<lt-suggestion>
        <label class="lt-label">Municipality</label>
        <div>
          <input class="lt-input" name="municipality" type="text" />
          <ul class="lt-suggestion__list">
            <li>Bergen</li>
            <li>Bjørnafjorden and surrounding inter-municipal housing benefit office</li>
          </ul>
          <span class="lt-sr-only" role="status"></span>
        </div>
      </lt-suggestion>`,
      open: () => {
        const field = element<HTMLInputElement>("lt-suggestion input")
        field.focus()
        field.value = "B"
        field.dispatchEvent(new InputEvent("input", { bubbles: true }))
      },
      // The component must have opened the list. A list it never recognised
      // also has no `hidden`, so it is the field that is asked.
      opened: 'lt-suggestion input[aria-expanded="true"]',
    },
  ],
  tabs: [
    {
      markup: `<lt-tabs>
        <ul class="lt-tabs__list" aria-label="Parts of the case">
          <li><a href="#narrow-application">The application</a></li>
          <li><a href="#narrow-attachments">Attachments and documentation</a></li>
          <li><a href="#narrow-decision">Decision</a></li>
          <li><a href="#narrow-appeal">Appeal against the decision</a></li>
        </ul>
        <section class="lt-tabs__panel" id="narrow-application"><h2>The application</h2>The application arrived on 3 March.</section>
        <section class="lt-tabs__panel" id="narrow-attachments"><h2>Attachments and documentation</h2>Two attachments.</section>
        <section class="lt-tabs__panel" id="narrow-decision"><h2>Decision</h2>Not processed yet.</section>
        <section class="lt-tabs__panel" id="narrow-appeal"><h2>Appeal against the decision</h2>No appeal.</section>
      </lt-tabs>`,
    },
  ],
}

/** The component folders, read from the test files. Each folder has one, see `check-test-files.ts`. */
const FOLDERS = Object.keys(
  import.meta.glob("./components/*/*/*.browser.test.ts"),
).map((path) => path.split("/")[3])

const CASES = Object.entries(COMPONENTS).flatMap(([folder, list]) =>
  list.map((entry, i) => [`${folder} #${i + 1}`, entry] as const),
)

describe(`the components in a window ${NARROW} pixels wide`, () => {
  beforeAll(async () => {
    defineLt()
    await page.viewport(NARROW, 640)
  })

  afterAll(async () => {
    document.body.innerHTML = ""
    // Vitest's default window, so the tests that run afterwards in the same
    // browser do not inherit the phone width.
    await page.viewport(414, 896)
  })

  it("has a case for every component folder", () => {
    expect(FOLDERS.length).toBeGreaterThan(40)
    expect(Object.keys(COMPONENTS).sort()).toEqual([...new Set(FOLDERS)].sort())
  })

  it.each(CASES)("%s stays within the window", async (_name, entry) => {
    mount(entry.markup)
    await waitForPaint()
    await entry.open?.()
    await waitForPaint()
    await waitForPaint()

    expect(window.innerWidth).toBe(NARROW)

    // The page cannot scroll sideways.
    const root = document.documentElement
    expect(
      root.scrollWidth,
      "the page is wider than the window",
    ).toBeLessThanOrEqual(root.clientWidth)

    // What was supposed to open is open.
    if (entry.opened) {
      const opened = document.querySelector(entry.opened)
      expect(opened, `${entry.opened} did not appear`).not.toBeNull()
      expect(opened?.getBoundingClientRect().width).toBeGreaterThan(0)
    }

    // And everything visible is within the window. What is fixed or in the
    // top layer, and everything inside it, does not make the page wider, so
    // the line above does not see it. The exception is what is clipped on
    // purpose: the table in its scroll container, and text only screen
    // readers hear.
    let onTop = 0
    for (const node of document.querySelectorAll("body *")) {
      if (node.closest(".lt-table-scroll, .lt-sr-only")) continue
      const style = getComputedStyle(node)
      if (style.visibility === "hidden") continue
      const box = node.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      const who = `${node.tagName.toLowerCase()}.${node.className}`
      expect(box.left, `${who} on the left`).toBeGreaterThanOrEqual(-0.5)
      expect(box.right, `${who} on the right`).toBeLessThanOrEqual(NARROW + 0.5)
      if (
        node.closest(":modal, :popover-open") ||
        getComputedStyle(node).position === "fixed"
      )
        onTop += 1
    }
    if (
      [
        "dialog",
        "popover",
        "toast",
        "session-timeout",
        "connection-status",
      ].some((m) => _name.startsWith(`${m} `))
    )
      expect(onTop, "did not find the open element").toBeGreaterThan(0)

    for (const dialog of document.querySelectorAll("dialog")) dialog.close()
  })
})
