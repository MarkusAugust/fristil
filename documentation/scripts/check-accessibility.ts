/**
 * Runs axe against the built documentation site, in both themes.
 *
 * The component tests in `designsystem` run against the components in
 * isolation. That is good, but it does not catch errors that only appear once
 * the components are placed on a page. The documentation for a design system
 * is a product in itself. Light grey body text on a white surface went
 * straight through precisely because nothing tested the built site.
 *
 * Run with: bun run test:docs (build first)
 */

import { readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))
const PORT = 4173
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
const THEMES = ["light", "dark"] as const

type Violation = {
  page: string
  theme: string
  rule: string
  explanation: string
  elements: string[]
}

/*
 * Every built HTML file, not just the ones named `index.html`.
 *
 * The glob took only `index.html`, and that made the guard at the bottom
 * blind: it compared the number of page views visited against the number of
 * matches from the same glob, so anything the glob did not find was invisible
 * to both. `dist/404.html` was therefore never visited by any of the checks,
 * and both reported green.
 *
 * Now every `.html` file is taken, so the queue is the whole set of built
 * pages, and the question the guard asks becomes the one that matters: was
 * every page in `dist` visited?
 */
function findPages(): string[] {
  const pages: string[] = []
  for (const match of new Bun.Glob("**/*.html").scanSync(DIST)) {
    const path = relative(".", match)
    pages.push(
      path === "index.html"
        ? "/"
        : path.endsWith("/index.html")
          ? `/${path.slice(0, -"index.html".length)}`
          : `/${path}`,
    )
  }
  return pages.sort()
}

const MEDIA_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  webp: "image/webp",
  png: "image/png",
  woff2: "font/woff2",
}

/*
 * The server binds 127.0.0.1, and the check connects to the same address.
 *
 * `Bun.serve` without a hostname binds the IPv4 wildcard, and a foreign
 * process on IPv6 loopback then takes the port without anything throwing: two
 * servers, same port number, no error message. `localhost` resolves IPv6
 * first on macOS, so the check talked to the other process. It happened: a
 * completely different website was on 4173, and the check read accessibility
 * violations on it. It could just as well have reported green without having
 * seen a single one of our pages.
 *
 * With the hostname set, a second binding to the same address throws, and
 * that is what we want: a port that is taken should stop the run, not
 * silently send it somewhere else. So never change this back to `localhost`.
 */
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname)
    const filePath = path.endsWith("/")
      ? join(DIST, path, "index.html")
      : join(DIST, path)
    const file = Bun.file(filePath)
    const extension = filePath.split(".").pop() ?? ""
    return file.exists().then((exists) =>
      exists
        ? new Response(file, {
            headers: {
              "content-type":
                MEDIA_TYPES[extension] ?? "application/octet-stream",
            },
          })
        : new Response("Not found", { status: 404 }),
    )
  },
})

const axeSource = readFileSync(
  fileURLToPath(
    new URL("../node_modules/axe-core/axe.min.js", import.meta.url),
  ),
  "utf8",
)

const pages = findPages()
const browser = await chromium.launch()
const violations: Violation[] = []
// Pages where the Expressive Code script had not run after 20 seconds.
// Printed as evidence, but does not fail the check: the access is in the HTML.
const notRun: string[] = []

/*
 * Every code block must have keyboard access in the HTML, before any script
 * runs.
 *
 * `ec-tabindex.mjs` sets `tabindex="0"` and `role="region"` on every `<pre>`
 * Expressive Code renders, and their script removes them where the block
 * fits. If the plugin disappears, the access comes back only from the
 * script, and the only time that failed was in CI, without anyone finding out
 * why. Counted over every built file, and requires the count to be greater
 * than zero.
 */
let codeBlocks = 0
const codeBlocksWithout: string[] = []
for (const file of new Bun.Glob("**/*.html").scanSync(DIST)) {
  const html = readFileSync(join(DIST, file), "utf8")
  for (const [tag] of html.matchAll(/<pre\b[^>]*\bdata-language\b[^>]*>/g)) {
    codeBlocks++
    if (!/\btabindex="0"/.test(tag) || !/\brole="region"/.test(tag)) {
      codeBlocksWithout.push(`${file}: ${tag.slice(0, 80)}`)
    }
  }
}

/*
 * The warnings the components print, collected on every single page.
 *
 * The components speak up with `console.warn` when the markup they got does
 * not hang together. If such a warning appears on our own pages, either an
 * example is wrong, or the warning fires on markup that is fine. A warning
 * that also appears when everything is right gets switched off, and then it
 * is worthless, so both cases must fail the check.
 *
 * Here and not only in `check-component-demos.ts`: this script visits every
 * built page, the pattern pages and the front page included.
 */
