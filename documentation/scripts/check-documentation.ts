/**
 * Kontrollerer at dokumentasjonen følger koden.
 *
 * Tabellene over komponentvariabler og klasser er skrevet for hånd, og de
 * glir fra hverandre uten at noe sier fra: `--lt-calendar-trigger-padding`
 * og `--lt-date-field-icon-radius` fantes i CSS-en i flere runder uten å stå
 * noe sted en konsument kunne lese.
 *
 * Et navn regnes som nevnt bare når det står som et helt ord, se `nevnt()`.
 * Med `includes` var `.lt-button` dokumentert så lenge `.lt-button-group`
 * sto på siden.
 *
 * Kjør med: bun run test:docs
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"
import {
  FAMILIES,
  ROLES,
  roleToCss,
} from "../../designsystem/scripts/color-contract.ts"

const ROT = fileURLToPath(new URL("../../", import.meta.url))
const KOMPONENTER = `${ROT}designsystem/src/components/`
const SIDER = `${ROT}documentation/src/content/docs/components/`
const TILPASNING = `${ROT}documentation/src/content/docs/customising.mdx`
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

/**
 * At `navn` står i `tekst` som et helt ord: uten bokstav, tall, `_` eller `-`
 * rett før eller rett etter. `lt-button` er da ikke nevnt i `lt-button-group`,
 * og `--lt-card-padding` ikke i `--lt-card-padding-inline`.
 */
function nevnt(tekst: string, navn: string): boolean {
  const kant = /[\w-]/
  for (let i = tekst.indexOf(navn); i >= 0; i = tekst.indexOf(navn, i + 1)) {
    const etter = tekst[i + navn.length] ?? ""
    if (!kant.test(tekst[i - 1] ?? "") && !kant.test(etter)) return true
  }
  return false
}

/** Komponentmappene: mappenavnet, som `button`, og stien til mappa. */
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
  return [...new Set((rent.match(/\.lt-[\w-]+/g) ?? []).map((n) => n.slice(1)))]
}

/**
 * Komponentvariablene, altså det konsumenten kan sette på én komponent.
 *
 * Lista leses fra manifestet, som `generate-manifest.ts` skriver fra
 * stilarkene: hver `var(--lt-<komponent>-…, <reserve>)`, ført til komponenten
 * navnet begynner med. Før leste denne sjekken stilarkene selv, med sin egen
 * regel for hva som er et token og hva som er en komponentvariabel, og da
 * fantes lista to steder. Nå er manifestet det ene, og en variabel som ikke
 * står der, finnes ikke for dokumentasjonen heller. At manifestet er
 * generert på nytt, vokter CI-steget «Ingenting er ugenerert».
 */
const MANIFEST: {
  tokens: { components: Record<string, Record<string, string>> }
} = JSON.parse(les(`${ROT}designsystem/manifest/manifest.json`))
const KOMPONENTVARIABLER = MANIFEST.tokens.components

/**
 * Eksempler skal kunne kopieres rett inn.
 *
 * `style=` i et eksempel er nesten alltid en jukselapp for å få
 * forhåndsvisningen til å se riktig ut, og leseren kan ikke se forskjell på
 * den og systemet. Trenger visningen en tilpasning, hører den i `visningsCss`
 * på `<Example>`, som ikke vises i kodefanen.
 */
/*
 * Klassenavnene fra vårt eget navnerom, samlet fra all MDX.
 *
 * Kandidaten er alt som ser ut som en utility-klasse med `-lt-` i, uten
 * prefiksliste. En liste over lovlige prefikser sto her først, og den var
 * feil i begge retninger: `shadow-lt-accent-fill` finnes i Tailwind 4, siden
 * `--color-*` også mater `shadow-<farge>`, og ville blitt meldt som ukjent,
 * mens et utdatert `w-lt-aside` eller `p-lt-4` aldri ville blitt sett.
 * Et `data-lt-…` er et attributt, ikke en klasse, og telles ikke.
 */
const KANDIDAT = /(?<![\w-])(?!data-lt-)[a-z][a-z-]*-lt-[a-z0-9][a-z0-9-]*/g

const kandidater = new Map<string, Set<string>>()

