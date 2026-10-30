/// <reference path="../../../types/css.d.ts" />
/// <reference path="../../../testing/vite-url.d.ts" />

/**
 * Every sequence of server updates and user actions, to a fixed depth, with
 * the screen reader's view checked after each step.
 *
 * The scenario tests next to this one were each written by someone who
 * thought of the case. This one does not choose: the server can send any of
 * the versions below, by any of the three ways an update arrives, and the
 * user can move into a field, in any order. After every step the page as the
 * browser rendered it goes to the core, which computes the accessibility
 * tree from the specifications, and the invariants are checked on that tree,
 * not on attributes.
 *
 * Nothing here is a second implementation: the page is the recipe from the
 * component page, the component is the real one, and so are Datastar and
 * idiomorph. The core's tree is compared with what Chromium and Firefox give
 * through AT-SPI on every contract step in `check-accessibility-tree.ts`.
 */

import { beforeAll, describe, expect, it } from "vitest"
import { server } from "vitest/browser"
import page from "../../../../../documentation/src/content/docs/components/error-summary.mdx?raw"
import coreUrl from "../../../../core/lotek-core.wasm?url"
import { mount } from "../../../testing/a11y"
import {
  type AccessibilityCore,
  type AxNode,
  accessibilityCore,
} from "../../../testing/accessibility"
import { attr } from "../../../testing/markup"
import { htmlBlocks, tabItems } from "../../../testing/recipes"
import { renderedMarkup } from "../../../testing/rendered"
import { replace, WAYS, type Way } from "../../../testing/update"
import { errorSummary } from "./error-summary"
import { defineLtErrorSummary } from "./lt-error-summary"

import "../../../tokens/tokens.css"
import "./error-summary.css"

/** The form in the "Plain HTML" recipe, without its scripts. */
const RECIPE = (() => {
  const block = tabItems(page)
    .filter((t) => t.name === "Plain HTML")
    .flatMap((t) => htmlBlocks(t.code))
    .find((b) => b.includes("<lt-error-summary"))
  if (!block) throw new Error("no recipe with <lt-error-summary> on the page")
  return block.replace(/<script[\s\S]*?<\/script>/g, "")
})()

/** The recipe's box: hidden and empty, as the server sends it before a submission. */
const BOX = RECIPE.match(/<lt-error-summary[\s\S]*?<\/lt-error-summary>/)?.[0]
if (!BOX) throw new Error("no <lt-error-summary> in the recipe")

const LINKS = `<li><a href="#email">Enter an email address with an @</a></li>`

/** The recipe's box, shown, with a heading and the list filled in. */
const filled = (heading: string, extra = "") =>
  BOX.replace(" hidden", extra)
    .replace("<h2></h2>", `<h2>${heading}</h2>`)
    .replace('<ul class="lt-list"></ul>', `<ul class="lt-list">${LINKS}</ul>`)

const BUILT = errorSummary({ count: 1, id: "errors", titleId: "server-title" })

/** What the server can send, and the name the alert must then have. */
const VERSIONS: Record<string, { html: string; name: string | null }> = {
  hidden: { html: BOX, name: null },
  filled: { html: filled("There is 1 problem"), name: "There is 1 problem" },
  builder: {
    html: `<lt-error-summary ${attr(BUILT.host)}><h2 ${attr(BUILT.title)}>There is 1 problem</h2><ul class="lt-list">${LINKS}</ul></lt-error-summary>`,
    name: "There is 1 problem",
  },
  heading: {
    html: filled("Check the email address"),
    name: "Check the email address",
  },
  outside: {
    html: BOX.replace(" hidden", ' aria-labelledby="later-title"')
      .replace("<h2></h2>", "<h2>There is 1 problem</h2>")
      .replace(
        '<ul class="lt-list"></ul>',
        `<ul class="lt-list">${LINKS}</ul>`,
      ),
    name: "There is 1 problem",
  },
  named: {
    html: filled(
      "There is 1 problem",
      ' aria-label="Problems in the application"',
    ),
    name: "Problems in the application",
  },
}

type Step = { send: string; way: Way } | { focus: "email" }

const STEPS: Step[] = [
  ...Object.keys(VERSIONS).flatMap((send) =>
    WAYS.map((way) => ({ send, way })),
  ),
  { focus: "email" },
]

function apply(step: Step): void {
  if ("focus" in step) document.getElementById(step.focus)?.focus()
  else replace(step.way, "errors", VERSIONS[step.send].html)
}

