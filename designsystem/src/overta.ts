/// <reference types="node" />
/**
 * `fristil overta <komponent>`: kopierer kildekoden til én komponent inn i
 * prosjektet, når tilpasning gjennom CSS ikke strekker til. Regnestykket
 * ligger i `takeover.ts`.
 *
 * De andre kommandoene er skrevet i Rust og kjøres som WASI-modul av
 * `cli.ts`. Denne flyttes dit også, når kopien får sitt eget navn.
 */

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  buildEntryPoints,
  type PackageExports,
  planTakeover,
  type SourceFile,
} from "./takeover.js"

function lesArgumenter(argumenter: string[]) {
  const flagg: Record<string, string> = {}
  const filer: string[] = []

  for (const del of argumenter) {
    // Bindestrek er med i navnet: flagg som `--knapp-hjorner` leses ellers
    // som en fil, og temaet fikk da runde hjørner uten at noen ba om det.
    // Sifre også: `--merke1` ble lest som et filnavn.
    const treff = /^--([a-zæøå0-9-]+)=(.+)$/.exec(del)
    if (treff) flagg[treff[1]] = treff[2]
    else filer.push(del)
  }

  return { flagg, filer }
}

/**
 * Pakkas egen rot, enten CLI-en kjøres fra `dist` eller fra kilden.
 *
 * `fileURLToPath`, ikke `pathname`: på Windows gir `pathname` en sti som
 * begynner med skråstrek foran stasjonsbokstaven, og mellomrom i stien står
 * fortsatt som `%20`. Da finner ikke kommandoen sine egne filer.
 */
const PAKKEROT = fileURLToPath(new URL("../", import.meta.url))

/** Mappene komponentene ligger i, med kategorien som navn. */
const KATEGORIER = ["css", "ramme", "frittstaende"] as const

async function finnKomponenter(): Promise<Map<string, string>> {
  const komponenter = new Map<string, string>()

  for (const kategori of KATEGORIER) {
    const mappe = `src/components/${kategori}`
    let innhold: string[]

    try {
      innhold = await readdir(join(PAKKEROT, mappe))
    } catch {
      continue
    }

    for (const navn of innhold) {
      const sti = `${mappe}/${navn}`
      if ((await stat(join(PAKKEROT, sti))).isDirectory()) {
        komponenter.set(navn, sti)
      }
    }
  }

  return komponenter
}

/**
 * Kopierer kildekoden til én komponent inn i prosjektet.
 *
 * Kopien er din fra det øyeblikket den er skrevet. Kommandoen sier derfor
 * fra om det, og skriver ikke over noe som allerede ligger der uten at du ber
 * om det.
 */
export async function overta(argumenter: string[]): Promise<void> {
  const { flagg, filer } = lesArgumenter(argumenter)
  const komponenter = await finnKomponenter()
  const navn = filer[0]

  // Som i `agent`: `--ut src/ui` uten likhetstegn ble lest som to filnavn,
  // og kopien havnet stille i standardmappa.
  const withoutValue = filer.find((del) => del.startsWith("--"))
  if (withoutValue) {
    console.error(
      `«${withoutValue}» mangler en verdi.\n\n` +
        `Skriv ${withoutValue}=<verdi>, med likhetstegn og uten mellomrom.\n`,
    )
    process.exit(1)
  }

  if (!navn || !komponenter.has(navn)) {
    console.error(
      (navn ? `Fant ingen komponent som heter «${navn}».\n\n` : "") +
        `Bruk: fristil overta <komponent> [--ut=<mappe>]\n` +
        `Hele oversikten: fristil --hjelp\n\n` +
        `Komponenter:\n  ${[...komponenter.keys()].sort().join(", ")}\n`,
    )
    process.exit(1)
  }

  const kilde = komponenter.get(navn) as string
  const utmappe = join(flagg.ut ?? "src/fristil", navn)

  const finnes = await stat(utmappe).then(
    () => true,
    () => false,
  )
  if (finnes && flagg.overskriv !== "ja") {
    console.error(
      `${utmappe} finnes allerede.\n\n` +
        "Har du endret kopien, blir endringene borte. Kjør med " +
        "--overskriv=ja hvis den skal erstattes.\n",
    )
    process.exit(1)
  }

  const pakke = JSON.parse(
    await readFile(join(PAKKEROT, "package.json"), "utf8"),
  ) as { name: string; exports: PackageExports }

  const filnavn = (await readdir(join(PAKKEROT, kilde))).filter(
    // Testene hører til pakkens eget oppsett, og sier ingenting her.
    (fil) => !fil.includes(".test."),
  )

  const kildefiler: SourceFile[] = await Promise.all(
    filnavn.map(async (fil) => ({
      path: `${kilde}/${fil}`,
      content: await readFile(join(PAKKEROT, kilde, fil), "utf8"),
    })),
  )

  const plan = planTakeover(
    kildefiler,
    buildEntryPoints(pakke.name, pakke.exports),
  )

  await mkdir(utmappe, { recursive: true })
  for (const fil of plan.files) {
    await writeFile(join(utmappe, fil.name), fil.content)
  }

  const linjer = [
    `Kopierte ${navn} til ${utmappe}/`,
    ...plan.files.map((fil) => `  ${fil.name}`),
    "",
    `Komponenten er nå din. Oppdateringer av ${pakke.name} rører den ikke.`,
  ]

  const omskrevet = plan.files.flatMap((fil) => fil.rewrites)
  if (omskrevet.length > 0) {
    linjer.push(
      "",
      "Henvisninger ut av mappa peker nå på pakken:",
      ...omskrevet.map((endring) => `  ${endring.from} → ${endring.to}`),
    )
  }

  if (plan.replacedEntries.length > 0) {
    linjer.push(
      "",
      "Bytt ut disse importene med kopien:",
      ...plan.replacedEntries.map((entry) => `  ${entry}`),
      "Klassenavnene er de samme. Blir importene stående ved siden av",
      "kopien, finnes komponenten to ganger, og hvilken som vinner avgjøres",
      "av rekkefølgen.",
    )
  }

  if (plan.dependencies.length > 0) {
    linjer.push(
      "",
      `Kopien trenger ${plan.dependencies.join(", ")} i prosjektet ditt.`,
    )
  }

  console.error(`${linjer.join("\n")}\n`)
}
