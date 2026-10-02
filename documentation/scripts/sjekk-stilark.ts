/**
 * At hver side laster stilarkene markupen i vanlig DOM faktisk trenger.
 *
 * `astro.config.mjs` listet en gang alle 42 komponentstilarkene i `customCss`,
 * og da var spørsmålet uinteressant: hver side hadde alt. Nå står `global.css`,
 * `tokens.css` og `button.css` der, fordi de levende eksemplene ligger i en
 * shadow root og `Preview.astro` legger inn sine egne stilark med `?inline`.
 * Det gjør to feil mulige. Skriver noen Fristil-markup rett i brødteksten,
 * eller i en komponent utenfor en forhåndsvisning, står den uten stil. Og
 * Vite slutter å skrive et stilark i det hele tatt når det mister importørene
 * sine: `button.css` forsvant ut av bygget da det ble tatt ut av `customCss`,
 * og `src/pages/demo/sideskjelett.astro`, som importerer det selv, kom ut med
 * uformede knapper. Ingen av delene sier fra. Siden ser bare litt feil ut.
 *
 * Denne vaktposten leser hver bygde side, finner `fs-`-klassene og
 * `<fs-…>`-elementene som står i vanlig DOM, og krever at et av stilarkene
 * siden lenker til definerer dem.
 *
 * Fire ting holdes utenfor, og alle fire er markup som ser ekte ut uten å være
 * det: innholdet i `<template>` (shadow rootene, som har sin egen stil),
 * innholdet i `<pre>` og `<code>` (kode som vises fram, ikke kode som kjører),
 * `data-code`-attributtet (kildeteksten Expressive Code legger på kopiknappen)
 * og `<script>`-kropper.
 *
 * Kjør med: bun documentation/scripts/sjekk-stilark.ts
 * Krever at `documentation/dist` er bygd.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const DIST = `${ROT}documentation/dist/`

/**
 * Klassene som står på et vertselement for en shadow root.
 *
 * `.fs-preview` er den eneste i dag. Den har ingen regel i noe stilark, og
 * skal ikke ha en: `Preview.astro` styler verten med `:host` inne i shadow
 * rooten sin. Regelen er formulert som det den er, framfor som et unntak på
 * navnet, slik at en ny forhåndsvisningskomponent dekkes av den samme
 * begrunnelsen og en vanlig klasse aldri slipper unna ved et uhell.
 *
 * Settet gjelder hele siden, ikke det enkelte elementet. Sto den samme klassen
 * både på en vert og på et vanlig element på samme side, ville det vanlige
 * sluppet unna. Det finnes ikke i dag, og er notert framfor kodet rundt, fordi
 * en presis variant måtte finne verten sin i en strengsøm og ville vært lettere
 * å ta feil av enn regelen den håndhever.
 */
function skyggeverter(html: string): Set<string> {
  const navn = new Set<string>()
  for (const treff of html.matchAll(
    /<[a-z]+[^>]*\sclass="([^"]*)"[^>]*>\s*<template shadowrootmode=/g,
  )) {
    for (const ord of treff[1].split(/\s+/)) {
      if (ord.startsWith("fs-")) navn.add(ord)
    }
  }
  return navn
}

/** Markupen nettleseren faktisk bygger i vanlig DOM. */
function vanligDom(html: string): string {
  let ute = ""
  let i = 0

  // `<template>` er shadow rootene til forhåndsvisningene, og alt annet
  // malinnhold. De har sin egen stil, lagt inn av Preview.astro.
  while (true) {
    const start = html.slice(i).search(/<template[^>]*>/)
    if (start === -1) {
      ute += html.slice(i)
      break
    }
    const fra = i + start
    const til = html.indexOf("</template>", fra)
    if (til === -1) {
      ute += html.slice(i)
      break
    }
    ute += html.slice(i, fra)
    i = til + "</template>".length
  }

  return (
    ute
      /*
       * Kildeteksten Expressive Code legger på kopiknappen sin. Den ser ut som
       * markup og er det ikke: en `<fs-field>` der inne er tekst i et attributt
       * og blir aldri et element. Uten denne linja melder vaktposten hver eneste
       * komponentside for markup ingen nettleser bygger.
       */
      .replace(/data-code="[^"]*"/g, "")
      // Kode som vises fram. En `<fs-field>` i en kodegjerde er en illustrasjon.
      .replace(/<pre[\s>][\s\S]*?<\/pre>/g, "<pre></pre>")
      .replace(/<code[\s>][\s\S]*?<\/code>/g, "<code></code>")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")
  )
}

/**
 * Om et stilark faktisk definerer dette navnet.
 *
 * Et rent delstrengsøk er for løst: `.fs-field` ville blitt sann av
 * `.fs-fieldset`, og en side med `<fs-field>` uten `field.css` sluppet
 * gjennom. Navnet må derfor følges av noe som avslutter det i en velger.
 */
function definerer(css: string, navn: string): boolean {
  const escaped = navn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`${escaped}(?![a-zA-Z0-9_-])`).test(css)
}

