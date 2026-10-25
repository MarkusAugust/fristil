/**
 * Checks that no page scrolls sideways on a mobile screen.
 *
 * The site was built for large screens first: the heading broke mid-word,
 * the menu at the top stuck out, and the cards on the front page were wider
 * than the phone. It is easy to reintroduce, since nothing tells you in an
 * ordinary development window.
 *
 * The first check is the one the user notices: can the page actually be
 * dragged sideways? `scrollWidth` alone is misleading, because a code block
 * clipped by `overflow: hidden` counts there without anything being
 * scrollable.
 *
 * The second is content that sticks out of the screen without making the
 * page draggable, because something further out clips it. It does not show
 * as a scrollbar, but the text is gone. The "Remove <file name>" button in
 * the file upload was exactly this. The previews live in shadow roots, so
 * the check has to go into them to see it.
 *
 * Run with: bun run test:docs (build first)
 */

import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))
const PORT = 4179
/** iPhone SE, the narrowest screen worth taking into account. */
const WIDTH = 375

/*
 * Every built HTML file, not just the ones named `index.html`.
 *
 * The glob took only `index.html`, and that made the guard at the bottom
 * blind: it compared the number of pages visited with the number of matches
 * from the same glob, so everything the glob did not find was invisible to
 * both. `dist/404.html` was therefore never visited by any of the checks,
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
 * process on IPv6 loopback then takes the port without anything throwing:
 * two servers, same port number, no error message. `localhost` resolves
 * IPv6 first on macOS, so the check talked to the other process. It
 * happened: a completely different website was on 4173, and the check read
 * accessibility violations on it. It could just as well have reported green
 * without having seen a single one of our pages.
 *
 * With the hostname set, a second binding on the same address throws, and
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

const browser = await chromium.launch()

type Finding = { page: string; scrolled: number; culprit: string }
const findings: Finding[] = []

/*
 * A number from the environment must be validated, or it can switch the
 * check off.
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
 * The pages are split across several tabs, because the check waits rather
 * than computes.
 *
 * With one tab the 59 pages took 32 seconds, and only 5 seconds of that was
 * CPU time: 19 per cent of one core. The rest was waiting for
 * `networkidle`. That is why it scales past the core count, and why the
 * number is eight and not four: 32 s with one tab, 8.7 with four, 5.0 with
 * eight, 4.3 with twelve. After eight there is little left to gain.
 */
const PARALLEL = readCount("PAGES_IN_PARALLEL", 8)

const queue = findPages()
let next = 0
let checked = 0

async function checkPages() {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 800 },
  })
  const page = await context.newPage()

  while (true) {
    // `next++` is safe without a lock: JavaScript runs one thing at a time,
    // and there is no `await` between the read and the increment here.
    const url = queue[next++]
    if (url === undefined) break

    /*
     * The status code must be read. `goto` does not throw on 404.
     *
     * The server above answers "Not found" with status 404 for a path it
     * does not have. Without this check, a page that was not served would
     * count as visited: axe finds nothing on a line of plain text, and the
     * mobile check finds nothing sticking out. The guard at the bottom would
     * not have caught it either, since the page did pass through the queue.
     */
    const response = await page.goto(`http://127.0.0.1:${PORT}${url}`, {
      waitUntil: "networkidle",
    })
    if (!response?.ok()) {
      throw new Error(
        `${url} answered ${response?.status() ?? "nothing"}. The check would otherwise have reported the page as passing without having seen it.`,
      )
    }

    const result = await page.evaluate((width) => {
      /*
       * `behavior: "instant"`, or we always read 0.
       *
       * Starlight sets `scroll-behavior: smooth` on `<html>`, so a plain
       * `scrollTo` is animated and `window.scrollX` on the next line is
       * still 0. This check was therefore dead on every single page, and it
       * is the only one of the two that covers `body` itself and
       * pseudo-elements, since `collect(document.body)` only collects
       * descendants. A page with a wide `body::after` could be dragged 375
       * pixels sideways and reported green.
       */
      window.scrollTo({ left: width, behavior: "instant" })
      const scrolled = window.scrollX
      window.scrollTo({ left: 0, behavior: "instant" })

      // Every element, including those inside a shadow root.
      const all: HTMLElement[] = []
      const collect = (root: ParentNode) => {
        for (const element of root.querySelectorAll<HTMLElement>("*")) {
          all.push(element)
          if (element.shadowRoot) collect(element.shadowRoot)
        }
      }
      collect(document.body)

      // What sticks out and is not inside something that can scroll on its
      // own. A code block and a wide table have their own scrollbar, and are
      // therefore fine. `hidden` and `clip` do not count: they clip without
      // giving any way to the content, and are exactly the bug we are
      // looking for.
      const outside: string[] = []
      for (const element of all) {
        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.right <= width + 1) continue

        let parent = element.parentElement
        let ownScroll = false
        while (parent) {
          const overflow = getComputedStyle(parent).overflowX
          if (overflow === "auto" || overflow === "scroll") {
            ownScroll = true
            break
          }
          parent = parent.parentElement
        }
        if (ownScroll) continue

        const className = (element.className || "").toString().split(" ")[0]
        const text = (element.textContent ?? "").trim().slice(0, 30)
        outside.push(
          `${element.tagName.toLowerCase()}${className ? `.${className}` : ""} is ${Math.round(box.width)} pixels wide${text ? ` ("${text}")` : ""}`,
        )
      }

      return {
        scrolled,
        culprit: [...new Set(outside)].slice(0, 3).join("; "),
      }
    }, WIDTH)

    if (result.scrolled > 0 || result.culprit !== "") {
      findings.push({
        page: url,
        scrolled: result.scrolled,
        culprit: result.culprit || "could not find which element",
      })
    }

    // Last in the body, not first. The counter should say how many pages
    // were checked, not how many were taken from the queue: a `continue`
    // added later would otherwise skip the work without the guard noticing.
    checked++
  }

  await context.close()
}

await Promise.all(Array.from({ length: PARALLEL }, () => checkPages()))

await browser.close()
server.stop()

/*
 * Was every page actually visited?
 *
 * The question that matters is whether the work was done. `readCount` only
 * validates how many workers are started, and says nothing about the queue
 * they were meant to empty, so it does not close this.
 *
 * The condition rejects zero pages explicitly, not just unequal numbers:
 * `0 !== 0` is false, so an empty queue would otherwise pass the guard and
 * give a run that reports green without having opened a page.
 *
 * The outcome is decided at the bottom, so that an incomplete run does not
 * hide the pages it did manage to fail.
 */
const incomplete = queue.length === 0 || checked !== queue.length

// The workers finish in random order, so the report is sorted for two runs
// of the same failure to look the same.
findings.sort((a, b) => a.page.localeCompare(b.page))

if (findings.length > 0) {
  console.error(
    `Found ${findings.length} pages with content outside the screen at ${WIDTH} pixels:\n\n` +
      findings
        .map(
          (f) =>
            `  ${f.page}: ${f.scrolled > 0 ? `the page can be dragged ${f.scrolled} pixels sideways. ` : ""}${f.culprit}`,
        )
        .join("\n") +
      "\n",
  )
  if (!incomplete) process.exit(1)
}

if (incomplete) {
  console.error(
    queue.length === 0
      ? `Found no pages in ${DIST}. Has the documentation been built? The check has not looked at anything.`
      : `Checked ${checked} of ${queue.length} pages. The check cannot be trusted.`,
  )
  process.exit(2)
}

console.log(`Everything stays within ${WIDTH} pixels.`)
