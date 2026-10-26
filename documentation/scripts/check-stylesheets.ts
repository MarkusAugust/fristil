/**
 * That every page loads the stylesheets its markup in plain DOM actually
 * needs.
 *
 * `astro.config.mjs` once listed all 42 component stylesheets in `customCss`,
 * and then the question was uninteresting: every page had everything. Now
 * `global.css`, `tokens.css` and `button.css` are there, because the live
 * examples sit in a shadow root and `Preview.astro` adds its own stylesheets
 * with `?inline`. That makes two bugs possible. If someone writes LO-TEK
 * markup straight into the body text, or in a component outside a preview,
 * it stands unstyled. And Vite stops writing a stylesheet at all once it
 * loses its importers: `button.css` vanished from the build when it was
 * taken out of `customCss`, and `src/pages/demo/page-skeleton.astro`, which
 * imports it itself, came out with unstyled buttons. Neither tells you. The
 * page just looks slightly wrong.
 *
 * This guard reads every built page, finds the `lt-` classes and `<lt-…>`
 * elements in plain DOM, and requires one of the stylesheets the page links
 * to to define them.
 *
 * Four things are left out, and all four are markup that looks real without
 * being it: the content of `<template>` (the shadow roots, which have their
 * own styles), the content of `<pre>` and `<code>` (code on display, not code
 * that runs), the `data-code` attribute (the source text Expressive Code puts
 * on the copy button) and `<script>` bodies.
 *
 * Run with: bun documentation/scripts/check-stylesheets.ts
 * Requires `documentation/dist` to be built.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const DIST = `${ROOT}documentation/dist/`

/**
 * The classes on a host element for a shadow root.
 *
 * `.lt-preview` is the only one today. It has no rule in any stylesheet, and
 * should not have one: `Preview.astro` styles the host with `:host` inside
 * its shadow root. The rule is stated as what it is, rather than as an
 * exception on the name, so that a new preview component is covered by the
 * same reasoning and an ordinary class never slips through by accident.
 *
 * The set applies to the whole page, not to the single element. If the same
 * class stood both on a host and on an ordinary element on the same page,
 * the ordinary one would slip through. That does not happen today, and is
 * noted rather than coded around, because a precise version would have to
 * find its host in a string search and would be easier to get wrong than the
 * rule it enforces.
 */
function shadowHosts(html: string): Set<string> {
  const names = new Set<string>()
  for (const match of html.matchAll(
    /<[a-z]+[^>]*\sclass="([^"]*)"[^>]*>\s*<template shadowrootmode=/g,
  )) {
    for (const word of match[1].split(/\s+/)) {
      if (word.startsWith("lt-")) names.add(word)
    }
  }
  return names
}

/** The markup the browser actually builds in plain DOM. */
function plainDom(html: string): string {
  let out = ""
  let i = 0

  // `<template>` is the shadow roots of the previews, and any other template
  // content. They have their own styles, added by Preview.astro.
  while (true) {
    const start = html.slice(i).search(/<template[^>]*>/)
    if (start === -1) {
      out += html.slice(i)
      break
    }
    const from = i + start
    const to = html.indexOf("</template>", from)
    if (to === -1) {
      out += html.slice(i)
      break
    }
    out += html.slice(i, from)
    i = to + "</template>".length
  }

  return (
    out
      /*
       * The source text Expressive Code puts on its copy button. It looks
       * like markup and is not: an `<lt-field>` in there is text in an
       * attribute and never becomes an element. Without this line the guard
       * reports every single component page for markup no browser builds.
       */
      .replace(/data-code="[^"]*"/g, "")
      // Code on display. An `<lt-field>` in a code fence is an illustration.
      .replace(/<pre[\s>][\s\S]*?<\/pre>/g, "<pre></pre>")
      .replace(/<code[\s>][\s\S]*?<\/code>/g, "<code></code>")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
  )
}

/**
 * Whether a stylesheet actually defines this name.
 *
 * A plain substring search is too loose: `.lt-field` would be true because
 * of `.lt-fieldset`, and a page with `<lt-field>` without `field.css` would
 * slip through. The name must therefore be followed by something that ends
 * it in a selector.
 */
function defines(css: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`${escaped}(?![a-zA-Z0-9_-])`).test(css)
}

/**
 * All the CSS the page actually has: both what it links to and what is
 * inline.
 *
 * Astro inlines a stylesheet that is small enough, rather than linking it.
 * If we read only `<link>`, the check reported `.lt-sr-only` as missing on a
 * page where the rule stood in a `<style>` a few lines above. That is a
 * blind spot that gives false failures, and it moved with how big the
 * bundles became, that is, without anyone having touched the page.
 *
 * It must read `plainDom(html)` and not raw HTML. `Preview.astro` puts each
 * example's stylesheets in a `<style>` inside `<template
 * shadowrootmode="open">`, and they belong to the shadow root, not to the
 * page. If we read them too, an `.lt-button` written straight into the body
 * text on the button page would pass, because the preview on the same page
 * has all of `button.css` in its shadow styles. That is one of the two bugs
 * this file exists for.
 */