/*
 * Forekomster av `-lt-` som ikke ble en kandidat.
 *
 * Dette er den uavhengige tellingen. `kandidater.size` er utledet av selve
 * regexen, så en regex som snevrer seg fra nitten treff til tre gir et tall
 * som er større enn null og en sjekk som melder grønt. Her spørres det
 * motsatte: står det en `-lt-` igjen i teksten etter at hvert kandidattreff er
 * fjernet? Da er det noe regexen ikke klassifiserte, og det skal sies.
 */
const uklassifisert = new Map<string, number>()

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

  for (const treff of tekst.matchAll(KANDIDAT)) {
    kandidater.set(treff[0], (kandidater.get(treff[0]) ?? new Set()).add(fil))
  }

  /*
   * `--lt-…` er et tokennavn og ikke en klasse, og `lt-button` og
   * `lt-tabs__list` er våre egne klasser. Begge fjernes før det som er igjen
   * telles.
   */
  const rest = tekst
    .replace(KANDIDAT, " ")
    .replace(/--lt-[a-z0-9-]*/g, " ")
    .replace(/(?<![\w-])data-lt-[a-z0-9-]*/g, " ")
    .replace(/(?<![\w-])lt-[a-z0-9_-]+/g, " ")
    /*
     * Et kodeord med en plassholder i er et navnemønster og ikke et navn:
     * `<verktøy>-lt-<familie>-<rolle>` sier hvordan klassene heter. Hele
     * kodeordet strykes, ellers står `-lt-` igjen mellom plassholderne.
     */
    .replace(/`[^`\n]*<[^`\n]+`/g, " ")

  const igjen = rest.match(/-lt-/g)?.length ?? 0
  if (igjen > 0) uklassifisert.set(fil, igjen)
}

/*
 * Hver kandidat prøves mot en ekte Tailwind.
 *
 * Tailwind sier ingenting om en klasse den ikke kjenner: den lager bare ingen
 * regel. Fargene byttet navn i 0.22.0, og tolv klassenavn fra tiden før sto
 * igjen i brødtekst og tabeller på to sider. Jeg rettet den ene siden, og fem
 * av navnene sto fortsatt på den andre. En vakt på eksempelmarkupen alene
 * fanger ikke det, siden en tabellrad ikke er markup.
 *
 * Kompilatoren spørres framfor at navnerommene tolkes her. `build()` er
 * kumulativ, så en kandidat som ikke gir noe lar lengden stå.
 */
const kompilator = await compile(
  [
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/utilities.css" layer(utilities);',
    '@import "@lo-tek/interfaces/tailwind.css";',
  ].join("\n"),
  {
    base: `${ROT}documentation`,
    loadStylesheet: async (id: string, basedir: string) => {
      const sti = id.startsWith(".")
        ? join(basedir, id)
        : Bun.resolveSync(id, basedir)
      return { path: sti, base: dirname(sti), content: les(sti) }
    },
  },
)

let lengde = kompilator.build([]).length
let provdeKlasser = 0

for (const [klasse, filer] of kandidater) {
  const ny = kompilator.build([klasse]).length
  provdeKlasser += 1

  if (ny <= lengde) {
    for (const fil of filer) {
      avvik.push({
        hvor: fil,
        hva: `nevner Tailwind-klassen \`${klasse}\`, som ikke finnes i temaet`,
      })
    }
  }
  lengde = Math.max(lengde, ny)
}

/*
 * Tre ledd som skal felle en sjekk som ikke har sett på noe.
 *
 * Det første er den uavhengige tellingen over: en `-lt-` som ikke ble en
 * kandidat. Det andre er at det i det hele tatt fantes kandidater. Det tredje
 * er en negativ kontroll: uten den ville sjekken vært permanent grønn den
 * dagen `build()` sluttet å være selektiv, siden hver ekte kandidat er gyldig
 * og avvisningsveien derfor aldri utøves av dem.
 */
for (const [fil, antall] of uklassifisert) {
  avvik.push({
    hvor: fil,
    hva: `har ${antall} forekomster av «-lt-» som ikke ble lest som en klasse. Regexen treffer ikke alt den skal.`,
  })
}

