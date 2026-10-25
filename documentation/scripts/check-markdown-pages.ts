/**
 * At hver side i dokumentasjonen også finnes som Markdown, og at Markdown-
 * utgaven har med det siden har.
 *
 * Filene skrives av `src/plugins/markdownsider.mjs` etter bygget, av den
 * ferdige HTML-en. Det som kan gå galt, går galt i stillhet: en Starlight-
 * oppgradering som gir kodeblokkene en ny klasse, gir Markdown uten kode, og en
 * ny komponent i en side kan legge igjen rå HTML. Ingen ser på filene, så det
 * er denne sjekken som ser.
 *
 * Kontrollene er gjort med andre midler enn omskriveren bruker: regulære
 * uttrykk på HTML-en og en enkel linjeleser på Markdown-en, ikke hast og mdast.
 * En feil i den ene tolkningen gjentas da ikke i den andre.
 *
 * Kjør med: bun documentation/scripts/sjekk-markdownsider.ts
 * Krever at `documentation/dist` er bygd.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIST = fileURLToPath(new URL("../dist/", import.meta.url))

const avvik: string[] = []

function htmlsider(mappe: string): string[] {
  return readdirSync(mappe, { withFileTypes: true }).flatMap((oppf) => {
    const sti = `${mappe}${oppf.name}`
    if (oppf.isDirectory()) return htmlsider(`${sti}/`)
    return oppf.name === "index.html" ? [sti] : []
  })
}

/** Antall kodeblokker i Markdown, med gjerder av ``` eller ~~~. */
function kodeblokker(markdown: string): number {
  let antall = 0
  let gjerde: string | null = null

  for (const linje of markdown.split("\n")) {
    const treff = /^\s*(`{3,}|~{3,})/.exec(linje)
    if (!treff) continue

    if (gjerde === null) {
      gjerde = treff[1]
      antall += 1
    } else if (
      treff[1][0] === gjerde[0] &&
      treff[1].length >= gjerde.length &&
      linje.trim() === treff[1]
    ) {
      gjerde = null
    }
  }

  return antall
}

/** Markdown uten kodeblokker og kode i linja, der HTML er lov. */
function utenKode(markdown: string): string {
  return markdown
    .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
    .replace(/(`+)[\s\S]*?\1/g, "")
}

const headers = readFileSync(`${DIST}_headers`, "utf8")
let sider = 0

for (const fil of htmlsider(DIST)) {
  const html = readFileSync(fil, "utf8")
  const side = fil.slice(DIST.length - 1).replace(/index\.html$/, "")

  if (!html.includes('class="sl-markdown-content"') || side === "/404/")
    continue

  const lenke =
    /<link rel="alternate" type="text\/markdown" href="([^"]+)"/.exec(html)
  if (!lenke) {
    avvik.push(`${side} har ingen Markdown-lenke i sidehodet`)
    continue
  }

  const adresse = lenke[1]
  let markdown: string

  try {
    markdown = readFileSync(`${DIST}${adresse.slice(1)}`, "utf8")
  } catch {
    avvik.push(`${side} lenker til ${adresse}, som ikke ble skrevet`)
    continue
  }

  sider += 1

  // Skrevet i samme bygg som siden, ikke liggende igjen fra et eldre.
  if (statSync(`${DIST}${adresse.slice(1)}`).mtimeMs < statSync(fil).mtimeMs)
    avvik.push(`${adresse} er eldre enn ${side}`)

  const tittel = /<h1 id="_top"[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]
  if (tittel && !markdown.startsWith(`# ${tittel}\n`))
    avvik.push(`${adresse} begynner ikke med «# ${tittel}»`)

  /*
   * Hver kodeblokk på siden skal stå i Markdown, verken mer eller mindre.
   * Forhåndsvisningene i `<template>` telles ikke: markupen der står i
   * «Ren HTML»-fanen, som er en kodeblokk.
   */
  const innhold = html
    .slice(html.indexOf('class="sl-markdown-content"'))
    .replace(/<template[\s\S]*?<\/template>/g, "")
  const iSiden = (innhold.match(/<pre[\s>]/g) ?? []).length
  const iMarkdown = kodeblokker(markdown)
  if (iSiden !== iMarkdown)
    avvik.push(
      `${adresse} har ${iMarkdown} kodeblokker, mens siden har ${iSiden}`,
    )

  /*
   * Rå HTML utenfor kode er en komponent omskriveren ikke kjenner. `<x@y>` og
   * `<https://…>` er Markdowns egne lenker, og `\<` er en vinkel som er
   * skrevet som tekst.
   */
  const rest = utenKode(markdown).match(
    /(?<!\\)<(?![a-z][\w.+-]*@|https?:)[a-zA-Z][^>\n]{0,40}/g,
  )
  if (rest) avvik.push(`${adresse} har rå HTML igjen: ${rest.slice(0, 3)}`)

  if (!headers.includes(`${adresse}\n  Content-Type: text/markdown`))
    avvik.push(`${adresse} mangler innholdstype i _headers`)
}

if (sider === 0) avvik.push("Ingen sider med Markdown-utgave ble funnet")

if (avvik.length > 0) {
  console.error(
    `Markdown-utgavene stemmer ikke med sidene:\n\n${avvik
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Alle ${sider} sider finnes som Markdown, med kodeblokkene og uten rå HTML.`,
)
