/**
 * At regelbøkene i `agent/` stemmer med pakken.
 *
 * En agent-instruksjon med en feil i er verre enn ingen instruksjon: den ser
 * autoritativ ut, og agenten skriver feilen inn i konsumentens app uten å
 * spørre. Derfor etterprøves hver påstand i hver regelbok mot det pakken
 * faktisk sender ut, på samme måte som `sjekk-oppskrifter.ts` gjør for
 * komponentsidene.
 *
 *   - filene på disk er de generatoren ville skrevet nå;
 *   - hver klasse og hvert element pakken har, står i hver regelbok;
 *   - hver markupblokk går gjennom Fristils egen sjekk uten funn;
 *   - hvert `@fristil/designsystem/…` finnes i `exports`;
 *   - hver `defineFsX` svarer til et element som finnes;
 *   - hver `fs.x()` er en byggefunksjon som finnes;
 *   - hvert tokennavn står i `tokens.css`;
 *   - bare React-regelboka viser React-inngangen, `useEffect` og `createRoot`;
 *   - ingen markup for nettleseren importerer et pakkenavn;
 *   - kommandoen kjenner nøyaktig de regelbøkene som finnes.
 *
 * Kjør med: bun scripts/sjekk-agent.ts, eller som en del av `bun run build`.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { diagnoseMarkup } from "../src/diagnostics/index.js"
import { fs } from "../src/index.js"
import { ROLES } from "../src/tokens/contract.js"
import { FAMILIES, roleToCss } from "../src/tokens/matrix.js"
import { classes } from "../src/vocabulary/classes.js"
import { elements } from "../src/vocabulary/elements.js"
import { PAKKE, pakke } from "./agent-deler.js"
import { filer, NAVN } from "./generate-agent.js"

const avvik: string[] = []

/** Alle komponentenes stilark i én streng, for oppslag på variabelnavn. */
function komponentstilark(mappe = join(PAKKE, "src/components")): string {
  return readdirSync(mappe, { withFileTypes: true })
    .map((oppføring) => {
      const sti = join(mappe, oppføring.name)
      if (oppføring.isDirectory()) return komponentstilark(sti)
      return oppføring.name.endsWith(".css") ? readFileSync(sti, "utf8") : ""
    })
    .join("\n")
}

/*
 * Tellerne er ikke pynt. En vakt som går gjennom en liste skal telle hva den
 * faktisk gjorde, sist i løkka, og kreve at tallet er både likt det forventede
 * og større enn null. Uten det skrev oppsummeringen her antallet klasser og
 * elementer den hadde *hentet inn*, ikke antallet den hadde sett på, og en tom
 * liste ville sett ut som en full kjøring.
 */
let sjekkedeFiler = 0
let sjekkedeKlasser = 0
let sjekkedeElementer = 0
let sjekkedeTokens = 0
let sjekkedeAkser = 0

/*
 * Tokennavnene telles per slag, ikke bare i sum.
 *
 * Én sum skjulte at et helt slag kunne mangle: da fargene ble en matrise,
 * sluttet generatoren å skrive et eneste fargenavn, og summen var likevel stor
 * fordi «Skrift:»-linja fortsatt listet tretten `--font-*`-navn.
 *
 * Denne vakten fanger ikke akkurat det tilfellet i dag, og det skal stå her
 * framfor å bli trodd: malen i `generate-agent.ts` har to fargenavn skrevet
 * inn i prosaen, så `--fs-color-` blir lest i hver bok selv om `tokenListe()`
 * ga tom streng. Det er aksesjekken under som feller et tomt kodegjerde. Denne
 * feller et slag som forsvinner helt, som `--fs-spacing-` eller
 * `--fs-line-height-`.
 */
const SLAG = ["--fs-color-", "--fs-spacing-", "--fs-line-height-", "--fs-font-"]
const lesteSlag = new Map<string, Set<string>>()
let sjekkedeBlokker = 0
const blokkerPerFil = new Map<string, number>()

