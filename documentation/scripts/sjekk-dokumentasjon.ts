/**
 * Kontrollerer at dokumentasjonen følger koden.
 *
 * Tabellene over komponentvariabler, klasser og deler er skrevet for hånd, og
 * de glir fra hverandre uten at noe sier fra: `--fs-calendar-trigger-padding`
 * og `--fs-date-field-icon-radius` fantes i CSS-en i flere runder uten å stå
 * noe sted en konsument kunne lese. En part som ikke er dokumentert er verre
 * enn en som ikke finnes, siden navnet ligger inni skyggeroten og ikke kan
 * leses av i markupen.
 *
 * Kjør med: bun run test:docs
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROT = fileURLToPath(new URL("../../", import.meta.url))
const KOMPONENTER = `${ROT}designsystem/src/components/`
const SIDER = `${ROT}documentation/src/content/docs/components/`
const TILPASNING = `${ROT}documentation/src/content/docs/tilpasning.mdx`
const DOKUMENTASJON = `${ROT}documentation/src/`

type Avvik = { hvor: string; hva: string }

const avvik: Avvik[] = []

function les(sti: string): string {
  return readFileSync(sti, "utf8")
}

function filer(mønster: string): string[] {
  return [...new Bun.Glob(mønster).scanSync(KOMPONENTER)].map(
    (treff) => `${KOMPONENTER}${treff}`,
  )
}

/** Komponentmappene, som `css/button` og `frittstaende/calendar`. */
function komponentmapper(): { navn: string; sti: string }[] {
  const mapper = new Map<string, string>()
  for (const fil of filer("*/*/*.ts")) {
    const deler = fil.slice(KOMPONENTER.length).split("/")
    if (deler.length < 3) continue
    mapper.set(deler[1], `${KOMPONENTER}${deler[0]}/${deler[1]}/`)
  }
  return [...mapper]
    .map(([navn, sti]) => ({ navn, sti }))
    .sort((a, b) => a.navn.localeCompare(b.navn))
}

function kilde(sti: string, endelse: string): string {
  const treff = [...new Bun.Glob(`*${endelse}`).scanSync(sti)].filter(
    (navn) => !navn.includes(".test."),
  )
  return treff.map((navn) => les(`${sti}${navn}`)).join("\n")
}

/** Klassenavnene et stilark definerer. */
function klasser(css: string): string[] {
  const rent = css
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/url\([^)]*\)/g, " ")
    .replace(/"[^"]*"/g, " ")
  return [...new Set((rent.match(/\.fs-[\w-]+/g) ?? []).map((n) => n.slice(1)))]
}

/** Komponentvariablene et stilark leser. */
function variabler(css: string): string[] {
  return [...new Set(css.match(/--fs-[\w-]+/g) ?? [])]
}

/** Delnavnene en shadow DOM-komponent eksponerer. */
function deler(ts: string): string[] {
  const funnet = new Set<string>()
  for (const treff of ts.matchAll(/part="([^"$]+)"/g)) {
    for (const navn of treff[1].split(/\s+/)) if (navn) funnet.add(navn)
  }
  // dayParts() og liknende bygger lista i JavaScript
  for (const treff of ts.matchAll(/names\.push\("([\w-]+)"\)/g)) {
    funnet.add(treff[1])
  }
  for (const treff of ts.matchAll(/const names = \["([\w-]+)"\]/g)) {
    funnet.add(treff[1])
  }
  return [...funnet]
}

/**
 * Eksempler skal kunne kopieres rett inn.
 *
 * `style=` i et eksempel er nesten alltid en jukselapp for å få
 * forhåndsvisningen til å se riktig ut, og leseren kan ikke se forskjell på
 * den og systemet. Trenger visningen en tilpasning, hører den i `visningsCss`
 * på `<Eksempel>`, som ikke vises i kodefanen.
 */
for (const fil of new Bun.Glob("**/*.mdx").scanSync(
  `${ROT}documentation/src/content/docs`,
)) {
  const tekst = les(`${ROT}documentation/src/content/docs/${fil}`)

  // `visningsCss` er CSS, og kan inneholde ordet uten at det er markup.
  const utenVisningsCss = tekst.replace(/visningsCss=\{`[\s\S]*?`\}/g, " ")

  // `style = '…'` og `style='…'` er like gyldige som `style="…"`.
  if (/\bstyle\s*=/.test(utenVisningsCss)) {
    avvik.push({
      hvor: fil,
      hva: "har et style-attributt i et eksempel. Bruk visningsCss, eller en klasse fra systemet.",
    })
  }
}