if (provdeKlasser === 0) {
  avvik.push({
    hvor: "check-documentation.ts",
    hva: "fant ingen Tailwind-klasser å prøve. Regexen treffer ikke lenger.",
  })
}

const foerKontroll = lengde
if (kompilator.build(["bg-lt-finnes-ikke-i-temaet"]).length > foerKontroll) {
  avvik.push({
    hvor: "check-documentation.ts",
    hva: "Tailwind lagde en regel for en klasse som ikke finnes. Sjekken over kan ikke avvise noe.",
  })
}

const tilpasning = les(TILPASNING)
const alleVariabler = new Set<string>()

// Tokenene skal stå på tokensiden. Ellers finnes de bare i kildekoden, og en
// konsument som skal bygge sitt eget tema vet ikke at de er der.
const tokenside = les(`${ROT}documentation/src/content/docs/design-tokens.mdx`)

/*
 * Fargene dokumenteres som matrise, ikke som 86 navn.
 *
 * `--lt-color-<familie>-<rolle>` er systematisk, så siden er dekkende når hver
 * familie og hver rolle står der. Å kreve hver celle ville gitt en side som er
 * en liste framfor en forklaring, og den ville måttet skrives om hver gang en
 * familie kom til.
 *
 * Alt som ikke er en celle kreves fortsatt navngitt.
 */
const tokenCss = les(`${ROT}designsystem/src/tokens/tokens.css`)
const alleTokens = [...tokenCss.matchAll(/^\s*(--lt-[\w-]+):/gm)].map(
  (treff) => treff[1],
)

/*
 * Aksene leses fra `FAMILIES` og `ROLES`, ikke ut av navnene i `tokens.css`.
 *
 * Å utlede dem fra navnene ga `disabled` som en tiende familie, fordi
 * `--lt-color-disabled-text` ser ut som en celle. Den har bare to av de ni
 * rollene og er nettopp ikke en familie. Alt som ikke er en ekte celle må ha
 * sitt fulle tokennavn på siden, som før.
 */
const familier = new Set<string>(FAMILIES)
const roller = new Set<string>(
  Object.keys(ROLES).map((rolle) => roleToCss(rolle as keyof typeof ROLES)),
)
const andre = new Set<string>()

for (const token of alleTokens) {
  const celle = token.match(/^--lt-color-([a-z0-9]+)-(.+)$/)
  if (celle && familier.has(celle[1]) && roller.has(celle[2])) continue
  andre.add(token)
}

/*
 * Navnet må stå først i en tabellrad, ikke bare et sted på siden.
 *
 * `tokenside.includes(navn)` på bare ordet var mye svakere enn navnesjekken
 * den erstattet: `border` er en delstreng av `border-subtle`, så den kunne
 * aldri feile for seg, og `danger`, `success` og `accent` traff også i prosa
 * og i stier. Backticker alene holdt heller ikke: raden for `border` kunne
 * fjernes, siden løftet i raden under nevner den. Kravet er at navnet står
 * som første celle i en rad, altså at det er forklart og ikke bare nevnt.
 */
const forsteCeller = tokenside
  .split("\n")
  .filter((linje) => linje.startsWith("|"))
  .map((linje) => linje.split("|")[1] ?? "")

const oppfort = (navn: string) =>
  forsteCeller.some((celle) => celle.includes(`\`${navn}\``))

for (const familie of familier) {
  if (!oppfort(familie)) {
    avvik.push({
      hvor: "design-tokens.mdx",
      hva: `familien \`${familie}\` er ikke dokumentert`,
    })
  }
}

for (const rolle of roller) {
  if (!oppfort(rolle)) {
    avvik.push({
      hvor: "design-tokens.mdx",
      hva: `rollen \`${rolle}\` er ikke dokumentert`,
    })
  }
}

