import axe from "axe-core"

/**
 * Helpers for accessibility testing in the browser.
 *
 * The system promises that accessibility is solved centrally. These
 * functions turn the promise into something that is actually checked, so a
 * component cannot ship with too little contrast or missing wiring between
 * label and field without a test saying so.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]

/**
 * Sets up a surface with the design system's page colours and puts the HTML
 * in it.
 *
 * The background must be opaque and set explicitly: axe computes contrast by
 * looking upwards for a background colour, and if it finds none, it reports
 * "incomplete" instead of giving an answer. The test would then have been
 * indifferent to exactly what we want to check.
 */
export function mount(html: string): HTMLElement {
  document.body.style.background = "var(--lt-color-neutral-canvas)"
  document.body.style.color = "var(--lt-color-neutral-text-strong)"
  document.body.innerHTML = `<div id="lt-test-surface">${html}</div>`

  const surface = document.getElementById("lt-test-surface")
  if (!(surface instanceof HTMLElement)) {
    throw new Error("Could not mount the test surface")
  }

  surface.style.background = "var(--lt-color-neutral-canvas)"
  surface.style.color = "var(--lt-color-neutral-text-strong)"
  surface.style.padding = "var(--lt-spacing-4)"

  return surface
}

export type AccessibilityViolation = {
  rule: string
  help: string
  elements: string[]
}

/**
 * Runs axe against `root` and returns the violations of WCAG 2.1 level A and
 * AA.
 *
 * What axe could not decide ("incomplete") is not a violation, and does not
 * fail the test. Most often it is contrast over a gradient, a pseudo-element
 * or an image. But they are counted, and if there are any, one line is
 * written with the count and the rules, so a component where axe has
 * silently stopped being able to answer shows up. With the reporter Vitest
 * picks outside a terminal, the console is not shown for a test that
 * passes. `--silent=false --reporter=default` shows it.
 */
export async function findAccessibilityViolations(
  root: Element = document.body,
): Promise<AccessibilityViolation[]> {
  const results = await axe.run(root, {
    runOnly: { type: "tag", values: WCAG_AA },
    resultTypes: ["violations", "incomplete"],
  })
  const undecided = results.incomplete.reduce(
    (sum, item) => sum + item.nodes.length,
    0,
  )
  if (undecided > 0)
    console.info(
      `axe could not decide ${undecided} checks (${document.documentElement.getAttribute("data-theme") ?? "no theme"}): ${results.incomplete.map((u) => `${u.id} (${u.nodes.length})`).join(", ")}`,
    )

  return results.violations.map((violation) => ({
    rule: violation.id,
    help: violation.help,
    elements: violation.nodes.map((node) => node.html),
  }))
}

/**
 * Throws with a readable summary if axe finds violations, in the light or
 * the dark theme.
 *
 * Both themes are checked every time, with `data-theme` on `<html>`. Before,
 * only light was checked, and a colour that held its contrast in light but
 * not in dark got through. If there is a `data-theme` further in, it applies
 * there, as on a real page. The theme on `<html>` is restored afterwards.
 *
 * The error message must say which theme, which rule breaks and on which
 * element, so whoever gets the red test does not have to run axe by hand to
 * understand what is wrong.
 */
export async function expectNoAccessibilityViolations(
  root: Element = document.body,
): Promise<void> {
  const html = document.documentElement
  const before = html.getAttribute("data-theme")
  const violations: AccessibilityViolation[] = []
  // Transitions are turned off before the theme changes. A transition that
  // is already running does not stop when `transition` is set to `none`
  // afterwards, and axe read the colour of a link halfway between light and
  // dark. Animations off too, as in `check-accessibility.ts`, so axe reads a
  // settled state.
  const noMotion = document.createElement("style")
  noMotion.textContent =
    "*, *::before, *::after { transition: none !important; animation: none !important }"
  document.head.append(noMotion)
  try {
    for (const theme of ["light", "dark"]) {
      html.setAttribute("data-theme", theme)
      await waitForPaint()
      for (const b of await findAccessibilityViolations(root))
        violations.push({ ...b, rule: `${b.rule} (${theme})` })
    }
  } finally {
    // The theme is restored while transitions are still off, and they are
    // turned on again only after a frame. Otherwise a test that looked at the
    // colours afterwards read a value on its way back from dark.
    if (before === null) html.removeAttribute("data-theme")
    else html.setAttribute("data-theme", before)
    await waitForPaint()
    noMotion.remove()
  }
  if (violations.length === 0) return

  const summary = violations
    .map(
      (b) =>
        `  ${b.rule}: ${b.help}\n${b.elements
          .map((element) => `    ${element}`)
          .join("\n")}`,
    )
    .join("\n\n")

  throw new Error(
    `Found ${violations.length} accessibility violations:\n\n${summary}\n`,
  )
}

/**
 * Waits until the browser has finished painting.
 *
 * axe reads computed style. Without this pause, axe can read an element
 * that has not yet got its styles.
 *
 * If the element has an `updateComplete`, that is awaited too. None of
 * LO-TEK's components has one since Lit was removed in 0.5.0, but a test can
 * pass it an element from another library.
 */
export async function waitForPaint(element?: Element): Promise<void> {
  const update = (element as { updateComplete?: Promise<unknown> })
    ?.updateComplete
  if (update) await update

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}