function krev(påstand: boolean, beskrivelse: string): void {
  if (!påstand) avvik.push(beskrivelse)
}

/*
 * Mappa på disk er den uavhengige kilden.
 *
 * Alt annet i denne vakten kommer fra `OPPSKRIFTER`: køen, det forventede
 * antallet, og innholdet det sammenlignes med. Den spør altså generatoren om
 * generatoren, og CLAUDE.md er kategorisk om at det forventede ikke skal komme
 * fra samme kilde som køen.
 *
 * Feilsituasjonen er konkret: døp om en oppskrift, og generatoren skriver den
 * nye fila uten å slette den gamle. Den gamle blir liggende, foreldet, og den
 * følger med i tarballen fordi `files` tar hele mappa, og serveres på
 * `/agent/<navn>.md` fordi ruten leser mappa. `fristil agent` kan ikke skrive
 * den ut, og ingenting sier fra.
 */
const påDisk = readdirSync(join(PAKKE, "agent"))
  .filter((navn) => navn.endsWith(".md"))
  .sort()
const skalFinnes = NAVN.map((navn) => `${navn}.md`).sort()

if (påDisk.join(",") !== skalFinnes.join(",")) {
  const tilOvers = påDisk.filter((navn) => !skalFinnes.includes(navn))
  const mangler = skalFinnes.filter((navn) => !påDisk.includes(navn))

  if (tilOvers.length > 0)
    krev(
      false,
      `agent/ har filer generatoren ikke skriver: ${tilOvers.join(", ")}. Slett dem.`,
    )
  if (mangler.length > 0)
    krev(false, `agent/ mangler ${mangler.join(", ")}. Kjør bun run generate.`)
}

// 1. Filene på disk er ferske.
const forventet = filer()

for (const [sti, innhold] of Object.entries(forventet)) {
  let faktisk: string | null = null

  try {
    faktisk = readFileSync(join(PAKKE, sti), "utf8")
  } catch {
    // Mangler: meldes under.
  }

  if (faktisk === null)
    krev(false, `${sti} finnes ikke. Kjør bun run generate.`)
  else if (faktisk !== innhold)
    krev(false, `${sti} er utdatert. Kjør bun run generate.`)
}

