/**
 * At ordene vi har bestemt oss for, er de som står i repoet.
 *
 * Terminologi glir. Den norske bøyningen av «bundle» sto 26 steder i ni filer,
 * i kommentarer, i versjonsloggen, i en konstant og i brødteksten på fire
 * dokumentasjonssider, og hver ny tekst kopierte ordbruken fra den forrige. En
 * beslutning uten vaktpost er en beslutning som må tas på nytt hver gang noen
 * skriver et avsnitt.
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
const FORBUDT: { mønster: RegExp; i_stedet: string; unntatt?: RegExp }[] = [
  {
    /*
     * Vi sier bundle eller bundles, aldri en norsk bøyning av det.
     *
     * Første forsøk var en liste over bøyninger, og den bommet: den hadde
     * «ene» to ganger og manglet «en», så «bunten» sto i sporet kode mens
     * vakten meldte grønt. En liste over bøyninger er nettopp det som glipper.
     *
     * Mønsteret tar derfor stammen med hva som helst rundt, så `MED_BUNTER` og
     * `medBunter` også felles: en konstant var en av grunnene til at regelen
     * kom, og `\b` slår ikke til mot understrek eller en stor bokstav inni et
     * navn. Det gir ett falskt treff, `ubuntu-latest` i CI-oppsettet, og det
     * står i unntaket.
     *
     * `bundel` er med fordi den kom inn som erstatning for «bunten» og er
     * nøyaktig samme slags fornorsking. `bun[dt]` var for vidt: «bundet»,
     * «bundne» og «prosessorbundet» er vanlige norske ord av å binde, og har
     * ingenting med dette å gjøre.
     */
    mønster: /[\p{L}_]*(?:bunt|bundel)[\p{L}]*/giu,
    i_stedet: "bundle eller bundles",
    unntatt: /^ubuntu/i,
  },
  {
    /*
     * Det heter byggefunksjon. Regelbøkene for kodeagenter og
     * dokumentasjonssidene sier det samme om det samme systemet, og en agent
     * som får begge i konteksten skal ikke møte to navn på én ting.
     *
     * Bare de bøyde formene står i mønsteret. Verbet å bygge får aldri dem,
     * så «stilarkene bygger på den» og «generatoren bygger skalaene» går fri
     * uten en eneste unntaksrad. Et mønster på stammen ville felt dem, og
     * 0.22.0 loggførte nettopp den feilen: «generatoren byggefunksjon
     * skalaene». Formen «en bygger» i entall ubestemt kan derfor ikke voktes,
     * siden den er skrevet likt som verbet.
     *
     * `i`-flagget er ikke pynt: «Byggerne» med stor forbokstav sto i to
     * overskrifter i regelbøkene og slapp gjennom uten det.
     */
    mønster: /bygger(?:e|en|ne)\b/giu,
    i_stedet: "byggefunksjon",
  },
  {
    /*
     * Det heter web component. Ordet er engelsk, men det er navnet på
     * standarden, som «Shadow DOM», og leseren finner det igjen på MDN.
     *
     * Mellomrommet tåler linjeskift og kommentartegn, fordi kommentarene her
     * brekkes på 80 og uttrykket er på to ord. Tre forekomster sto delt over
     * to linjer og var usynlige for et mønster med bare mellomrom i.
     */
    mønster: /egendefiner\p{L}*[\s*/]{1,16}element\p{L}*/giu,
    i_stedet: "web component",
  },
  {
    /*
     * Tankestrek er et engelsk skrivemønster, og lite vanlig i norsk sakprosa.
     * Den kom inn over hundre steder på én dag, fordi den er lett å skrive og
     * aldri ser feil ut i en enkelt setning. Del setningen i to, eller bruk
     * komma, kolon eller parentes.
     */
    mønster: /[—–]/gu,
    i_stedet: "komma, kolon, parentes eller to setninger",
  },
]

