/**
 * Kontrollerer kommandolinjeverktøyet, slik en konsument kjører det.
 *
 * `bun run test` kjører i nettleseren, og `tsc` leser bare typene. Flagg som
 * ikke leses, en fil som ikke skrives, eller en feil som avslutter med kode
 * null ville derfor gått rett gjennom. Her kjøres den bygde fila i en egen
 * prosess, som er det en konsument faktisk får.
 *
 * Kjør med: bun scripts/sjekk-cli.ts, eller som en del av `bun run build`.
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const pakke = fileURLToPath(new URL("../", import.meta.url))
const cli = join(pakke, "dist/cli.js")

const FARGER = [
  "--interaktiv=#7c3aed",
  "--fare=#b3261e",
  "--suksess=#2b6940",
  "--advarsel=#8a5a00",
]

type Kjøring = { kode: number; ut: string; feil: string }

let antallKjøringer = 0

async function kjør(argumenter: string[]): Promise<Kjøring> {
  antallKjøringer += 1

  const prosess = Bun.spawn(["node", cli, ...argumenter], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [ut, feil, kode] = await Promise.all([
    new Response(prosess.stdout).text(),
    new Response(prosess.stderr).text(),
    prosess.exited,
  ])

  return { kode, ut, feil }
}

const feil: string[] = []

function krev(påstand: boolean, beskrivelse: string): void {
  if (!påstand) feil.push(beskrivelse)
}

// Skriver temaet til utdata når ingen fil er oppgitt
{
  const { kode, ut } = await kjør(["tema", ...FARGER])

  krev(kode === 0, `tema med alle farger avsluttet med kode ${kode}`)
  krev(
    ut.includes("--semantic-interactive-main"),
    "utdata mangler de semantiske verdiene",
  )
  krev(ut.includes('[data-theme="dark"]'), "utdata mangler mørkt tema")
}

// Skriver til fil når --ut er med, og lar utdata være tom
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-cli-"))
  const sti = join(mappe, "tema.css")

  const { kode, ut } = await kjør(["tema", ...FARGER, `--ut=${sti}`])
  const innhold = await readFile(sti, "utf8")

  krev(kode === 0, `skriving til fil avsluttet med kode ${kode}`)
  krev(ut.trim() === "", "utdata skulle vært tom når temaet skrives til fil")
  krev(innhold.includes("@layer fristil"), "fila mangler laget")

  await rm(mappe, { recursive: true, force: true })
}

// Leser fargene fra en JSON-fil
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-cli-"))
  const sti = join(mappe, "fristil.tema.json")
  await writeFile(
    sti,
    JSON.stringify({
      interaktiv: "#0f766e",
      fare: "#9f1239",
      suksess: "#15803d",
      advarsel: "#a16207",
    }),
  )

  const { kode, ut } = await kjør(["tema", sti])

  krev(kode === 0, `lesing fra fil avsluttet med kode ${kode}`)
  krev(ut.includes("--palette-interactive-70"), "utdata mangler paletten")

  await rm(mappe, { recursive: true, force: true })
}

// Sier fra når farger mangler, og avslutter med feil
{
  const { kode, feil: melding } = await kjør(["tema", "--interaktiv=#7c3aed"])

  krev(kode !== 0, "manglende farger skulle gitt en feilkode")
  krev(
    melding.includes("fare") && melding.includes("suksess"),
    "feilmeldingen sier ikke hvilke farger som mangler",
  )
}

// Sier fra på en lesbar måte når en farge ikke er en farge
{
  const { kode, feil: melding } = await kjør([
    "tema",
    "--interaktiv=lilla",
    "--fare=#b3261e",
    "--suksess=#2b6940",
    "--advarsel=#8a5a00",
  ])

  krev(kode !== 0, "ugyldig farge skulle gitt en feilkode")
  krev(
    melding.includes("lilla"),
    `feilmeldingen nevner ikke verdien som var feil: ${melding.slice(0, 120)}`,
  )
  krev(
    !melding.includes("at buildTheme"),
    "feilmeldingen viser et stakkspor framfor å si hva som er galt",
  )
}

/**
 * Hver komponent skal kunne overtas, og kopien skal ikke peke i løse lufta.
 *
 * Omskrivingen bytter en relativ sti med inngangspunktet i `exports`, men
 * bare når inngangspunktet finnes. Gjør det ikke det, blir stien stående som
 * den er, og kopien peker på en mappe som ikke finnes hos konsumenten. Det
 * er skrevet ned som en fare i CLAUDE.md, uten at noe har sjekket det.
 *
 * Her overtas hver komponent verktøyet selv lister opp, og hver henvisning
 * ut av mappa kontrolleres mot `exports` i pakken.
 */
{
  const eksport = new Set(
    Object.keys(
      (
        JSON.parse(await readFile(join(pakke, "package.json"), "utf8")) as {
          exports: Record<string, unknown>
        }
      ).exports,
    ),
  )

  const liste = await kjør(["overta"])
  const navnene = (liste.feil + liste.ut)
    .split("Komponenter:")[1]
    ?.split("\n")[1]
    ?.split(",")
    .map((navn) => navn.trim())
    .filter(Boolean)

  krev(
    (navnene?.length ?? 0) > 10,
    `fant bare ${navnene?.length ?? 0} komponenter å overta`,
  )

  const mappe = await mkdtemp(join(tmpdir(), "fristil-overta-"))

  for (const navn of navnene ?? []) {
    const { kode } = await kjør(["overta", navn, `--ut=${join(mappe, navn)}`])
    krev(kode === 0, `overta ${navn} avsluttet med kode ${kode}`)

    const kopimappe = join(mappe, navn, navn)
    for (const fil of await readdir(kopimappe)) {
      const innhold = await readFile(join(kopimappe, fil), "utf8")

      for (const treff of innhold.matchAll(
        /(?:from|@import)\s+["']([^"']+)["']/g,
      )) {
        const sti = treff[1] as string

        krev(
          !sti.startsWith("../"),
          `${navn}/${fil} peker ut av mappa med «${sti}», som ikke finnes hos konsumenten`,
        )

        if (!sti.startsWith("@fristil/designsystem")) continue

        const under = `.${sti.slice("@fristil/designsystem".length)}`
        krev(
          eksport.has(under),
          `${navn}/${fil} peker på «${sti}», som ikke står i exports`,
        )
      }
    }
  }

  await rm(mappe, { recursive: true, force: true })
}