/**
 * The observers and the component's microtasks, and the task after them.
 * Nothing the invariants read waits for a frame: focus moves in a
 * microtask, and the facts are read with `getComputedStyle`, which lays out.
 */
const settle = () =>
  new Promise<void>((done) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => done()
    channel.port2.postMessage(null)
  })

const label = (step: Step) =>
  "focus" in step ? "focus the email field" : `${step.send} by ${step.way}`

let core: AccessibilityCore

/** The screen reader's view of the page now, from the core. */
const tree = () => core.tree(renderedMarkup())

/** How often each invariant actually had something to check. */
const seen = { alert: 0, appeared: 0, server: 0, kept: 0 }

function violations(
  before: AxNode[],
  now: AxNode[],
  step: Step,
  shown: string,
): string[] {
  const problems: string[] = []
  const alerts = now.filter((n) => n.role === "alert")
  // The version the server sent decides whether there is an alert, not the
  // box's attributes, so a component that keeps the box hidden fails here.
  if (VERSIONS[shown].name === null) {
    if (alerts.length > 0)
      problems.push("an alert after the server hid the box")
  } else if (alerts.length !== 1) {
    problems.push(`${alerts.length} alerts, not one`)
  } else {
    seen.alert++
    /*
     * The box takes focus, and without a name a screen reader says only
     * "alert". The name is what the box shows: the server's `aria-label`,
     * otherwise its heading. Not what the server sent: idiomorph leaves the
     * content of the element that has focus as it was, and then the screen
     * shows the old heading too.
     */
    const box = document.getElementById("errors")
    const shownName =
      box?.getAttribute("aria-label")?.trim() ||
      box?.querySelector("h2")?.textContent?.trim() ||
      ""
    // "outside" is a server error by design: the box is named after an
    // element that never comes. The component may repair it with a heading
    // that has no id or its own, never take over one the server wrote, so
    // no name is required here; no two elements sharing an id is, below.
    if (shown === "outside") {
    } else if (alerts[0].name === "") problems.push("the alert has no name")
    else if (alerts[0].name !== shownName)
      problems.push(
        `the alert is named "${alerts[0].name}", but the box shows "${shownName}"`,
      )
  }
  // The id the heading borrows is never one another element has.
  const ids = [...document.querySelectorAll("[id]")].map((e) => e.id)
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (twice.length > 0) problems.push(`two elements have the id "${twice[0]}"`)
  // The server's wiring is the server's word.
  if ("send" in step && step.send === "builder") {
    seen.server++
    const box = document.getElementById("errors")
    if (box?.getAttribute("aria-labelledby") !== "server-title")
      problems.push(
        `aria-labelledby is "${box?.getAttribute("aria-labelledby")}", not the server's "server-title"`,
      )
  }
  const hadAlert = before.some((n) => n.role === "alert")
  // A box that appears takes focus, so the user hears the submission stopped.
  if (!hadAlert && alerts.length === 1) {
    seen.appeared++
    if (!alerts[0].states.includes("focused"))
      problems.push("the box appeared without taking focus")
  }
  /*
   * An update that keeps the box never takes focus from the field. A plain
   * `outerHTML` replaces it with a new box, which takes focus as a new
   * message: the component cannot tell that from a new submission, and the
   * page says to turn it off with `data-autofocus="false"` for live
   * validation.
   */
  const inField = (t: AxNode[]) =>
    t.some((n) => n.role === "textbox" && n.states.includes("focused"))
  if (
    "send" in step &&
    step.way !== "innerHTML" &&
    hadAlert &&
    inField(before)
  ) {
    seen.kept++
    if (!inField(now)) problems.push("an update took focus from the field")
  }
  return problems
}

/**
 * Which node each element is: a number given the first time a replay sees
 * it. A morph that keeps a node and one that replaces it can leave the same
 * markup, and the component's memory hangs on the node (the id it wrote on
 * a heading), so the key holds the numbers too.
 */
let serials = new WeakMap<Element, number>()
let nextSerial = 0
function identities(): string {
  return [...document.querySelectorAll("#lt-test-surface *")]
    .map((e) => {
      let n = serials.get(e)
      if (n === undefined) {
        n = nextSerial++
        serials.set(e, n)
      }
      return n
    })
    .join(",")
}