const tilpasning = les(TILPASNING)
const alleVariabler = new Set<string>()

// Tokenene skal stå på tokensiden. Ellers finnes de bare i kildekoden, og en
// konsument som skal bygge sitt eget tema vet ikke at de er der.
const tokenkilde = les(`${ROT}designsystem/src/tokens/tokens.ts`)
const tokenside = les(`${ROT}documentation/src/content/docs/design-tokens.mdx`)

const tokens = new Set(
  [...tokenkilde.matchAll(/"(--(?:semantic|size|font-size)[\w-]*)":/g)].map(
    (treff) => treff[1],
  ),
)

for (const token of tokens) {
  if (!tokenside.includes(token.replace("--", ""))) {
    avvik.push({
      hvor: "design-tokens.mdx",
      hva: `tokenet \`${token}\` er ikke dokumentert`,
    })
  }
}

for (const { navn, sti } of komponentmapper()) {
  const side = `${SIDER}${navn}.mdx`
  let tekst: string
  try {
    tekst = les(side)
  } catch {
    avvik.push({
      hvor: `components/${navn}.mdx`,
      hva: "komponenten mangler en dokumentasjonsside",
    })
    continue
  }

  const css = kilde(sti, ".css")
  const ts = kilde(sti, ".ts")
  const hvor = `components/${navn}.mdx`

  if (!/^## .*[Tt]ilgjengelighet/m.test(tekst)) {
    avvik.push({ hvor, hva: "mangler seksjonen «Tilgjengelighet»" })
  }

  // <Eksempel> for de enkle, eller en egen demokomponent der eksempelet
  // trenger skript, som <CalendarDemo>.
  if (!/<(Eksempel|[A-Z][A-Za-z]*Demo)\b/.test(tekst)) {
    avvik.push({ hvor, hva: "mangler en levende forhåndsvisning" })
  }

  if (!/```(js|ts|bash)\n[^`]*@fristil\/designsystem/.test(tekst)) {
    avvik.push({ hvor, hva: "viser ikke hva som skal importeres" })
  }

  // Komponenter som ikke rendrer noe selv, som <fs-field>, har ingenting å
  // eksponere og trenger derfor ingen slik seksjon.
  const eksponerer =
    klasser(css).length > 0 ||
    deler(ts).length > 0 ||
    variabler(css + ts).length > 0
  const stylbare = /## (Klasser|Deler) du kan style/.test(tekst)
  if (eksponerer && !stylbare) {
    avvik.push({
      hvor,
      hva: "mangler seksjonen «Klasser du kan style» eller «Deler du kan style»",
    })
  }

  for (const klasse of klasser(css)) {
    if (!tekst.includes(klasse)) {
      avvik.push({ hvor, hva: `klassen \`.${klasse}\` er ikke dokumentert` })
    }
  }

  for (const del of deler(ts)) {
    if (!tekst.includes(`\`${del}\``)) {
      avvik.push({ hvor, hva: `delen \`${del}\` er ikke dokumentert` })
    }
  }

  for (const variabel of variabler(css + ts)) {
    alleVariabler.add(variabel)
    if (!tekst.includes(variabel)) {
      avvik.push({
        hvor,
        hva: `variabelen \`${variabel}\` er ikke dokumentert`,
      })
    }
  }
}

for (const variabel of [...alleVariabler].sort()) {
  if (!tilpasning.includes(variabel)) {
    avvik.push({
      hvor: "tilpasning.mdx",
      hva: `variabelen \`${variabel}\` mangler i oversikten`,
    })
  }
}

/*
 * Eksempler som kaller `fs.field()` uten `id`.
 *
 * `id` er påkrevd, og en konsument som kopierer et eksempel uten den får en
 * advarsel i konsollen og en id som ikke overlever hydrering. Ingenting annet
 * i rekka leser kodeblokkene: `sjekk-dokumentasjon` ser etter navn i teksten,
 * og ingen av dem kompileres. Da denne endringen ble gjort, sto alle
 * eksemplene allerede riktig, men det var tilfeldig og ikke voktet.
 */