const warnings = new Set<string>()

/*
 * A number from the environment must be checked, or it can switch off the
 * check.
 *
 * `Array.from({ length: NaN })` and `{ length: 0 }` both give an empty list,
 * so a value like `0` or `abc` would have started zero workers, checked zero
 * pages and exited with 0. A guard that reports green without having looked
 * at anything is worse than no guard.
 */
function readCount(name: string, fallback: number): number {
  const raw = Bun.env[name]
  if (raw === undefined) return fallback
  const count = Number(raw)
  if (!Number.isInteger(count) || count < 1) {
    console.error(`${name} must be an integer of at least 1, but was "${raw}".`)
    process.exit(2)
  }
  return count
}

/*
 * The pages are shared across several tabs, with one context per theme.
 *
 * The contexts are split by theme and not by worker, and that is what
 * decides whether the rewrite pays off. Two things pull in opposite
 * directions:
 *
 * A context has its own cache. If each worker gets its own, the CSS and the
 * scripts are parsed again for every single page, and CPU time goes from 64
 * to 202 seconds. Then it did not help that four tabs worked at once: the
 * check got slower than with one. So the tabs must share a context.
 *
 * But Starlight writes the theme to `localStorage`, which is shared within a
 * context. If two tabs in the same context loaded a different theme each at
 * the same time, one could overwrite the other. With one context per theme, a
 * context never sees more than one theme, and the hazard does not exist. It
 * is also tighter than the single-tab version, which let the storage
 * alternate between light and dark theme throughout the run.
 *
 * Two tabs per theme gives four in total, which is what the CI machine has in
 * cores. This check is CPU-bound as soon as it runs in parallel, since axe
 * analyses the whole DOM, so more tabs than cores gains nothing. That sets it
 * apart from `check-mobile.ts`, which only waits and therefore gets eight.
 */
const TABS_PER_THEME = readCount("TABS_PER_THEME", 2)

// One queue per theme, so that a worker only takes jobs for its own theme.
const queues = new Map(THEMES.map((theme) => [theme, { next: 0 }]))
let checked = 0

