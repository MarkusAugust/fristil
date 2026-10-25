/**
 * Every page also as Markdown, made from the finished HTML.
 *
 * An agent fetching `/components/button/` gets Starlight's HTML, with
 * navigation, highlighting in a thousand `<span>`s and tabs that hide half the
 * content. The Markdown version at `/components/button.md` is the same content
 * without all that.
 *
 * The source is the built page, not the `.mdx` file. That is the whole point.
 * In MDX the markup is in a `kode` string passed to `<Example>`, and the
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

const MARKDOWNLENKE = 'link[rel="alternate"][type="text/markdown"]'

/** What is there for the eye or the keyboard, and is not content. */
const STØY = [
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

const tolk = unified().use(rehypeParse)

/*
 * `rehype-remark` takes the language from the class on `<code>`, but not the
 * file name. That goes in `title=` after the language, as Expressive Code
 * itself writes it, so an agent sees which file the block belongs in.
 */
function pre(_tilstand, node) {
  const kode = node.children.find((barn) => barn.tagName === "code") ?? node
  const klasse = (kode.properties?.className ?? []).find((navn) =>
    String(navn).startsWith("language-"),
  )

  return {
    type: "code",
    lang: klasse ? String(klasse).slice("language-".length) : null,
    meta: kode.properties?.dataMeta ?? null,
    value: toText(kode, { whitespace: "pre" }).replace(/\n$/, ""),
  }
}

const skriv = unified()
  .use(rehypeRemark, { handlers: { pre } })
  .use(remarkGfm, { tablePipeAlign: false })
  .use(remarkStringify, { bullet: "-", fences: true, rule: "-" })

const element = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
})

const tekst = (value) => ({ type: "text", value })

/** Replaces every element `velger` matches with what `lag` returns. */
function bytt(tre, velger, lag) {
  for (const gammel of selectAll(velger, tre)) {
    const ny = lag(gammel)
    for (const nøkkel of Object.keys(gammel)) delete gammel[nøkkel]
    Object.assign(gammel, ny)
  }
}

function fjern(tre, velger) {
  const borte = new Set(selectAll(velger, tre))

  const gå = (node) => {
    if (!node.children) return
    node.children = node.children.filter((barn) => !borte.has(barn))
    for (const barn of node.children) gå(barn)
  }

  gå(tre)
}

const erTom = (node) =>
  !node.children?.some((barn) =>
    barn.type === "text" ? barn.value.trim() !== "" : barn.type === "element",
  )

/**
 * Expressive Code writes each line as a `<div>` with coloured `<span>`s. It is
 * turned back into a plain `<pre><code>` with the language and file name,
 * which the Markdown writer turns into a fenced code block.
 */
function kodeblokk(figur) {
  const pre = select("pre", figur)
  const språk = pre?.properties.dataLanguage
  const tittel = toText(select(".title", figur) ?? tekst("")).trim()
  const linjer = selectAll(".ec-line", figur).map((linje) =>
    toText(linje, { whitespace: "pre" }),
  )

  return element("pre", {}, [
    element(
      "code",
      {
        className: språk ? [`language-${språk}`] : [],
        dataMeta: tittel ? `title="${tittel}"` : undefined,
      },
      [tekst(linjer.join("\n"))],
    ),
  ])
}

/**
 * The tab name of every panel, while the tab list still exists. It is noise
 * and is removed with the rest, but the names are needed when the tabs are
 * laid out one after another.
 */
function merkFaner(tre) {
  for (const tabs of selectAll("starlight-tabs", tre)) {
    for (const panel of selectAll('[role="tabpanel"]', tabs)) {
      const fane = select(`[id="${panel.properties.ariaLabelledBy}"]`, tabs)
      panel.properties.dataFane = toText(fane ?? tekst("")).trim()
    }
  }
}