// Overtar en komponent, og skriver om henvisningene ut av mappa
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-cli-"))

  const { kode, feil: melding } = await kjør([
    "overta",
    "button",
    `--ut=${join(mappe, "ui")}`,
  ])

  const filer = await readdir(join(mappe, "ui/button"))
  const kilde = await readFile(join(mappe, "ui/button/button.ts"), "utf8")

  krev(kode === 0, `overta button avsluttet med kode ${kode}`)
  krev(
    filer.includes("button.ts") && filer.includes("button.css"),
    `kopien mangler filer: ${filer.join(", ")}`,
  )
  krev(!filer.some((fil) => fil.includes(".test.")), "testene ble med i kopien")
  krev(
    kilde.includes('from "@fristil/designsystem/shared"'),
    "henvisningen ut av mappa ble ikke skrevet om",
  )
  krev(
    melding.includes("er nå din"),
    "utskriften sier ikke at kopien er konsumentens ansvar",
  )

  // Kopien skal ikke skrives over uten at det er bedt om.
  await writeFile(join(mappe, "ui/button/button.ts"), "// min egen versjon\n")
  const igjen = await kjør(["overta", "button", `--ut=${join(mappe, "ui")}`])
  const etterpå = await readFile(join(mappe, "ui/button/button.ts"), "utf8")

  krev(igjen.kode !== 0, "en kopi som finnes fra før ble skrevet over")
  krev(
    etterpå.startsWith("// min egen versjon"),
    "endringene i kopien gikk tapt",
  )

  const tvunget = await kjør([
    "overta",
    "button",
    `--ut=${join(mappe, "ui")}`,
    "--overskriv=ja",
  ])
  const erstattet = await readFile(join(mappe, "ui/button/button.ts"), "utf8")

  krev(tvunget.kode === 0, "--overskriv=ja virket ikke")
  krev(
    erstattet.includes("BUTTON_CLASS"),
    "kopien ble ikke erstattet med --overskriv=ja",
  )

  await rm(mappe, { recursive: true, force: true })
}

// Sier hvilke komponenter som finnes når navnet er ukjent
{
  const { kode, feil: melding } = await kjør(["overta", "knapp"])

  krev(kode !== 0, "et ukjent komponentnavn skulle gitt en feilkode")
  krev(
    melding.includes("knapp") && melding.includes("button"),
    "feilmeldingen lister ikke komponentene som finnes",
  )
}

// Skriver ut hjelpen uten argumenter, og når noen ber om den
for (const argumenter of [[], ["--hjelp"], ["--help"], ["-h"], ["help"]]) {
  const { kode, ut } = await kjør(argumenter)

  krev(
    kode === 0,
    `«${argumenter[0] ?? "uten argumenter"}» avsluttet med kode ${kode}`,
  )
  krev(
    ut.includes("overta") && ut.includes("tema"),
    `hjelpen nevner ikke begge kommandoene: ${ut.slice(0, 80)}`,
  )
}

// Sier fra om en ukjent kommando i stedet for å lese den som et filnavn
{
  const { kode, feil: melding } = await kjør(["bygg"])

  krev(kode !== 0, "en ukjent kommando skulle gitt en feilkode")
  krev(
    melding.includes("bygg") && !melding.includes("ENOENT"),
    `feilmeldingen er et stakkspor i stedet for en forklaring: ${melding.slice(0, 80)}`,
  )
}

// Sier fra om en temafil som ikke finnes, eller ikke er JSON
{
  const borte = await kjør(["tema", "finnes-ikke.json"])

  krev(borte.kode !== 0, "en temafil som ikke finnes skulle gitt en feilkode")
  krev(
    borte.feil.includes("finnes-ikke.json") && !borte.feil.includes("ENOENT"),
    `feilmeldingen er et stakkspor: ${borte.feil.slice(0, 80)}`,
  )

  const mappe = await mkdtemp(join(tmpdir(), "fristil-cli-"))
  const sti = join(mappe, "ugyldig.json")
  await writeFile(sti, "{ikke json")

  const ugyldig = await kjør(["tema", sti])

  krev(ugyldig.kode !== 0, "ugyldig JSON skulle gitt en feilkode")
  krev(
    ugyldig.feil.includes("JSON"),
    `feilmeldingen sier ikke at fila ikke er JSON: ${ugyldig.feil.slice(0, 80)}`,
  )

  await rm(mappe, { recursive: true, force: true })
}

if (feil.length > 0) {
  console.error(
    `Kommandolinjeverktøyet oppfører seg ikke som lovet:\n\n${feil
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Kommandolinjeverktøyet svarer som det skal på ${antallKjøringer} kjøringer.`,
)