/*
 * Filtypene teksten vår står i.
 *
 * Genererte filer leses ikke: retter du ordet i kilden, følger de etter, og en
 * feil på begge steder er samme feil to ganger. `.json` er ute av samme grunn,
 * siden de tre norske json-filene i repoet genereres av `editor/scripts/
 * generate.ts` fra `metadata.ts`, som leses. `.yml` og `.toml` er ikke med, og
 * det er et bevisst hull: der står det fire linjer norsk i alt.
 */
const MØNSTRE = [
  "designsystem/**/*.ts",
  "designsystem/**/*.css",
  "documentation/**/*.ts",
  "documentation/**/*.mjs",
  "documentation/**/*.mdx",
  "documentation/**/*.astro",
  "documentation/**/*.css",
  "editor/**/*.ts",
  "editor-intellij/**/*.kt",
  "editor-intellij/*.md",
  "presentasjon/**/*.html",
  "presentasjon/**/*.md",
  "*.md",
  // npm-forsiden. Den står ikke i rota, og var derfor den ene utsendte teksten
  // ingen leste. Versjonsloggen ved siden av er med vilje ute: den beskriver
  // hva som skjedde i en utgivelse, og skal ikke skrives om i ettertid.
  "designsystem/README.md",
]

const HOPP_OVER = [
  "node_modules/",
  "/dist/",
  "dist/",
  ".astro/",
  // Fila du leser nå, som må kunne skrive ordene for å lete etter dem.
  "scripts/sjekk-ordbruk.ts",
  // Ordlista over norske ord, av samme grunn: den må stave dem for å kjenne dem.
  "scripts/sjekk-identifikatorer.ts",
  // Gitignorert arbeidsnotat, ikke tekst vi sender ut.
  "PLAN.md",
  // Generert av generate-agent.ts; kilden er oppskriftene der.
  "designsystem/agent/",
  // Generert fra tokens.ts.
  "designsystem/src/tokens/tokens.css",
  // Generert av editor/scripts/generate.ts fra metadata.ts, som leses.
  "designsystem/src/diagnostics/classes.ts",
  "designsystem/src/diagnostics/elements.ts",
]

const funn: string[] = []

/*
 * Telles per mønster, sist i løkka, og hvert av dem må ha lest noe.
 *
 * Én sum over alle mønstrene skjulte det som betyr noe: en skrivefeil i ett av
 * dem, eller en flyttet dokumentasjonsmappe, ville tatt bort mesteparten av den
 * norske brødteksten mens tallet fortsatt var stort og kjøringen grønn.
 *
 * Derfor står det ett mønster per filtype, ikke flere endelser i samme klamme.
 * Etterprøvd: med `{ts,mjs,mdx,md,astro,css}` i ett mønster gikk `mdx` til
 * `mxd` uten at noe ble rødt, siden de andre endelsene fortsatt traff. Da leste
 * vakten 58 mdx-filer færre, altså mesteparten av brødteksten, og meldte grønt.
 */
const lest = new Map<string, number>()

for (const mønster of MØNSTRE) {
  let antall = 0

  for (const rel of new Glob(mønster).scanSync(ROT)) {
    if (HOPP_OVER.some((del) => rel.includes(del))) continue

    const tekst = readFileSync(ROT + rel, "utf8")

    for (const { mønster: ord, i_stedet, unntatt } of FORBUDT) {
      for (const treff of tekst.matchAll(ord)) {
        if (unntatt?.test(treff[0])) continue

        const linje = tekst.slice(0, treff.index).split("\n").length
        funn.push(`${rel}:${linje} skriver «${treff[0]}». Vi sier ${i_stedet}.`)
      }
    }

    antall += 1
  }

  lest.set(mønster, antall)
}

const tomme = [...lest].filter(([, antall]) => antall === 0)

if (tomme.length > 0) {
  console.error(
    `Disse mønstrene leste ingen filer, så de vokter ingenting:\n${tomme
      .map(([mønster]) => `  ${mønster}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

if (funn.length > 0) {
  console.error(
    `Ordbruken er ikke den vi har bestemt:\n\n${funn
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

const ialt = [...lest.values()].reduce((sum, antall) => sum + antall, 0)

console.log(
  `Ordbruken stemmer: ${FORBUDT.length} ord voktet i ${ialt} filer over ${lest.size} mønstre.`,
)
