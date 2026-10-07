/**
 * At regelbøkene også finnes på nettsiden, og at de er de samme.
 *
 * Kanalen finnes for agenten som ikke har `node_modules`: blir noen bedt om å
 * «lage et skjema med Fristil» i en tom mappe, skrives markupen før
 * `npm install` har kjørt. To kanaler med samme innhold er bare en fordel så
 * lenge de faktisk er like, og en rute som stille slutter å bygges ville ingen
 * lagt merke til før en agent hentet en 404.
 *
 * Kjør med: bun documentation/scripts/sjekk-agentkanal.ts
 * Krever at `documentation/dist` er bygd.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const PAKKEN = `${ROT}designsystem/agent/`
const SIDEN = `${ROT}documentation/dist/agent/`

const avvik: string[] = []

const bøker = readdirSync(PAKKEN).filter((fil) => fil.endsWith(".md"))

if (bøker.length === 0) avvik.push("designsystem/agent/ har ingen regelbøker")

for (const fil of bøker) {
  let påSiden: string | null = null

  try {
    påSiden = readFileSync(`${SIDEN}${fil}`, "utf8")
  } catch {
    avvik.push(
      `/agent/${fil} ble ikke bygd. Ruten er src/pages/agent/[navn].md.ts`,
    )
    continue
  }

  if (påSiden !== readFileSync(`${PAKKEN}${fil}`, "utf8"))
    avvik.push(`/agent/${fil} er ikke den samme som pakkens`)
}

/*
 * Bygget må være nyere enn rutene og enn regelbøkene.
 *
 * `test:docs` bygger ikke selv, og kan kjøres alene. Uten dette kunne en slettet
 * rute eller en endret regelbok passere på forrige bygg, som er nettopp den
 * kjøringen som ser grønn ut uten å ha sett på noe.
 */
const bygget = `${ROT}documentation/dist/llms.txt`
const kilder = [
  `${ROT}documentation/src/pages/llms.txt.ts`,
  `${ROT}documentation/src/pages/agent/[navn].md.ts`,
  ...bøker.map((fil) => `${PAKKEN}${fil}`),
]

try {
  const alder = statSync(bygget).mtimeMs
  const nyere = kilder.filter((kilde) => statSync(kilde).mtimeMs > alder)

  if (nyere.length > 0) {
    avvik.push(
      `documentation/dist er eldre enn ${nyere.length} av kildene. Kjør bun run build.`,
    )
  }
} catch {
  // Mangler bygget, meldes under.
}

// `llms.txt` er inngangen. Den skal nevne hver regelbok, og de fire reglene.
let llms = ""

try {
  llms = readFileSync(bygget, "utf8")
} catch {
  avvik.push("llms.txt ble ikke bygd. Ruten er src/pages/llms.txt.ts")
}

/*
 * En tom fil er ikke en fil som stemmer. Vilkåret sto som `llms !== ""`, og en
 * `llms.txt` på null byte ville da hoppet over hver innholdssjekk og meldt
 * grønt: et vilkår som slår av sjekken.
 */
if (llms.trim() === "") {
  avvik.push("llms.txt er tom")
} else {
  for (const fil of bøker) {
    if (!llms.includes(`/agent/${fil}`))
      avvik.push(`llms.txt lenker ikke til /agent/${fil}`)
  }

  for (const del of ["fs-modal", "var(--fs-color-", "defineFs", "sjekk"]) {
    if (!llms.includes(del)) avvik.push(`llms.txt nevner ikke ${del}`)
  }
}

/*
 * Sidelista i `llms.txt` kan forsvinne i stillhet.
 *
 * Den bygges av `getCollection("docs")`, og `seksjon()` gir tom streng på en
 * tom liste, som `.filter(Boolean)` fjerner. Blir samlingen tom, fordi den
 * omdøpes eller innholdsmappa flyttes, kommer `llms.txt` ut uten Veiledning,
 * Mønstre og Komponenter, og alt annet i denne vakten er fortsatt grønt.
 *
 * Antallet måles derfor mot en vanlig gjennomgang av innholdsmappa, altså en
 * annen mekanisme enn den som bygde lista.
 */
function tellSider(mappe: string): number {
  let antall = 0

  for (const oppf of readdirSync(mappe, { withFileTypes: true })) {
    if (oppf.isDirectory()) antall += tellSider(`${mappe}/${oppf.name}`)
    else if (/\.mdx?$/.test(oppf.name)) antall += 1
  }

  return antall
}

if (llms.trim() !== "") {
  const sider = tellSider(`${ROT}documentation/src/content/docs`)
  // Sidene lenkes til Markdown-utgaven, og regelbøkene under `/agent/` er ikke sider.
  const lenker = [
    ...llms.matchAll(/^- \[[^\]]+\]\((https:\/\/[^)]+\.md)\)/gm),
  ].filter(([, adresse]) => !adresse.includes("/agent/"))

  if (lenker.length !== sider) {
    avvik.push(
      `llms.txt lenker til ${lenker.length} sider, mens innholdsmappa har ${sider}.`,
    )
  }
}

if (avvik.length > 0) {
  console.error(
    `Kanalen til kodeagenter stemmer ikke:\n\n${avvik
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Regelbøkene finnes på nettsiden også: llms.txt og ${bøker.length} filer, like pakkens.`,
)