/**
 * All CSS siden faktisk har: både det den lenker til og det som står inline.
 *
 * Astro inliner et stilark som er lite nok, framfor å lenke det. Leste vi bare
 * `<link>`, meldte sjekken at `.fs-sr-only` manglet på en side der regelen sto
 * rett i en `<style>` noen linjer over. Det er en blindsone som gir falskt
 * utslag, og det flyttet seg med hvor store bundlene ble, altså uten at noen
 * hadde rørt siden.
 *
 * Den må lese `vanligDom(html)` og ikke rå HTML. `Preview.astro` legger hvert
 * eksempels stilark i en `<style>` inne i `<template shadowrootmode="open">`,
 * og de hører til skyggerota og ikke til siden. Leste vi dem med, ville en
 * `.fs-button` skrevet rett i brødteksten på knappesiden passert, fordi
 * forhåndsvisningen på samme side har hele `button.css` i skyggestilen sin.
 * Det er den ene av de to feilene denne fila finnes for.
 */
function stilarkFor(html: string, side: string): string {
  const stier = [...html.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g)]
    .filter((treff) => treff[0].includes('rel="stylesheet"'))
    .map((treff) => treff[1])

  let samlet = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((treff) => treff[1])
    .join("\n")
  for (const sti of stier) {
    try {
      samlet += readFileSync(DIST + sti.replace(/^\//, ""), "utf8")
    } catch {
      funn.push(`${side}: lenker til ${sti}, som ikke finnes i dist`)
    }
  }
  return samlet
}

const funn: string[] = []

/*
 * Det forventede kommer ikke fra den samme globben som køen.
 *
 * Teller vi bare «besøkte jeg alt globben fant», etterprøver vakten seg selv,
 * og en glob som plutselig ikke traff noe ville meldt grønt. Forventningen
 * regnes derfor ut av kilden: hver side i `src/content/docs` og hver
 * `.astro`-rute i `src/pages` skal finnes som en bygd side.
 *
 * Det er adressene som samles, ikke antallet. Et tall alene tåler at én side
 * faller ut og en annen kommer til, og `dist` har uansett én HTML-fil mer enn
 * kilden, siden Starlight skriver `404.html` som ingen kilde svarer til. Med
 * adressene sier vakten hvilken side som mangler.
 */
const ventet = new Set<string>()
for (const rel of new Glob(
  "documentation/src/content/docs/**/*.{mdx,md}",
).scanSync(ROT)) {
  const slug = rel
    .replace("documentation/src/content/docs/", "")
    .replace(/\.mdx?$/, "")
  ventet.add(`${slug}/index.html`)
}
for (const rel of new Glob("documentation/src/pages/**/*.astro").scanSync(
  ROT,
)) {
  const rute = rel
    .replace("documentation/src/pages/", "")
    .replace(/\.astro$/, "")
  ventet.add(rute === "index" ? "index.html" : `${rute}/index.html`)
}

const besokt = new Set<string>()
let sjekketSider = 0
let sjekketNavn = 0

for (const rel of new Glob("**/*.html").scanSync(DIST)) {
  const html = readFileSync(DIST + rel, "utf8")
  const dom = vanligDom(html)
  const verter = skyggeverter(html)

  const klasser = new Set<string>()
  for (const treff of dom.matchAll(/class="([^"]*)"/g)) {
    for (const ord of treff[1].split(/\s+/)) {
      if (ord.startsWith("fs-") && !verter.has(ord)) klasser.add(ord)
    }
  }

  const elementer = new Set<string>()
  for (const treff of dom.matchAll(/<(fs-[a-z-]+)[\s>/]/g)) {
    elementer.add(treff[1].toLowerCase())
  }

  if (klasser.size > 0 || elementer.size > 0) {
    const css = stilarkFor(dom, rel)

    for (const klasse of klasser) {
      sjekketNavn++
      if (!definerer(css, `.${klasse}`)) {
        funn.push(
          `${rel}: bruker .${klasse} uten at noe stilark på siden har den`,
        )
      }
    }

    for (const element of elementer) {
      sjekketNavn++
      if (!definerer(css, element)) {
        funn.push(
          `${rel}: bruker <${element}> uten at noe stilark på siden har det`,
        )
      }
    }
  }

  besokt.add(rel)
  sjekketSider++
}

for (const linje of funn) console.error(`  ${linje}`)

console.log(
  `Sjekket ${sjekketSider} bygde sider og ${sjekketNavn} navn i vanlig DOM.`,
)

/*
 * Vakten står nederst, etter rapporten, og krever både at tallet er større enn
 * null og at det dekker kilden. En kjøring som ikke så på noe skal ikke kunne
 * se ut som en som så på alt.
 */
if (sjekketSider === 0) {
  console.error("Vaktposten så ingen bygde sider. Er `dist` bygd?")
  process.exit(1)
}

if (sjekketNavn === 0) {
  console.error(
    "Vaktposten fant ingen Fristil-markup i vanlig DOM noe sted. Det har det " +
      "alltid vært noe av, så det er sannsynligvis filteret i `vanligDom` som " +
      "har begynt å spise for mye, ikke sidene som har blitt rene.",
  )
  process.exit(1)
}

const mangler = [...ventet].filter((adresse) => !besokt.has(adresse))
if (mangler.length > 0) {
  console.error(
    `${mangler.length} sider finnes i kilden og ikke i bygget, blant dem ` +
      `${mangler.slice(0, 3).join(", ")}. Bygget er ufullstendig, og da har ` +
      "vaktposten ikke sett på det den skulle.",
  )
  process.exit(1)
}

if (funn.length > 0) {
  console.error(
    `${funn.length} steder mangler stilarket sitt. Importer det i komponenten ` +
      "eller siden som skriver markupen, slik `src/pages/index.astro` gjør.",
  )
  process.exit(1)
}

console.log("Hver side har stilarkene markupen sin trenger.")