async function checkPages(
  context: Awaited<ReturnType<typeof browser.newContext>>,
  theme: (typeof THEMES)[number],
) {
  const queue = queues.get(theme) as { next: number }
  const page = await context.newPage()

  // The label is local to the worker, not shared by the script. With several
  // tabs, a shared variable would have given the warning the name of whichever
  // page happened to load last. Console events arrive asynchronously.
  let current = ""

  page.on("console", (message) => {
    const type = message.type()
    if (type !== "warning" && type !== "error") return
    warnings.add(`${current}  ${type}: ${message.text()}`)
  })

  while (true) {
    // `queue.next++` is safe without a lock: JavaScript runs one thing at a
    // time, and there is no `await` between the read and the increment.
    const url = pages[queue.next++]
    if (url === undefined) break
    current = `${url} [${theme}]`

    /*
     * The browser must agree with us about the theme.
     *
     * Starlight sets `data-theme` itself, from `localStorage` and otherwise
     * from `prefers-color-scheme`, and the script runs while the page loads.
     * If we only set the attribute afterwards, the two raced: the link colour
     * on `/tailwind/` landed on the light value in half the loads, and the
     * check failed at random on contrast. With `emulateMedia`, Starlight
     * arrives at the same theme, and nobody overwrites anything.
     */
    await page.emulateMedia({ colorScheme: theme })

    /*
     * The status code must be read. `goto` does not throw on 404.
     *
     * The server above answers "Not found" with status 404 for a path it does
     * not have. Without this check, a page that was not served would have
     * counted as visited: axe finds nothing on a line of plain text, and the
     * mobile check finds nothing sticking out. The guard at the bottom would
     * not have caught it either, since the page did go through the queue.
     */
    const response = await page.goto(`http://127.0.0.1:${PORT}${url}`, {
      waitUntil: "networkidle",
    })
    if (!response?.ok()) {
      throw new Error(
        `${url} answered ${response?.status() ?? "nothing"}. Otherwise the check would have reported the page as passing without having seen it.`,
      )
    }
    /*
     * Transitions are switched off BEFORE the theme is set, not after.
     *
     * The worst source of instability is CSS transitions: the links have
     * `transition-colors`, so right after a theme switch axe reads a colour
     * in the middle of the transition. The first version switched them off
     * after the switch, and that is too late: a transition already running
     * does not stop because `transition` is set to `none`, it stays where it
     * was. The probe showed it clearly, with the link colour on `/tailwind/`
     * spread over nine different values in forty loads, and the check failed
     * at random on contrast.
     *
     * With the rule set first, no transition starts at all.
     * An accessibility gate that fails at random gets ignored.
     */
    await page.addStyleTag({
      content: `*, *::before, *::after {
        transition: none !important;
        animation: none !important;
      }`,
    })

    await page.evaluate(
      (t) => document.documentElement.setAttribute("data-theme", t),
      theme,
    )

    const waitedInVain = await page.evaluate(async () => {
      const components = [...document.querySelectorAll("*")].filter(
        (el): el is HTMLElement & { updateComplete: Promise<unknown> } =>
          "updateComplete" in el,
      )
      await Promise.all(components.map((el) => el.updateComplete))

      /*
       * The code blocks get keyboard access from a script, not from the
       * markup. Expressive Code sets `tabindex` on the blocks that can
       * scroll, and does so after the page has been painted. If axe ran
       * before that, it reported "Scrollable region must have keyboard
       * access" on a block that got access a moment later, and the check
       * failed at random.
       *
       * The fonts must also be loaded: the width of the glyphs decides
       * whether the block can scroll at all.
       */
      await document.fonts.ready

      const without = () =>
        [...document.querySelectorAll("pre")].filter(
          (block) =>
            block.scrollWidth > block.clientWidth &&
            !block.hasAttribute("tabindex"),
        )

      /*
       * The deadline is generous, and a timeout is a named failure, not
       * silence. It was three seconds and ran out without a word when the
       * machine was busy, so axe saw the blocks before the script had reached
       * them, and reported nine violations of "Scrollable region must have
       * keyboard access" that were gone on the next run. A condition that
       * switches off a wait is the same as a condition that switches off a
       * check.
       */
      /*
       * A visible block that fits but still has `tabindex` from the HTML
       * means the Expressive Code script has not run yet. That is no fault
       * for the reader, but it is what went wrong in CI once, and then the
       * report should say what was loaded.
       */
      const notCleaned = () =>
        [...document.querySelectorAll(".expressive-code pre")].filter(
          (block) =>
            block.getClientRects().length > 0 &&
            block.scrollWidth <= block.clientWidth &&
            block.hasAttribute("tabindex"),
        )

      const deadline = Date.now() + 20_000
      while (
        (without().length > 0 || notCleaned().length > 0) &&
        Date.now() < deadline
      ) {
        await new Promise((r) => setTimeout(r, 50))
      }
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
      )

      let script: string | null = null
      if (notCleaned().length > 0) {
        const loaded = performance
          .getEntriesByType("resource")
          .filter((e) => /\/_astro\/ec\.[^/]*\.js$/.test(e.name))
          // A request that answered 404 also has an entry here, so the
          // status code must be included. `responseStatus` exists in Chromium.
          .map((e) => {
            const t = e as PerformanceResourceTiming & {
              responseStatus?: number
            }
            return `${e.name.split("/").pop()} answered ${t.responseStatus ?? "unknown"} after ${Math.round(t.responseEnd)} ms`
          })
        const idle = await Promise.race([
          new Promise<string>((r) => {
            const start = performance.now()
            requestIdleCallback(() =>
              r(`ran after ${Math.round(performance.now() - start)} ms`),
            )
          }),
          new Promise<string>((r) =>
            setTimeout(() => r("did not run within 1 s"), 1000),
          ),
        ])
        script =
          `${notCleaned().length} blocks that fit still have tabindex. ` +
          `The script: ${loaded.length > 0 ? loaded.join(", ") : "not loaded"}. ` +
          `requestIdleCallback ${idle}. The page is ${document.visibilityState}.`
      }

      return {
        without: without().map((block) => block.outerHTML.slice(0, 160)),
        script,
      }
    })
    if (waitedInVain.script !== null) {
      notRun.push(`${url} [${theme}]: ${waitedInVain.script}`)
    }
    // A violation with its own name, not a throw: then it appears in the
    // report with the rest, and the guard at the bottom decides the outcome
    // as usual.
    if (waitedInVain.without.length > 0) {
      violations.push({
        page: url,
        theme,
        rule: "waited-in-vain-for-tabindex",
        explanation:
          "Scrollable <pre> without tabindex after 20 seconds. Either the " +
          "Expressive Code script did not run, or the block lacks keyboard access for good.",
        elements: waitedInVain.without,
      })
    }
    await page.addScriptTag({ content: axeSource })

    const findings = await page.evaluate(async (rules) => {
      // biome-ignore lint/suspicious/noExplicitAny: axe is injected into the page context
      const result = await (window as any).axe.run(document, {
        runOnly: { type: "tag", values: rules },
        resultTypes: ["violations"],
      })
      // biome-ignore lint/suspicious/noExplicitAny: axe's own result type
      return result.violations.map((v: any) => ({
        rule: v.id,
        explanation: v.help,
        // biome-ignore lint/suspicious/noExplicitAny: axe's own node type
        elements: v.nodes.map((n: any) => n.html.slice(0, 160)),
      }))
    }, WCAG_AA)

    for (const f of findings) violations.push({ page: url, theme, ...f })

    // Last in the body, not first. The counter should say how many page
    // views were checked, not how many were taken off the queue: a `continue`
    // added later would otherwise skip the work without the guard noticing.
    checked++
  }

  await page.close()
}

