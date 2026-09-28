/**
 * At ordene vi har bestemt oss for, er de som står i repoet.
 *
 * Terminologi glir. «Bunter» sto 22 steder i sju filer, i kommentarer, i
 * versjonsloggen, i en konstant og i brødteksten på dokumentasjonssiden, og
 * hver ny tekst kopierte ordbruken fra den forrige. En beslutning uten vaktpost
 * er en beslutning som må tas på nytt hver gang noen skriver et avsnitt.
 *
 * Lista er ment å vokse. Ett ord per rad, med det vi sier i stedet, og en
 * setning om hvorfor der det ikke er åpenbart.
 *
 * Kjør med: bun scripts/sjekk-ordbruk.ts, eller som en del av `bun run build`.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROT = fileURLToPath(new URL("../../", import.meta.url))

/** Ord vi ikke bruker, og hva vi sier i stedet. */
const FORBUDT: { mønster: RegExp; i_stedet: string }[] = [
  {
    // Norsk bøyning av «bundle» gir «bunter», «buntere» og «bunting», og alle
    // tre sto i repoet samtidig. Vi sier bundle eller bundles, uten bøyning.
    /*
     * Bøyningslista sto skrevet ut, med «ene» to ganger og uten «en». Den
     * bestemte formen «bunten» sto fem steder i sporet kode mens vakten meldte
     * grønt. En liste over bøyninger er nettopp det som glipper, så stammen
     * med en hvilken som helst endelse er riktigere her.
     */
    mønster: /\bbunt[a-zæøå]*\b/gi,
    i_stedet: "bundle eller bundles",
  },
  {
    /*
     * Tankestrek er et engelsk skrivemønster, og lite vanlig i norsk sakprosa.
     * Den kom inn 111 steder på én dag, i kommentarer, i versjonsloggen og i
     * regelbøkene, fordi den er lett å skrive og aldri ser feil ut i en enkelt
     * setning. Del setningen i to, eller bruk komma, kolon eller parentes.
     *
     * Regelen dekker både em- og en-strek. En tom celle i en tabell skrives
     * «ingen» framfor med en strek, som er tydeligere uansett.
     */
    mønster: /[—–]/g,
    i_stedet: "komma, kolon, parentes eller to setninger",
  },
]

/*
 * Filtypene teksten vår står i. Genererte filer leses ikke: retter du ordet i
 * kilden, følger de etter, og en feil på begge steder er samme feil to ganger.
 */
const MØNSTRE = [
  "**/*.ts",
  "**/*.mjs",
  "**/*.mdx",
  "**/*.md",
  "**/*.astro",
  "**/*.css",
  "**/*.html",
]

const HOPP_OVER = [
  "node_modules/",
  "/dist/",
  "dist/",
  ".astro/",
  // Fila du leser nå, som må kunne skrive ordet for å lete etter det.
  "scripts/sjekk-ordbruk.ts",
  // Generert av generate-agent.ts; kilden er oppskriftene der.
  "designsystem/agent/",
  // Generert fra tokens.ts.
  "designsystem/src/tokens/tokens.css",
]

const funn: string[] = []

// Teller sist i løkka, slik at et mønster som ikke treffer noe blir synlig
// framfor å se ut som en ren kjøring.
let leste = 0

for (const mønster of MØNSTRE) {
  for (const rel of new Glob(mønster).scanSync(ROT)) {
    if (HOPP_OVER.some((del) => rel.includes(del))) continue

    const tekst = readFileSync(ROT + rel, "utf8")
    leste += 1

    for (const { mønster: ord, i_stedet } of FORBUDT) {
      for (const treff of tekst.matchAll(ord)) {
        const linje = tekst.slice(0, treff.index).split("\n").length
        funn.push(`${rel}:${linje} skriver «${treff[0]}». Vi sier ${i_stedet}.`)
      }
    }
  }
}

if (funn.length > 0) {
  console.error(
    `Ordbruken er ikke den vi har bestemt:\n\n${funn
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

if (leste === 0) {
  console.error("Ordbrukssjekken leste ingen filer. Stemmer MØNSTRE?\n")
  process.exit(1)
}

console.log(`Ordbruken stemmer: ${FORBUDT.length} ord voktet i ${leste} filer.`)