function stylesheetsFor(html: string, page: string): string {
  const paths = [...html.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g)]
    .filter((match) => match[0].includes('rel="stylesheet"'))
    .map((match) => match[1])

  let combined = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join("\n")
  for (const path of paths) {
    try {
      combined += readFileSync(DIST + path.replace(/^\//, ""), "utf8")
    } catch {
      findings.push(`${page}: links to ${path}, which does not exist in dist`)
    }
  }
  return combined
}

const findings: string[] = []

/*
 * The expected set does not come from the same glob as the queue.
 *
 * If we only count "did I visit everything the glob found", the guard
 * checks itself, and a glob that suddenly matched nothing would report
 * green. The expectation is therefore derived from the source: every page in
 * `src/content/docs` and every `.astro` route in `src/pages` must exist as a
 * built page.
 *
 * It is the addresses that are collected, not the count. A number alone
 * tolerates one page dropping out and another coming in. With the addresses
 * the guard says which page is missing.
 *
 * `404.mdx` is the one document that is not built to its own folder:
 * Starlight writes it as `404.html`.
 */
const expected = new Set<string>()
for (const rel of new Glob(
  "documentation/src/content/docs/**/*.{mdx,md}",
).scanSync(ROOT)) {
  const slug = rel
    .replace("documentation/src/content/docs/", "")
    .replace(/\.mdx?$/, "")
  // `components/index.mdx` is built to `components/index.html`, not to
  // `components/index/index.html`: the file is the folder's own index.
  expected.add(
    slug.endsWith("/index") || slug === "index" || slug === "404"
      ? `${slug}.html`
      : `${slug}/index.html`,
  )
}
for (const rel of new Glob("documentation/src/pages/**/*.astro").scanSync(
  ROOT,
)) {
  const route = rel
    .replace("documentation/src/pages/", "")
    .replace(/\.astro$/, "")
  expected.add(route === "index" ? "index.html" : `${route}/index.html`)
}

const visited = new Set<string>()
let checkedPages = 0
let checkedNames = 0

for (const rel of new Glob("**/*.html").scanSync(DIST)) {
  const html = readFileSync(DIST + rel, "utf8")
  const dom = plainDom(html)
  const hosts = shadowHosts(html)

  const classes = new Set<string>()
  for (const match of dom.matchAll(/class="([^"]*)"/g)) {
    for (const word of match[1].split(/\s+/)) {
      if (word.startsWith("lt-") && !hosts.has(word)) classes.add(word)
    }
  }

  const elements = new Set<string>()
  for (const match of dom.matchAll(/<(lt-[a-z-]+)[\s>/]/g)) {
    elements.add(match[1].toLowerCase())
  }

  if (classes.size > 0 || elements.size > 0) {
    const css = stylesheetsFor(dom, rel)

    for (const className of classes) {
      checkedNames++
      if (!defines(css, `.${className}`)) {
        findings.push(
          `${rel}: uses .${className} without any stylesheet on the page having it`,
        )
      }
    }

    for (const element of elements) {
      checkedNames++
      if (!defines(css, element)) {
        findings.push(
          `${rel}: uses <${element}> without any stylesheet on the page having it`,
        )
      }
    }
  }

  visited.add(rel)
  checkedPages++
}

for (const line of findings) console.error(`  ${line}`)

console.log(
  `Checked ${checkedPages} built pages and ${checkedNames} names in plain DOM.`,
)

/*
 * The guard sits at the bottom, after the report, and requires both that
 * the number is greater than zero and that it covers the source. A run that
 * looked at nothing must not be able to look like one that looked at
 * everything.
 */
if (checkedPages === 0) {
  console.error("The guard saw no built pages. Is `dist` built?")
  process.exit(1)
}

if (checkedNames === 0) {
  console.error(
    "The guard found no LO-TEK markup in plain DOM anywhere. There has " +
      "always been some, so it is probably the filter in `plainDom` that has " +
      "started eating too much, not the pages that have become clean.",
  )
  process.exit(1)
}

const missing = [...expected].filter((address) => !visited.has(address))
if (missing.length > 0) {
  console.error(
    `${missing.length} pages exist in the source and not in the build, among them ` +
      `${missing.slice(0, 3).join(", ")}. The build is incomplete, and then ` +
      "the guard has not looked at what it was meant to.",
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error(
    `${findings.length} places are missing their stylesheet. Import it in the component ` +
      "or page that writes the markup, as `src/pages/index.astro` does.",
  )
  process.exit(1)
}

console.log("Every page has the stylesheets its markup needs.")
