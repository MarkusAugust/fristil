/**
 * The search the model tests share: every sequence of server updates and
 * user actions, to a fixed depth, with invariants checked after each step.
 *
 * A model test does not choose its cases. It names what the server can send
 * and what the user can do, and the search tries them in every order. Two
 * searches:
 *
 * - over states, in every engine: a state is the page as the browser
 *   rendered it, which node each element is, and the test's own context,
 *   such as the version the server sent last. Two paths to the same state
 *   are continued once;
 * - over sequences, without merging, in Chromium: what a component remembers
 *   that is not in the page only shows on a path.
 *
 * The page after a path is always replayed from the recipe: a component's
 * memory cannot be copied. Nothing here knows a component; each test brings
 * its steps, its snapshot and its invariants.
 */
import { mount } from "./a11y"
import { renderedMarkup } from "./rendered"

export type Model<Step, Snapshot, Context> = {
  /** The markup the page starts from, mounted before every replay. */
  recipe: string
  steps: Step[]
  /** Does the step. May wait, as a key press through Playwright does. */
  apply(step: Step): void | Promise<void>
  label(step: Step): string
  /** What the invariants compare, read after the page has settled. */
  snapshot(): Snapshot
  /** The test's context, such as the version shown, and how a step changes it. */
  initial: Context
  next(context: Context, step: Step): Context
  /** Part of the state key: what of the context decides what comes next. */
  contextKey(context: Context): string
  violations(
    before: Snapshot,
    after: Snapshot,
    step: Step,
    was: Context,
    now: Context,
  ): string[]
  /** How often each invariant had something to check; all must end above zero. */
  seen: Record<string, number>
  /** Waits for what the component does after a step. Defaults to [settle]. */
  settle?: () => Promise<void>
  /** Runs before every replay, such as installing a fake clock. */
  reset?: () => void | Promise<void>
}

/**
 * The observers and the component's microtasks, and the task after them.
 * Nothing that waits for a frame is read: the facts are read with
 * `getComputedStyle`, which lays out.
 */
export const settle = () =>
  new Promise<void>((done) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => done()
    channel.port2.postMessage(null)
  })

/**
 * Which node each element is: a number given the first time a replay sees
 * it. A morph that keeps a node and one that replaces it can leave the same
 * markup, so the key holds the numbers too.
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

async function replay<S, N, C>(model: Model<S, N, C>, path: S[]): Promise<C> {
  const wait = model.settle ?? settle
  serials = new WeakMap()
  nextSerial = 0
  await model.reset?.()
  mount(model.recipe)
  await wait()
  identities()
  let context = model.initial
  for (const step of path) {
    await model.apply(step)
    await wait()
    identities()
    context = model.next(context, step)
  }
  return context
}

const key = <S, N, C>(model: Model<S, N, C>, context: C) =>
  `${model.contextKey(context)}\n${identities()}\n${renderedMarkup()}`

/** One step from a replayed path, with its invariants. */
async function step<S, N, C>(
  model: Model<S, N, C>,
  path: S[],
  context: C,
  s: S,
  found: string[],
): Promise<C> {
  const before = model.snapshot()
  await model.apply(s)
  await (model.settle ?? settle)()
  const now = model.next(context, s)
  const after = model.snapshot()
  for (const p of model.violations(before, after, s, context, now))
    found.push(`${[...path, s].map(model.label).join(" → ")}: ${p}`)
  return now
}

/** Every state to `depth`, each continued with every step once. */
export async function exploreStates<S, N, C>(
  model: Model<S, N, C>,
  depth: number,
): Promise<{
  found: string[]
  transitions: number
  states: number
  continued: number
}> {
  const found: string[] = []
  await replay(model, [])
  const known = new Set([key(model, model.initial)])
  let frontier: { path: S[] }[] = [{ path: [] }]
  let transitions = 0
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: { path: S[] }[] = []
    for (const state of frontier)
      for (const s of model.steps) {
        const context = await replay(model, state.path)
        const now = await step(model, state.path, context, s, found)
        transitions++
        const k = key(model, now)
        if (!known.has(k)) {
          known.add(k)
          next.push({ path: [...state.path, s] })
        }
      }
    frontier = next
  }
  return {
    found,
    transitions,
    states: known.size,
    continued: known.size - frontier.length,
  }
}

/** Every sequence of `steps` to `depth`, without merging. */
export async function exploreSequences<S, N, C>(
  model: Model<S, N, C>,
  depth: number,
  steps: S[] = model.steps,
): Promise<{ found: string[]; ran: number }> {
  const found: string[] = []
  let ran = 0
  const sequences = function* (d: number): Generator<S[]> {
    if (d === 0) {
      yield []
      return
    }
    for (const head of sequences(d - 1))
      for (const s of steps) yield [...head, s]
  }
  for (const sequence of sequences(depth)) {
    let context = await replay(model, [])
    for (const [i, s] of sequence.entries())
      context = await step(model, sequence.slice(0, i), context, s, found)
    ran++
  }
  return { found, ran }
}

/**
 * The element as markup with each element's attributes in name order.
 * Attribute order means nothing in HTML, and a component that writes an
 * attribute back after a morph removed it puts it last: comparing
 * `outerHTML` reported that as a change.
 */
export function canonical(element: Element | null | undefined): string {
  if (!element) return ""
  const copy = element.cloneNode(true) as Element
  for (const e of [copy, ...copy.querySelectorAll("*")]) {
    const attributes = [...e.attributes]
      .map((a) => [a.name, a.value] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    for (const [name] of attributes) e.removeAttribute(name)
    for (const [name, value] of attributes) e.setAttribute(name, value)
  }
  return copy.outerHTML
}

/** The invariants that never had anything to check. */
export const unchecked = (seen: Record<string, number>) =>
  Object.entries(seen)
    .filter(([, n]) => n === 0)
    .map(([name]) => name)
