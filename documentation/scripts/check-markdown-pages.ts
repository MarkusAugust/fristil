/**
 * That every page in the documentation also exists as Markdown, and that the
 * Markdown version has what the page has.
 *
 * The files are written by `src/plugins/markdown-pages.mjs` after the build,
 * from the finished HTML. What can go wrong goes wrong silently: a Starlight
 * upgrade that gives the code blocks a new class gives Markdown without code,
 * and a new component in a page can leave raw HTML behind. Nobody looks at
 * the files, so this check is what does.
 *
 * The checks use other means than the rewriter does: regular expressions on
 * the HTML and a simple line reader on the Markdown, not hast and mdast. A
 * bug in one interpretation is then not repeated in the other.
 *
 * Run with: bun documentation/scripts/check-markdown-pages.ts
 * Requires `documentation/dist` to be built.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))

const problems: string[] = []

function htmlPages(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}${entry.name}`
    if (entry.isDirectory()) return htmlPages(`${path}/`)
    return entry.name === "index.html" ? [path] : []
  })
}

/** The number of code blocks in Markdown, fenced with ``` or ~~~. */
function codeBlocks(markdown: string): number {
  let count = 0
  let fence: string | null = null

  for (const line of markdown.split("\n")) {
    const match = /^\s*(`{3,}|~{3,})/.exec(line)
    if (!match) continue

    if (fence === null) {
      fence = match[1]
      count += 1
    } else if (
      match[1][0] === fence[0] &&
      match[1].length >= fence.length &&
      line.trim() === match[1]
    ) {
      fence = null
    }
  }

  return count
}

/** Markdown without code blocks and inline code, where HTML is allowed. */
function withoutCode(markdown: string): string {
  return markdown
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
    .replace(/(`+)[\s\S]*?\1/g, "")
}

const headers = readFileSync(`${DIST}_headers`, "utf8")
let pages = 0

for (const file of htmlPages(DIST)) {
  const html = readFileSync(file, "utf8")
  const page = file.slice(DIST.length - 1).replace(/index\.html$/, "")

  if (!html.includes('class="sl-markdown-content"') || page === "/404/")
    continue

  const link =
    /<link rel="alternate" type="text\/markdown" href="([^"]+)"/.exec(html)
  if (!link) {
    problems.push(`${page} has no Markdown link in the page head`)
    continue
  }

  const address = link[1]
  let markdown: string

  try {
    markdown = readFileSync(`${DIST}${address.slice(1)}`, "utf8")
  } catch {
    problems.push(`${page} links to ${address}, which was not written`)
    continue
  }

  pages += 1

  // Written in the same build as the page, not left over from an older one.
  if (statSync(`${DIST}${address.slice(1)}`).mtimeMs < statSync(file).mtimeMs)
    problems.push(`${address} is older than ${page}`)

  const title = /<h1 id="_top"[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]
  if (title && !markdown.startsWith(`# ${title}\n`))
    problems.push(`${address} does not start with "# ${title}"`)

  /*
   * Every code block on the page must be in the Markdown, no more and no
   * fewer. The previews in `<template>` are not counted: their markup is in
   * the "Plain HTML" tab, which is a code block.
   */
  const content = html
    .slice(html.indexOf('class="sl-markdown-content"'))
    .replace(/<template[\s\S]*?<\/template>/g, "")
  const inPage = (content.match(/<pre[\s>]/g) ?? []).length
  const inMarkdown = codeBlocks(markdown)
  if (inPage !== inMarkdown)
    problems.push(
      `${address} has ${inMarkdown} code blocks, while the page has ${inPage}`,
    )

  /*
   * Raw HTML outside code is a component the rewriter does not know. `<x@y>`
   * and `<https://…>` are Markdown's own links, and `\<` is an angle bracket
   * written as text.
   */
  const rest = withoutCode(markdown).match(
    /(?<!\\)<(?![a-z][\w.+-]*@|https?:)[a-zA-Z][^>\n]{0,40}/g,
  )
  if (rest) problems.push(`${address} has raw HTML left: ${rest.slice(0, 3)}`)

  if (!headers.includes(`${address}\n  Content-Type: text/markdown`))
    problems.push(`${address} has no content type in _headers`)
}

if (pages === 0) problems.push("No pages with a Markdown version were found")

if (problems.length > 0) {
  console.error(
    `The Markdown versions do not match the pages:\n\n${problems
      .map((line) => `  ${line}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `All ${pages} pages exist as Markdown, with the code blocks and without raw HTML.`,
)
