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

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { classes } from "../src/diagnostics/classes.js"
import { elements } from "../src/diagnostics/elements.js"
import { diagnoseMarkup } from "../src/diagnostics/index.js"
import { fs } from "../src/index.js"
import { PAKKE, pakke } from "./agent-deler.js"
import { filer, NAVN } from "./generate-agent.js"

const avvik: string[] = []

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
let sjekkedeBlokker = 0
const blokkerPerFil = new Map<string, number>()

function krev(påstand: boolean, beskrivelse: string): void {
  if (!påstand) avvik.push(beskrivelse)
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

  // 6. Hver bygger finnes i `fs`.
  for (const treff of innhold.matchAll(/\bfs\.([a-zA-Z]+)\(/g)) {
    krev(treff[1] in fs, `${sti} bruker fs.${treff[1]}(), som ikke finnes i fs`)
  }

  // 7. Hvert tokennavn finnes. Ellipsen er med i prosaen som mønster, og
  // hopper derfor over.
  const tokens = readFileSync(join(PAKKE, "src/tokens/tokens.css"), "utf8")

  for (const treff of innhold.matchAll(
    /--(?:semantic|size|font|palette)-[a-zA-Z0-9-]+/g,
  )) {
    /*
     * Navnet må stå helt ut i `tokens.css`, ikke bare som en begynnelse:
     * `--semantic-danger` finnes ikke, men passerte på `--semantic-danger-main`.
     *
     * Mønsteret over kan ikke treffe `var(--semantic-…)`, siden tegnklassen
     * ikke rommer ellipsen, så prosaens mønsternavn kommer aldri hit. En vakt
     * mot dem sto her og var død kode.
     */
    const heleNavnet = new RegExp(`${treff[0]}(?![a-zA-Z0-9-])`)

    krev(
      heleNavnet.test(tokens),
      `${sti} nevner ${treff[0]}, som ikke finnes i tokens.css`,
    )
    sjekkedeTokens += 1
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
    const naken = /from\s*\n?\s*"@fristil\/designsystem/.test(blokk[1])
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
if (sjekkedeBlokker === 0) utilstrekkelig.push("ingen markupblokker")

/*
 * Hver regelbok skal ha minst én markupblokk som ble lest, med ett unntak som
 * står skrevet her framfor å være stille: react-regelboka har ingen. Markupen
 * der er JSX, og den leses ikke av diagnostikken. Den er dekket av
 * klasse-, element-, sti- og tokensjekkene som de andre, men ikke av denne.
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
  `Regelbøkene stemmer: ${sjekkedeFiler} filer, ${sjekkedeKlasser} klassepåstander, ${sjekkedeElementer} elementpåstander, ${sjekkedeTokens} tokennavn og ${sjekkedeBlokker} markupblokker.`,
)