/** The tabs one after another, each with its name in front. */
function faner(tabs) {
  const barn = []

  for (const panel of selectAll('[role="tabpanel"]', tabs)) {
    if (erTom(panel)) continue

    barn.push(
      element("p", {}, [
        element("strong", {}, [tekst(panel.properties.dataFane)]),
      ]),
      ...panel.children,
    )
  }

  return element("div", {}, barn)
}

/** A Starlight aside becomes a blockquote with the title in bold. */
function merknad(aside) {
  const innhold = select(".starlight-aside__content", aside)

  return element("blockquote", {}, [
    element("p", {}, [
      element("strong", {}, [tekst(aside.properties.ariaLabel)]),
    ]),
    ...(innhold?.children ?? []),
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
function lenker(tre, sti, adresser) {
  for (const a of selectAll("a[href]", tre)) {
    const href = String(a.properties.href)
    if (href.startsWith("#")) continue

    const mål = new URL(href, `https://lotek${sti}`)
    if (mål.origin !== "https://lotek") continue

    const md = adresser.get(mål.pathname)
    if (md) a.properties.href = `${md}${mål.hash}`
  }
}

function tilMarkdown(html, sti, adresser) {
  const side = tolk.parse(html)
  const innhold = select(".sl-markdown-content", side)
  if (!innhold) return null

  const tittel = toText(select("h1", side) ?? tekst("")).trim()
  const beskrivelse = select('meta[name="description"]', side)?.properties
    .content

  /*
   * The code blocks first: the copy button and "Terminal window" are inside
   * them, and `kodeblokk` takes the lines before they disappear. The tabs
   * last, so a tab that only had a live example is empty when it is
   * considered, and drops out.
   */
  bytt(innhold, ".expressive-code", kodeblokk)
  merkFaner(innhold)
  fjern(innhold, STØY)
  bytt(innhold, "aside.starlight-aside", merknad)
  bytt(innhold, "starlight-tabs", faner)
  lenker(innhold, sti, adresser)

  const brødtekst = skriv
    .stringify(skriv.runSync({ type: "root", children: [innhold] }))
    .trim()

  return [`# ${tittel}`, beskrivelse ? `> ${beskrivelse}` : "", brødtekst]
    .filter(Boolean)
    .join("\n\n")
}

/** @returns {import("astro").AstroIntegration} */
export function markdownsider() {
  return {
    name: "lotek:markdownsider",
    hooks: {
      "astro:build:done": ({ dir, pages, logger }) => {
        const rot = fileURLToPath(dir)

        // Every page that has a Markdown version, and where it is to go.
        const sider = []
        for (const { pathname } of pages) {
          const fil = `${rot}${pathname}index.html`.replace(/\/\/+/g, "/")
          let html
          try {
            html = readFileSync(fil, "utf8")
          } catch {
            continue
          }

          const lenke = select(MARKDOWNLENKE, tolk.parse(html))
          if (lenke)
            sider.push({ sti: `/${pathname}`, html, md: lenke.properties.href })
        }

        const adresser = new Map(sider.map(({ sti, md }) => [sti, md]))
        const headers = []

        for (const { sti, html, md } of sider) {
          const markdown = tilMarkdown(html, sti, adresser)
          if (markdown === null) {
            throw new Error(`${sti} has a Markdown link, but no content`)
          }

          writeFileSync(`${rot}${md.slice(1)}`, `${markdown}\n`)
          headers.push(`${md}\n  Content-Type: text/markdown; charset=utf-8`)
        }

        /*
         * The content type per file, for the same reason as for the rulebooks
         * in `public/_headers`. Each file is listed at its own address, so
         * nothing depends on how Netlify reads a wildcard in the middle of a
         * file name, and the list is made from the files actually written.
         */
        const headerfil = `${rot}_headers`
        writeFileSync(
          headerfil,
          `${readFileSync(headerfil, "utf8").trimEnd()}\n\n# The Markdown versions of the pages, written by src/plugins/markdown-pages.mjs.\n${headers.join("\n")}\n`,
        )

        logger.info(`${sider.length} pages written as Markdown.`)
      },
    },
  }
}
