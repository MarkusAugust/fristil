/**
 * Every page also as Markdown, made from the finished HTML.
 *
 * An agent fetching `/components/button/` gets Starlight's HTML, with
 * navigation, highlighting in a thousand `<span>`s and tabs that hide half the
 * content. The Markdown version at `/components/button.md` is the same content
 * without all that.
 *
 * The source is the built page, not the `.mdx` file. That is the whole point.
 * In MDX the markup is in a `code` string passed to `<Example>`, and the
 * "Plain HTML" tab with the `<link>`s to the CDN, the import lines and the
 * version number does not exist there at all: it is computed by the component.
 * A converter that read MDX would have had to do that computation again, and
 * then the rule would exist in two places. Here what the component actually
 * wrote is read, so the Markdown version cannot say anything other than the
 * page.
 *
 * Which pages get a file is decided by `<link rel="alternate"
 * type="text/markdown">` in the page head, which `src/route-data.ts` sets. The
 * file is written where the link points, and nowhere else.
 *
 * What is removed: the live examples (the markup is in the "Plain HTML" tab
 * next to them), the anchor links by the headings, the copy buttons and the
 * tab list. The tabs become paragraphs with the tab name in bold before the
 * content, so all the tabs follow one another.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { select, selectAll } from "hast-util-select"
import { toText } from "hast-util-to-text"
import rehypeParse from "rehype-parse"
import rehypeRemark from "rehype-remark"
import remarkGfm from "remark-gfm"
import remarkStringify from "remark-stringify"
import { unified } from "unified"

const MARKDOWN_LINK = 'link[rel="alternate"][type="text/markdown"]'

/** What is there for the eye or the keyboard, and is not content. */
const NOISE = [
  "script",
  "style",
  "template",
  "svg",
  ".sl-anchor-link",
  ".lt-preview",
  ".copy",
  ".tablist-wrapper",
  ".expressive-code .sr-only",
].join(", ")

const parser = unified().use(rehypeParse)

/*
 * `rehype-remark` takes the language from the class on `<code>`, but not the
 * file name. That goes in `title=` after the language, as Expressive Code
 * itself writes it, so an agent sees which file the block belongs in.
 */
function pre(_state, node) {
  const code = node.children.find((child) => child.tagName === "code") ?? node
  const languageClass = (code.properties?.className ?? []).find((name) =>
    String(name).startsWith("language-"),
  )

  return {
    type: "code",
    lang: languageClass
      ? String(languageClass).slice("language-".length)
      : null,
    meta: code.properties?.dataMeta ?? null,
    value: toText(code, { whitespace: "pre" }).replace(/\n$/, ""),
  }
}

const writer = unified()
  .use(rehypeRemark, { handlers: { pre } })
  .use(remarkGfm, { tablePipeAlign: false })
  .use(remarkStringify, { bullet: "-", fences: true, rule: "-" })

const element = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
})

const text = (value) => ({ type: "text", value })

/** Replaces every element `selector` matches with what `make` returns. */
function replaceMatches(tree, selector, make) {
  for (const old of selectAll(selector, tree)) {
    const replacement = make(old)
    for (const key of Object.keys(old)) delete old[key]
    Object.assign(old, replacement)
  }
}

function remove(tree, selector) {
  const removed = new Set(selectAll(selector, tree))

  const walk = (node) => {
    if (!node.children) return
    node.children = node.children.filter((child) => !removed.has(child))
    for (const child of node.children) walk(child)
  }

  walk(tree)
}

const isEmpty = (node) =>
  !node.children?.some((child) =>
    child.type === "text"
      ? child.value.trim() !== ""
      : child.type === "element",
  )

/**
 * Expressive Code writes each line as a `<div>` with coloured `<span>`s. It is
 * turned back into a plain `<pre><code>` with the language and file name,
 * which the Markdown writer turns into a fenced code block.
 */
function codeBlock(figure) {
  const pre = select("pre", figure)
  const language = pre?.properties.dataLanguage
  const title = toText(select(".title", figure) ?? text("")).trim()
  const lines = selectAll(".ec-line", figure).map((line) =>
    toText(line, { whitespace: "pre" }),
  )

  return element("pre", {}, [
    element(
      "code",
      {
        className: language ? [`language-${language}`] : [],
        dataMeta: title ? `title="${title}"` : undefined,
      },
      [text(lines.join("\n"))],
    ),
  ])
}

/**
 * The tab name of every panel, while the tab list still exists. It is noise
 * and is removed with the rest, but the names are needed when the tabs are
 * laid out one after another.
 */