/**
 * A state, by what decides what comes next: the page as the browser
 * rendered it, with the ids the component makes up at random written the
 * same, which node each element is, and the version the server sent last.
 * Two paths that lead to the same state are continued once. The
 * component's memory that is in neither (whether it has moved focus) is not
 * in the key; the mutation tests show that the errors the search exists
 * for are still found.
 */
const key = (shown: string) =>
  `${shown}\n${identities()}\n${renderedMarkup().replace(/(lt-[a-z-]+)-[a-z0-9]{7}(?=["\s])/g, "$1-*")}`

type State = { path: Step[]; shown: string; tree: AxNode[] }

/** The page after `path`, from the recipe: the component's memory cannot be copied, only replayed. */
async function replay(path: Step[]): Promise<void> {
  serials = new WeakMap()
  nextSerial = 0
  mount(RECIPE)
  await settle()
  identities()
  for (const step of path) {
    apply(step)
    await settle()
    identities()
  }
}

describe("lt-error-summary, every sequence of updates", () => {
  beforeAll(async () => {
    defineLtErrorSummary()
    core = accessibilityCore(await (await fetch(coreUrl)).arrayBuffer())
  })

  it("writes exactly the facts the core requires", async () => {
    mount(RECIPE)
    await settle()
    const written = new Set(
      [...renderedMarkup().matchAll(/\s(data-lt-ax-[a-z]+)=/g)].map(
        (m) => m[1],
      ),
    )
    // `checked`, `mixed`, `modal` and `disabled` only appear where they hold.
    const always = core.facts.filter(
      (f) => !/-(focused|checked|mixed|modal|disabled)$/.test(f),
    )
    for (const fact of always) expect(written).toContain(fact)
    for (const fact of written) expect(core.facts).toContain(fact)
  })

  it("keeps one named alert, the server's wiring and the user's focus, in every state to depth 3", async () => {
    const DEPTH = 3
    const found: string[] = []
    await replay([])
    const known = new Set([key("hidden")])
    let frontier: State[] = [{ path: [], shown: "hidden", tree: tree() }]
    let transitions = 0
    for (let depth = 0; depth < DEPTH && frontier.length > 0; depth++) {
      const next: State[] = []
      for (const state of frontier)
        for (const step of STEPS) {
          await replay(state.path)
          apply(step)
          await settle()
          transitions++
          const shown = "send" in step ? step.send : state.shown
          const now = tree()
          const path = [...state.path, step]
          for (const p of violations(state.tree, now, step, shown))
            found.push(`${path.map(label).join(" → ")}: ${p}`)
          const k = key(shown)
          if (!known.has(k)) {
            known.add(k)
            next.push({ path, shown, tree: now })
          }
        }
      frontier = next
    }
    expect(found.slice(0, 10)).toEqual([])
    // Every state found was continued with every step, and there were some.
    expect(transitions).toBe((known.size - frontier.length) * STEPS.length)
    expect(known.size).toBeGreaterThan(STEPS.length)
    // Each invariant had something to check, so none can pass in silence.
    for (const [name, count] of Object.entries(seen))
      expect(
        count,
        `the invariant "${name}" never had anything to check`,
      ).toBeGreaterThan(0)
  }, 600_000)

  /*
   * Every sequence, without merging states: the component's memory that is
   * not in the page (the name it wrote last) only shows on a path, and the
   * state search above merges two paths that differ only there. Seen with
   * the mutation that drops the memory: the search over states passed it,
   * this one did not. Chromium only, because it takes the time the state
   * search saves, and the memory is the component's, not the engine's.
   */
  it.runIf(server.browser === "chromium")(
    "keeps the same invariants on every sequence to depth 3",
    async () => {
      const DEPTH = 3
      let ran = 0
      const found: string[] = []
      const sequences = function* (depth: number): Generator<Step[]> {
        if (depth === 0) {
          yield []
          return
        }
        for (const head of sequences(depth - 1))
          for (const step of STEPS) yield [...head, step]
      }
      for (const sequence of sequences(DEPTH)) {
        await replay([])
        let before = tree()
        let shown = "hidden"
        for (const [i, step] of sequence.entries()) {
          apply(step)
          await settle()
          if ("send" in step) shown = step.send
          const now = tree()
          for (const p of violations(before, now, step, shown))
            found.push(
              `${sequence
                .slice(0, i + 1)
                .map(label)
                .join(" → ")}: ${p}`,
            )
          before = now
        }
        ran++
      }
      expect(found.slice(0, 10)).toEqual([])
      expect(ran).toBe(STEPS.length ** DEPTH)
    },
    600_000,
  )
})
