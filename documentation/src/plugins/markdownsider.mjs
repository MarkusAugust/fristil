/**
 * Hver side også som Markdown, laget av den ferdig bygde HTML-en.
 *
 * En agent som henter `/components/button/` får Starlights HTML, med
 * navigasjon, fargelegging i tusen `<span>`er og fanene som skjuler halve
 * innholdet. Markdown-utgaven på `/components/button.md` er det samme
 * innholdet uten alt det.
 *
 * Kilden er den bygde siden, ikke `.mdx`-fila. Det er hele poenget. I MDX står
 * markupen i en `kode`-streng til `<Eksempel>`, og «Ren HTML»-fanen med
 * `<link>`-ene til CDN-en, importlinjene og versjonsnummeret finnes ikke der i
 * det hele tatt: den regnes ut av komponenten. En omskriver som leste MDX måtte
 * ha gjort den utregningen en gang til, og da finnes regelen to steder. Her
 * leses det komponenten faktisk skrev, så Markdown-utgaven kan ikke si noe
 * annet enn siden.
 *
 * Hvilke sider som får en fil, avgjøres av `<link rel="alternate"
 * type="text/markdown">` i sidehodet, som `src/rutedata.ts` setter. Fila
 * skrives dit lenken peker, og ingen andre steder.
 *
 * Det som tas bort: de levende eksemplene (markupen står i «Ren HTML»-fanen
 * ved siden av), ankerlenkene ved overskriftene, kopierknappene og fanelista.
 * Fanene blir avsnitt med fanenavnet i fet skrift foran innholdet, så alle
 * fanene står etter hverandre.
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

/** Det som er der for øyet eller for tastaturet, og ikke er innhold. */
const STØY = [
  "script",
  "style",
  "template",
  "svg",
  ".sl-anchor-link",
  ".fs-preview",
  ".copy",
  ".tablist-wrapper",
  ".expressive-code .sr-only",
].join(", ")

const tolk = unified().use(rehypeParse)

/*
 * `rehype-remark` tar språket fra klassen på `<code>`, men ikke filnavnet.
 * Det står i `title=` etter språket, slik Expressive Code selv skriver det, så
 * en agent ser hvilken fil blokka hører hjemme i.
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

/** Bytter ut hvert element `velger` treffer med det `lag` gir tilbake. */
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
 * Expressive Code skriver hver linje som en `<div>` med fargede `<span>`er.
 * Tilbake blir den en vanlig `<pre><code>` med språket og filnavnet, som
 * Markdown-skriveren gjør om til en kodeblokk med gjerder.
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
 * Fanenavnet på hvert panel, mens fanelista ennå finnes. Den er støy og tas
 * bort sammen med resten, men navnene trengs når fanene legges etter
 * hverandre.
 */
function merkFaner(tre) {
  for (const tabs of selectAll("starlight-tabs", tre)) {
    for (const panel of selectAll('[role="tabpanel"]', tabs)) {
      const fane = select(`[id="${panel.properties.ariaLabelledBy}"]`, tabs)
      panel.properties.dataFane = toText(fane ?? tekst("")).trim()
    }
  }
}

/** Fanene etter hverandre, hver med navnet sitt foran. */
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

/** En Starlight-merknad blir et sitat med tittelen i fet skrift. */
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
 * Lenker til en annen side som har en Markdown-utgave, går dit i stedet. En
 * agent som leser Markdown, skal kunne følge lenkene uten å havne i HTML igjen.
 *
 * Sidene lenker relativt, som `../../typesikker-bruk/`. Det løses opp mot
 * sidens egen adresse, siden Markdown-fila ligger et annet sted enn siden og
 * den samme relative stien ville bommet derfra.
 */
function lenker(tre, sti, adresser) {
  for (const a of selectAll("a[href]", tre)) {
    const href = String(a.properties.href)
    if (href.startsWith("#")) continue

    const mål = new URL(href, `https://fristil${sti}`)
    if (mål.origin !== "https://fristil") continue

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
   * Kodeblokkene først: kopierknappen og «Terminal window» ligger inni dem, og
   * `kodeblokk` henter linjene før de forsvinner. Fanene sist, så en fane som
   * bare hadde et levende eksempel er tom når den vurderes, og faller bort.
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
    name: "fristil:markdownsider",
    hooks: {
      "astro:build:done": ({ dir, pages, logger }) => {
        const rot = fileURLToPath(dir)

        // Hver side som har en Markdown-utgave, og hvor den skal ligge.
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
            throw new Error(
              `${sti} har en Markdown-lenke, men ikke noe innhold`,
            )
          }

          writeFileSync(`${rot}${md.slice(1)}`, `${markdown}\n`)
          headers.push(`${md}\n  Content-Type: text/markdown; charset=utf-8`)
        }

        /*
         * Innholdstypen per fil, av samme grunn som for regelbøkene i
         * `public/_headers`. Hver fil står med sin egen adresse, så ingenting
         * avhenger av hvordan Netlify tolker et jokertegn midt i et filnavn,
         * og lista lages av filene som faktisk ble skrevet.
         */
        const headerfil = `${rot}_headers`
        writeFileSync(
          headerfil,
          `${readFileSync(headerfil, "utf8").trimEnd()}\n\n# Markdown-utgavene av sidene, skrevet av src/plugins/markdownsider.mjs.\n${headers.join("\n")}\n`,
        )

        logger.info(`${sider.length} sider skrevet som Markdown.`)
      },
    },
  }
}