function markTabs(tree) {
  for (const tabs of selectAll("starlight-tabs", tree)) {
    for (const panel of selectAll('[role="tabpanel"]', tabs)) {
      const tab = select(`[id="${panel.properties.ariaLabelledBy}"]`, tabs)
      panel.properties.dataTab = toText(tab ?? text("")).trim()
    }
  }
}

/** The tabs one after another, each with its name in front. */
function tabList(tabs) {
  const children = []

  for (const panel of selectAll('[role="tabpanel"]', tabs)) {
    if (isEmpty(panel)) continue

    children.push(
      element("p", {}, [
        element("strong", {}, [text(panel.properties.dataTab)]),
      ]),
      ...panel.children,
    )
  }

  return element("div", {}, children)
}

/** A Starlight aside becomes a blockquote with the title in bold. */
function asideToQuote(aside) {
  const content = select(".starlight-aside__content", aside)

  return element("blockquote", {}, [
    element("p", {}, [
      element("strong", {}, [text(aside.properties.ariaLabel)]),
    ]),
    ...(content?.children ?? []),
  ])
}

/**
 * Links to another page that has a Markdown version go there instead. An
 * agent reading Markdown should be able to follow the links without ending up
 * in HTML again.
 *
 * The pages link relatively, as in `../../type-safe-use/`. That is resolved
 * against the page's own address, since the Markdown file sits somewhere else
 * than the page and the same relative path would miss from there.
 */
function links(tree, path, addresses) {
  for (const a of selectAll("a[href]", tree)) {
    const href = String(a.properties.href)
    if (href.startsWith("#")) continue

    const target = new URL(href, `https://lotek${path}`)
    if (target.origin !== "https://lotek") continue

    const md = addresses.get(target.pathname)
    if (md) a.properties.href = `${md}${target.hash}`
  }
}

function toMarkdown(html, path, addresses) {
  const page = parser.parse(html)
  const content = select(".sl-markdown-content", page)
  if (!content) return null

  const title = toText(select("h1", page) ?? text("")).trim()
  const description = select('meta[name="description"]', page)?.properties
    .content

  /*
   * The code blocks first: the copy button and "Terminal window" are inside
   * them, and `codeBlock` takes the lines before they disappear. The tabs
   * last, so a tab that only had a live example is empty when it is
   * considered, and drops out.
   */
  replaceMatches(content, ".expressive-code", codeBlock)
  markTabs(content)
  remove(content, NOISE)
  replaceMatches(content, "aside.starlight-aside", asideToQuote)
  replaceMatches(content, "starlight-tabs", tabList)
  links(content, path, addresses)

  const body = writer
    .stringify(writer.runSync({ type: "root", children: [content] }))
    .trim()

  return [`# ${title}`, description ? `> ${description}` : "", body]
    .filter(Boolean)
    .join("\n\n")
}

/** @returns {import("astro").AstroIntegration} */
export function markdownPages() {
  return {
    name: "lotek:markdown-pages",
    hooks: {
      "astro:build:done": ({ dir, pages, logger }) => {
        const root = fileURLToPath(dir)

        // Every page that has a Markdown version, and where it is to go.
        const entries = []
        for (const { pathname } of pages) {
          const file = `${root}${pathname}index.html`.replace(/\/\/+/g, "/")
          let html
          try {
            html = readFileSync(file, "utf8")
          } catch {
            continue
          }

          const link = select(MARKDOWN_LINK, parser.parse(html))
          if (link)
            entries.push({
              path: `/${pathname}`,
              html,
              md: link.properties.href,
            })
        }

        const addresses = new Map(entries.map(({ path, md }) => [path, md]))
        const headers = []

        for (const { path, html, md } of entries) {
          const markdown = toMarkdown(html, path, addresses)
          if (markdown === null) {
            throw new Error(`${path} has a Markdown link, but no content`)
          }

          writeFileSync(`${root}${md.slice(1)}`, `${markdown}\n`)
          headers.push(`${md}\n  Content-Type: text/markdown; charset=utf-8`)
        }

        /*
         * The content type per file, for the same reason as for the rulebooks
         * in `public/_headers`. Each file is listed at its own address, so
         * nothing depends on how Netlify reads a wildcard in the middle of a
         * file name, and the list is made from the files actually written.
         */
        const headerFile = `${root}_headers`
        writeFileSync(
          headerFile,
          `${readFileSync(headerFile, "utf8").trimEnd()}\n\n# The Markdown versions of the pages, written by src/plugins/markdown-pages.mjs.\n${headers.join("\n")}\n`,
        )

        logger.info(`${entries.length} pages written as Markdown.`)
      },
    },
  }
}