for (const [sti, innhold] of Object.entries(forventet)) {
  const navn = sti.replace(/^agent\/|\.md$/g, "")
  sjekkedeFiler += 1

  // 2. Hver klasse og hvert element pakken har, er nevnt. En komponent som
  // mangler er en komponent agenten finner opp et alternativ til.
  for (const klasse of Object.keys(classes)) {
    // Med `includes(klasse)` ble `fs-avatar` oppfylt av `fs-avatar-stack`, og
    // 19 av basisklassene hadde en lengre søsterklasse i samme tabell. Backtick
    // på begge sider er formen tabellene faktisk skriver dem i.
    krev(
      innhold.includes(`\`${klasse}\``),
      `${sti} nevner ikke klassen ${klasse}`,
    )
    sjekkedeKlasser += 1
  }
  for (const tagg of Object.keys(elements)) {
    krev(
      innhold.includes(`<${tagg}>`),
      `${sti} nevner ikke elementet <${tagg}>`,
    )
    sjekkedeElementer += 1
  }

  /*
   * 3. Markupen tåler Fristils egen sjekk.
   *
   * `astro` er med fordi en `.astro`-fil er HTML med frontmatter over, og
   * blokkene der bærer ekte markup: hele `## 7` i astro-regelboka er et
   * `<fs-field>`. `tsx` er ikke med, og det er et bevisst hull: markupen der er
   * JSX, med `invalid={ugyldig || undefined}` og andre former diagnostikken
   * ikke leser, og `## 7` i react-regelboka viser med vilje ugyldig markup som
   * eksempler på kompileringsfeil.
   */
  const blokker = [...innhold.matchAll(/```(?:html|astro)\n([\s\S]*?)```/g)]

  for (const [nummer, blokk] of blokker.entries()) {
    for (const funn of diagnoseMarkup(blokk[1])) {
      krev(false, `${sti}, markupblokk ${nummer + 1}: ${funn.message}`)
    }
    sjekkedeBlokker += 1
  }

  blokkerPerFil.set(sti, blokker.length)

  // 4. Hver import peker på noe pakken lover. En sti som ikke finnes er kode
  // som ser riktig ut og feiler hos konsumenten.
  for (const treff of innhold.matchAll(
    /(node_modules\/)?@fristil\/designsystem\/([a-z0-9-]+(?:\.css)?)/g,
  )) {
    // En sti under node_modules er en filsti inn i pakken, ikke et pakkenavn
    // `exports` svarer for. `dist/fristil.css` finnes, men `./dist` gjør ikke.
    if (treff[1]) continue

    const inngang = `./${treff[2]}`
    krev(
      inngang in pakke.exports,
      `${sti} viser til ${treff[0]}, som ikke står i exports`,
    )
  }

  // 5. Hver registreringsfunksjon svarer til et element som finnes.
  for (const treff of innhold.matchAll(/\bdefineFs([A-Z][A-Za-z]*)\b/g)) {
    const tagg = `fs-${treff[1]
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()}`
    krev(tagg in elements, `${sti} kaller ${treff[0]}, men ${tagg} finnes ikke`)
  }

  // 6. Hver byggefunksjon finnes i `fs`.
  for (const treff of innhold.matchAll(/\bfs\.([a-zA-Z]+)\(/g)) {
    krev(treff[1] in fs, `${sti} bruker fs.${treff[1]}(), som ikke finnes i fs`)
  }

  /*
   * 8. Begge aksene i fargematrisen står i kodegjerdet.
   *
   * Tokensjekken over teller navn, og aksene er ikke navn: en familie heter
   * `accent`, ikke `--fs-color-accent`. Da fargene ble en matrise, sluttet
   * generatoren å skrive et eneste fargenavn, kodegjerdet sto tomt, og
   * navnetellingen var likevel stor nok til å melde grønt.
   *
   * Sjekken leser bare kodegjerdene, ikke prosaen rundt. Prosaen i malen
   * nevner `surface`, `fill`, `content`, `border`, `text` og `neutral` for å
   * forklare hva en rolle er, så en sjekk på hele fila ville vært oppfylt av
   * malen alene for seks av de atten påstandene. Da kunne en akse falt ut uten
   * at noe sa fra.
   */
  const gjerder = [...innhold.matchAll(/```[\s\S]*?```/g)]
    .map((treff) => treff[0])
    .join("\n")

  for (const familie of FAMILIES) {
    krev(
      gjerder.includes(`\`${familie}\``),
      `${sti} nevner ikke familien ${familie} i et kodegjerde`,
    )
    sjekkedeAkser += 1
  }

  for (const rolle of Object.keys(ROLES)) {
    const navn = roleToCss(rolle as keyof typeof ROLES)
    krev(
      gjerder.includes(`\`${navn}\``),
      `${sti} nevner ikke rollen ${navn} i et kodegjerde`,
    )
    sjekkedeAkser += 1
  }

  // 7. Hvert tokennavn finnes. Ellipsen er med i prosaen som mønster, og
  // hopper derfor over.
  const tokens = readFileSync(join(PAKKE, "src/tokens/tokens.css"), "utf8")
  /*
   * En komponentvariabel, som `--fs-label-required-text`, er ikke et token,
   * men den finnes i stilarket til komponenten. Navnet må stå i det ene eller
   * det andre, så en regelbok kan ikke nevne en variabel pakken ikke har.
   */
  const stilark = komponentstilark()

  /*
   * Mønsteret må slutte på et bokstav- eller talltegn, og ikke ha et til etter
   * seg. Uten det første traff `var(--fs-color-…)` i prosaen som
   * `--fs-color-`, siden slaget nå står i navnet og bindestreken er med i
   * tegnklassen. Det gikk fri før bare fordi `--semantic-` ikke hadde noe slag
   * å klippe i.
   */
  for (const treff of innhold.matchAll(
    /--fs-[a-zA-Z0-9-]*[a-zA-Z0-9](?![a-zA-Z0-9\-…])/g,
  )) {
    /*
     * Navnet må stå helt ut i `tokens.css`, ikke bare som en begynnelse:
     * `--fs-color-danger` finnes ikke, men ville passert på
     * `--fs-color-danger-fill`.
     */
    const heleNavnet = new RegExp(`${treff[0]}(?![a-zA-Z0-9-])`)

    krev(
      heleNavnet.test(tokens) || heleNavnet.test(stilark),
      `${sti} nevner ${treff[0]}, som verken finnes i tokens.css eller i et komponentstilark`,
    )
    sjekkedeTokens += 1
    for (const slag of SLAG)
      if (treff[0].startsWith(slag))
        lesteSlag.set(slag, (lesteSlag.get(slag) ?? new Set()).add(sti))
  }

  // 8. Ingen krysskontaminering. Å advare mot `className` er nyttig i de andre
  // filene, så ordet alene er greit; det som ikke skal stå, er oppskriften på
  // å bruke React-inngangen eller en effekt.
  if (navn !== "react") {
    for (const reactisme of [
      '"@fristil/designsystem/react"',
      "useEffect",
      "createRoot",
    ]) {
      krev(
        !innhold.includes(reactisme),
        `${sti} viser til ${reactisme}, som bare hører i react.md`,
      )
    }
  }

  /*
   * 9. Ingen markup for nettleseren importerer et pakkenavn.
   *
   * `import … from "@fristil/designsystem/field"` i en `<script type="module">`
   * slår ikke opp uten bundles eller importmap: pakkenavnet finnes ikke i
   * nettleseren, og importen feiler stille. Sporene uten byggesteg må derfor
   * ha hele URL-en. Sjekken står her framfor per miljø, siden en `html`-blokk
   * er markup for nettleseren uansett hvilken regelbok den står i.
   */
  /*
   * Bare `html`-blokkene, ikke `astro`.
   *
   * I en `.astro`-fil er pakkenavnet riktig: frontmatteret kjøres ved bygging,
   * og Astro tar `<script>`-taggene i malen gjennom byggesteget. Regelen
   * rett til nettleseren.
   */
  for (const [nummer, blokk] of [
    ...innhold.matchAll(/```html\n([\s\S]*?)```/g),
  ].entries()) {
    // Bivirkningsimport uten `from`, dynamisk import og enkeltfnutter feiler
    // like stille i en nettleser som den ene formen som sto her før.
    const naken =
      /(?:from|import)\s*\(?\s*\n?\s*["']@fristil\/designsystem/.test(blokk[1])
    krev(
      !naken,
      `${sti}, markupblokk ${nummer + 1} importerer et pakkenavn i nettleseren. Bruk hele URL-en.`,
    )
  }
}

// 9. Kommandoen kjenner nøyaktig de regelbøkene som finnes. Uten dette kunne
// en ny regelbok bli liggende uten at `fristil agent` kunne skrive den ut.
const cli = readFileSync(join(PAKKE, "src/cli.ts"), "utf8")
const iKommandoen = [...cli.matchAll(/\["([a-z]+)", "agent\/([a-z]+)\.md"\]/g)]
const kjenner = iKommandoen.map(([, navn]) => navn)

krev(
  kjenner.join(",") === NAVN.join(","),
  `fristil agent kjenner ${kjenner.join(", ") || "ingen"}, men generatoren skriver ${NAVN.join(", ")}`,
)

for (const [, navn, fil] of iKommandoen) {
  krev(navn === fil, `fristil agent peker ${navn} på agent/${fil}.md`)
}

if (avvik.length > 0) {
  console.error(
    `Regelbøkene stemmer ikke med pakken:\n\n${avvik
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

/*
 * Vakten står etter rapporten, aldri i stedet for den, så en ufullstendig
 * kjøring ikke skjuler de avvikene den faktisk rakk å finne.
 *
 * Det forventede kommer fra `NAVN`, `classes` og `elements`, altså fra de samme
 * kildene generatoren bygger av. Vakten etterprøver derfor ikke at innholdet er
 * riktig, bare at hver fil faktisk ble gått gjennom. Den uavhengige
 * etterprøvingen ligger i `diagnoseMarkup`, i `exports` og i `tokens.css`.
 */
const ventet = {
  filer: NAVN.length,
  klasser: NAVN.length * Object.keys(classes).length,
  elementer: NAVN.length * Object.keys(elements).length,
}

const utilstrekkelig: string[] = []

if (sjekkedeFiler !== ventet.filer || sjekkedeFiler === 0)
  utilstrekkelig.push(`${sjekkedeFiler} filer, ventet ${ventet.filer}`)
if (sjekkedeKlasser !== ventet.klasser || sjekkedeKlasser === 0)
  utilstrekkelig.push(`${sjekkedeKlasser} klasser, ventet ${ventet.klasser}`)
if (sjekkedeElementer !== ventet.elementer || sjekkedeElementer === 0)
  utilstrekkelig.push(
    `${sjekkedeElementer} elementer, ventet ${ventet.elementer}`,
  )
if (sjekkedeTokens === 0) utilstrekkelig.push("ingen tokennavn")

const ventedeAkser = NAVN.length * (FAMILIES.length + Object.keys(ROLES).length)
if (sjekkedeAkser !== ventedeAkser || sjekkedeAkser === 0)
  utilstrekkelig.push(`${sjekkedeAkser} akser, ventet ${ventedeAkser}`)

for (const slag of SLAG) {
  const filer = lesteSlag.get(slag)?.size ?? 0
  if (filer !== NAVN.length)
    utilstrekkelig.push(
      `${slag} lest i ${filer} regelbøker, ventet ${NAVN.length}`,
    )
}
if (sjekkedeBlokker === 0) utilstrekkelig.push("ingen markupblokker")

/*
 * Hver regelbok skal ha minst én markupblokk som ble lest, med ett unntak som
 * står skrevet her framfor å være stille: react-regelboka har ingen. Markupen
 * der er JSX, og den leses ikke av diagnostikken. Den er dekket av klasse-,
 * element-, sti- og tokensjekkene som de andre, men ikke av denne.
 *
 * Vakten har bevist at den virker begge veier. Da temaseksjonen kom med en
 * delt HTML-blokk, fikk react.md markup den ikke skulle hatt, og vakten sa
 * fra at fila ikke lenger hørte her. Eksempelet skrives nå i hvert miljøs
 * eget språk, og React fikk sin tsx tilbake.
 */
const UTEN_MARKUPSJEKK = new Set(["react"])

for (const [sti, antall] of blokkerPerFil) {
  const navn = sti.replace(/^agent\/|\.md$/g, "")

  if (antall === 0 && !UTEN_MARKUPSJEKK.has(navn))
    utilstrekkelig.push(`${sti} har ingen markupblokk som ble lest`)

  if (antall > 0 && UTEN_MARKUPSJEKK.has(navn))
    utilstrekkelig.push(
      `${sti} har nå markup som kan leses, så den hører ikke i UTEN_MARKUPSJEKK`,
    )
}

if (utilstrekkelig.length > 0) {
  console.error(
    `Vakten så ikke på det den skulle: ${utilstrekkelig.join("; ")}\n`,
  )
  process.exit(1)
}

console.log(
  `Regelbøkene stemmer: ${sjekkedeFiler} filer, ${sjekkedeKlasser} klassepåstander, ${sjekkedeElementer} elementpåstander, ${sjekkedeTokens} tokennavn, ${sjekkedeAkser} akser og ${sjekkedeBlokker} markupblokker.`,
)