/**
 * Et kall på en bygger som tar en id, og argumentet det fikk.
 *
 * Objektet fanges med ett nivå nesting, så `${x}` og et nøstet objekt inni
 * ikke avslutter treffet for tidlig. Er argumentet en variabel framfor et
 * objekt, sier sjekken ingenting: den kan ikke vite hva som står i den, og en
 * falsk alarm på riktig kode er verre enn et hull.
 */
const KODEKALL =
  /\bfs\.(field|suggestion|tabs|popover|dialog)\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})?\s*\)?/g

/** Det samme, men bare når kallet har en argumentliste. Se `inlineKode`. */
const KODEKALL_MED_ARGUMENT =
  /\bfs\.(field|suggestion|tabs|popover|dialog)\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\)/g

/**
 * Bare koden.
 *
 * I brødtekst nevnes `fs.field()` uten at det er et kall, og på forsiden står
 * det til og med inni en `<code>`-tagg i en setning. I mdx er koden det som
 * står i kodegjerdene, i Astro er det frontmatteret og skriptene.
 */
function kodebiter(fil: string, innhold: string): string[] {
  if (fil.endsWith(".mdx")) {
    return [...innhold.matchAll(/```[a-zA-Z]*\n([\s\S]*?)```/g)].map(
      (treff) => treff[1],
    )
  }

  const frontmatter = innhold.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ""
  const skript = [
    ...innhold.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),
  ].map((treff) => treff[1])
  return [frontmatter, ...skript]
}

/**
 * Det som står i enkle bakoverfnutter i brødteksten.
 *
 * `fs.suggestion({ count: treff.length })` uten `id` sto i en setning under
 * et eksempel og slapp gjennom, siden bare kodegjerdene ble lest. Et kall med
 * en argumentliste er et eksempel uansett hvor det står.
 */
function inlineKode(fil: string, innhold: string): string[] {
  if (!fil.endsWith(".mdx")) return []
  const utenGjerder = innhold.replace(/```[\s\S]*?```/g, "")
  return [...utenGjerder.matchAll(/`([^`\n]+)`/g)].map((treff) => treff[1])
}

function lesKall(fil: string, treff: RegExpMatchArray): void {
  const bygger = treff[1]
  const argument = treff[2]
  // Ingen argumentliste å lese, altså en variabel. Da sier vi ingenting.
  if (argument === undefined && !/\(\s*\)/.test(treff[0])) return

  const nokkel = bygger === "dialog" ? "titleId" : "id"
  // Uten kolon: `{ titleId }` er kortformen, og den teller. Ordgrensene gjør
  // at `helpId` og `errorId` ikke går for `id`.
  if (argument && new RegExp(`\\b${nokkel}\\b`).test(argument)) return

  avvik.push({
    hvor: fil,
    hva: `\`fs.${bygger}()\` uten \`${nokkel}\`. Den er påkrevd, og et eksempel uten den lærer bort en felle`,
  })
}

for (const fil of [
  ...new Bun.Glob("**/*.{mdx,astro}").scanSync(DOKUMENTASJON),
]) {
  const innhold = les(`${DOKUMENTASJON}${fil}`)

  for (const kode of kodebiter(fil, innhold)) {
    for (const treff of kode.matchAll(KODEKALL)) lesKall(fil, treff)
  }

  /*
   * I brødteksten teller bare kallet som faktisk har en argumentliste.
   * `fs.field()` uten argumenter er navnet på en funksjon, og står slik i
   * dusinvis av setninger.
   */
  for (const kode of inlineKode(fil, innhold)) {
    for (const treff of kode.matchAll(KODEKALL_MED_ARGUMENT))
      lesKall(fil, treff)
  }
}

if (avvik.length > 0) {
  const oppsummering = avvik.map((a) => `  ${a.hvor}: ${a.hva}`).join("\n")
  console.error(
    `Fant ${avvik.length} avvik mellom koden og dokumentasjonen:\n\n${oppsummering}\n`,
  )
  process.exit(1)
}

console.log("Dokumentasjonen følger koden.")