for (const token of andre) {
  if (!nevnt(tokenside, token)) {
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
  const variabler = Object.keys(KOMPONENTVARIABLER[navn] ?? {})
  const hvor = `components/${navn}.mdx`

  if (!/^## .*[Aa]ccessibility/m.test(tekst)) {
    avvik.push({ hvor, hva: "mangler seksjonen «Accessibility»" })
  }

  // <Example> for de enkle, eller en egen demokomponent der eksempelet
  // trenger skript, som <CalendarDemo>.
  if (!/<(Example|[A-Z][A-Za-z]*Demo)\b/.test(tekst)) {
    avvik.push({ hvor, hva: "mangler en levende forhåndsvisning" })
  }

  /*
   * Importene hører i oppskriften, ikke hvor som helst på siden.
   *
   * Regelen så før etter en `js`-blokk med pakkenavnet i, hvor som helst i
   * teksten. Den gikk grønn på de fleste sidene av feil grunn: «TypeScript»
   * nederst nevner `@lo-tek/interfaces/react`, og det telte. Nå kreves
   * det at «How to use it» selv sier hva som skal importeres,
   * enten i en kodefane eller gjennom `importer` på <Example>.
   */
  const oppskriftStart = tekst.indexOf("## How to use it")
  const oppskriftSlutt = tekst.indexOf("\n## ", oppskriftStart + 5)
  const oppskrift =
    oppskriftStart === -1
      ? ""
      : tekst.slice(
          oppskriftStart,
          oppskriftSlutt === -1 ? undefined : oppskriftSlutt,
        )

  if (oppskriftStart === -1) {
    avvik.push({ hvor, hva: "mangler seksjonen «How to use it»" })
  } else if (!/\.css/.test(oppskrift) && !/importer=\{/.test(oppskrift)) {
    /*
     * Et stilark, ikke bare pakkenavnet.
     *
     * Regelen krevde før at oppskriften nevnte `@lo-tek/interfaces`, og
     * `tabs.mdx` gikk grønn på `@lo-tek/interfaces/tabs`, altså
     * JavaScript-modulen, uten å nevne `tabs.css` med et ord. Leseren som
     * fulgte oppskriften fikk ustylede faner.
     */
    avvik.push({ hvor, hva: "sier ikke hvilke stilark oppskriften trenger" })
  }

  // Komponenter som ikke rendrer noe selv, som <lt-field>, har ingenting å
  // eksponere og trenger derfor ingen slik seksjon.
  const eksponerer = klasser(css).length > 0 || variabler.length > 0
  const stylbare = /## (Classes|Parts) you can style/.test(tekst)
  if (eksponerer && !stylbare) {
    avvik.push({
      hvor,
      hva: "mangler seksjonen «Classes you can style» eller «Parts you can style»",
    })
  }

  for (const klasse of klasser(css)) {
    if (!nevnt(tekst, klasse)) {
      avvik.push({ hvor, hva: `klassen \`.${klasse}\` er ikke dokumentert` })
    }
  }

  for (const variabel of variabler) {
    alleVariabler.add(variabel)
    if (!nevnt(tekst, variabel)) {
      avvik.push({
        hvor,
        hva: `variabelen \`${variabel}\` er ikke dokumentert`,
      })
    }
  }
}

/*
 * Hver variabel i manifestet, også dem en komponent uten side skulle hatt:
 * oversikten skal ha alle, og tellingen skal være større enn null, ellers har
 * manifestet ingen komponentvariabler og sjekken over sa ingenting.
 */
for (const variabler of Object.values(KOMPONENTVARIABLER))
  for (const variabel of Object.keys(variabler)) alleVariabler.add(variabel)
if (alleVariabler.size === 0) {
  avvik.push({
    hvor: "manifest.json",
    hva: "har ingen komponentvariabler, så ingen variabel ble sjekket",
  })
}
/*
 * Som første celle i en tabellrad, ikke bare nevnt: `--lt-card-padding` står
 * i prosaen om rekkevidde lenger opp, og raden kunne tas ut av oversikten
 * uten at noe sa fra.
 */
const oppfortITilpasning = new Set(
  tilpasning
    .split("\n")
    .filter((linje) => linje.startsWith("| `--lt-"))
    .map((linje) => linje.split("|")[1]?.trim().replace(/`/g, "") ?? ""),
)
for (const variabel of [...alleVariabler].sort()) {
  if (!oppfortITilpasning.has(variabel)) {
    avvik.push({
      hvor: "customising.mdx",
      hva: `variabelen \`${variabel}\` mangler i oversikten`,
    })
  }
}

/*
 * Eksempler som kaller `lt.field()` uten `id`.
 *
 * `id` er påkrevd, og en konsument som kopierer et eksempel uten den får en
 * advarsel i konsollen og en id som ikke overlever hydrering. Ingenting annet
 * i rekka leser kodeblokkene: `check-documentation` ser etter navn i teksten,
 * og ingen av dem kompileres. Da denne endringen ble gjort, sto alle
 * eksemplene allerede riktig, men det var tilfeldig og ikke voktet.
 */
/**
 * Et kall på en byggefunksjon som tar en id, og argumentet det fikk.
 *
 * Objektet fanges med ett nivå nesting, så `${x}` og et nøstet objekt inni
 * ikke avslutter treffet for tidlig. Er argumentet en variabel framfor et
 * objekt, sier sjekken ingenting: den kan ikke vite hva som står i den, og en
 * falsk alarm på riktig kode er verre enn et hull.
 */
const KODEKALL =
  /\blt\.(field|suggestion|tabs|popover|dialog)\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})?\s*\)?/g