await Promise.all(
  THEMES.map(async (theme) => {
    const context = await browser.newContext()
    await Promise.all(
      Array.from({ length: TABS_PER_THEME }, () => checkPages(context, theme)),
    )
    await context.close()
  }),
)

await browser.close()
server.stop()

/*
 * Was every page actually visited, in both themes?
 *
 * The question that matters is whether the work was done. `readCount` only
 * validates how many workers are started, and says nothing about the queue
 * they were meant to empty, so it does not close this.
 *
 * The condition requires zero pages explicitly, and not just that the
 * numbers are equal: `0 !== 0` is false, so an empty queue would otherwise
 * have passed the guard and given a run that reports green without having
 * opened a page.
 *
 * The outcome is decided at the bottom, together with the others. Had we
 * exited here, an incomplete run would have hidden the accessibility report
 * it did manage to produce, and that is the same mistake described just
 * below.
 */
const expected = pages.length * THEMES.length
const incomplete = expected === 0 || checked !== expected

/*
 * The report is sorted, because the workers finish in random order.
 *
 * Without this, two runs of the same failure would give different output, and
 * a report that reshuffles itself is painful to compare between two runs.
 */
violations.sort(
  (a, b) =>
    a.page.localeCompare(b.page) ||
    a.theme.localeCompare(b.theme) ||
    a.rule.localeCompare(b.rule),
)

console.log(`Checked ${checked} page views across ${THEMES.length} themes.`)

if (codeBlocksWithout.length === 0 && codeBlocks > 0) {
  console.log(
    `All ${codeBlocks} code blocks have tabindex and role in the HTML.`,
  )
} else if (codeBlocks === 0) {
  console.log(
    "\n✗ Found no code blocks in the built documentation. Does Expressive Code still render <pre data-language>?",
  )
} else {
  console.log(
    `\n✗ ${codeBlocksWithout.length} of ${codeBlocks} code blocks lack tabindex or role in the HTML. Is ec-tabindex.mjs included in ec.config.mjs?`,
  )
  for (const k of codeBlocksWithout.slice(0, 10)) console.log(`  ${k}`)
}

for (const k of notRun) {
  console.log(`\nThe Expressive Code script had not run: ${k}`)
}

/*
 * Both reports are printed, and then the outcome is decided.
 *
 * The first version exited on the console messages before the axe findings
 * were printed, so a single message hid the whole accessibility report. The
 * developer got "404 Not Found" and no idea that the page also had a
 * violation.
 */
if (violations.length === 0) {
  console.log("✓ No accessibility violations.")
} else {
  for (const v of violations) {
    console.log(`\n${v.page} [${v.theme}]  ${v.rule}`)
    console.log(`  ${v.explanation}`)
    for (const el of v.elements) console.log(`    ${el}`)
  }
  console.log(`\n✗ ${violations.length} accessibility violations.`)
}

if (warnings.size > 0) {
  console.log(`\n✗ ${warnings.size} messages in the console:`)
  for (const w of [...warnings].sort()) console.log(`  ${w}`)
}

if (incomplete) {
  console.error(
    expected === 0
      ? `\n✗ Found no pages in ${DIST}. Has the documentation been built? The check has not looked at anything.`
      : `\n✗ Checked ${checked} of ${expected} page views. The check cannot be trusted.`,
  )
  process.exit(2)
}

process.exit(
  violations.length > 0 ||
    warnings.size > 0 ||
    codeBlocks === 0 ||
    codeBlocksWithout.length > 0
    ? 1
    : 0,
)