/** Det samme, men bare når kallet har en argumentliste. Se `inlineKode`. */
const KODEKALL_MED_ARGUMENT =
  /\blt\.(field|suggestion|tabs|popover|dialog)\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\)/g

/**
 * Bare koden.
 *
 * I brødtekst nevnes `lt.field()` uten at det er et kall, og på forsiden står
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
 * `lt.suggestion({ count: treff.length })` uten `id` sto i en setning under
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
    hva: `\`lt.${bygger}()\` uten \`${nokkel}\`. Den er påkrevd, og et eksempel uten den lærer bort en felle`,
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
   * `lt.field()` uten argumenter er navnet på en funksjon, og står slik i
   * dusinvis av setninger.
   */
  for (const kode of inlineKode(fil, innhold)) {
    for (const treff of kode.matchAll(KODEKALL_MED_ARGUMENT))
      lesKall(fil, treff)
  }
}

/*
 * Versjonen i en CDN-adresse skal komme fra `remark-version.mjs`, ikke fra
 * tastaturet.
 *
 * Adressene sto hardkodet 74 steder i 12 filer, og `prepare-version` skrev dem
 * om ved hver utgivelse. Et omskrivingssteg må finne den gamle versjonen for å
 * bytte den, så en fil som hadde glidd ble stående og pekte på en eldre pakke
 * enn teksten rundt beskrev. Plassholderen kan ikke gli.
 *
 * Kravet er at versjonsleddet er nøyaktig `VERSION`, ikke bare at det lar være
 * å være siffer: `@latest` ville ellers passert og gitt en adresse jsdelivr
 * svarer annerledes på enn teksten lover.
 */
for (const fil of [
  ...new Bun.Glob("**/*.{mdx,astro}").scanSync(DOKUMENTASJON),
]) {
  const innhold = les(`${DOKUMENTASJON}${fil}`)

  for (const treff of innhold.matchAll(/@lo-tek\/interfaces@([^/\s"'`)]+)/g)) {
    // `VERSION` er formen i markdown. I en `.astro`-fil kjører ingen remark, og
    // der er den riktige formen å lese versjonen av `package.json` i koden.
    // Unntaket må være bundet til filtypen: uten det slapp
    // `@lo-tek/interfaces@${versjon}` gjennom i en mdx-kodeblokk også, der
    // ingen bytter den ut og ingen annen vakt ser etter den.
    if (treff[1] === "VERSION") continue
    if (fil.endsWith(".astro") && treff[1].startsWith("${")) continue

    const linje = innhold.slice(0, treff.index).split("\n").length
    avvik.push({
      hvor: `${fil}:${linje}`,
      hva: `${treff[0]} står med versjonen skrevet for hånd. Bruk @lo-tek/interfaces@VERSION, som remark-version.mjs bytter ut.`,
    })
  }
}

if (avvik.length > 0) {
  const oppsummering = avvik.map((a) => `  ${a.hvor}: ${a.hva}`).join("\n")
  console.error(
    `Fant ${avvik.length} avvik mellom koden og dokumentasjonen:\n\n${oppsummering}\n`,
  )
  process.exit(1)
}

console.log(
  `Dokumentasjonen følger koden. ${provdeKlasser} Tailwind-klasser prøvd mot temaet.`,
)
