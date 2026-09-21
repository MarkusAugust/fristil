#!/usr/bin/env node
/// <reference types="node" />
/**
 * Kommandolinja til Fristil, med to kommandoer.
 *
 * `fristil overta <komponent>` kopierer kildekoden til én komponent inn i
 * prosjektet ditt, når tilpasning gjennom CSS ikke strekker til. Regnestykket
 * ligger i `takeover.ts`.
 *
 * `fristil tema` lager et fargetema av merkefargene dine.
 *
 * ```bash
 * npx @fristil/designsystem tema --interaktiv=#7c3aed --fare=#b3261e \
 *   --suksess=#2b6940 --advarsel=#8a5a00 --noytral=#1a1a1a --ut=tema.css
 * ```
 *
 * Eller med en fil:
 *
 * ```bash
 * npx @fristil/designsystem tema fristil.tema.json --ut=tema.css
 * ```
 *
 * Dette er den eneste fila i pakken som kjører utenfor nettleseren, og derfor
 * den eneste som viser til Node-typene.
 *
 * Generatoren bygger skalaene, setter de semantiske verdiene og flytter
 * lysheten på dem som ikke holder kontrastkravet. Hver justering skrives ut,
 * så du ser hva som ble endret. Holder et par likevel ikke, avsluttes
 * kjøringen med feil framfor å levere et tema som ser riktig ut.
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
import { buildTheme, type ThemeInput } from "./tokens/theme.js"

const NØKLER: Record<string, keyof ThemeInput> = {
  interaktiv: "interactive",
  fare: "danger",
  suksess: "success",
  advarsel: "warning",
  noytral: "neutral",
  besokt: "visited",
}

function lesArgumenter(argumenter: string[]) {
  const flagg: Record<string, string> = {}
  const filer: string[] = []

  for (const del of argumenter) {
    const treff = /^--([a-zæøå]+)=(.+)$/.exec(del)
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
async function overta(argumenter: string[]): Promise<void> {
  const { flagg, filer } = lesArgumenter(argumenter)
  const komponenter = await finnKomponenter()
  const navn = filer[0]

  if (!navn || !komponenter.has(navn)) {
    console.error(
      (navn ? `Fant ingen komponent som heter «${navn}».\n\n` : "") +
        `Bruk: fristil overta <komponent> [--ut=<mappe>]\n\n` +
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

const argumenter = process.argv.slice(2)

if (argumenter[0] === "overta") {
  await overta(argumenter.slice(1))
  process.exit(0)
}

// `tema` kan stå først, siden kommandoen kjøres som
// `npx @fristil/designsystem tema`.
const { flagg, filer } = lesArgumenter(
  argumenter[0] === "tema" ? argumenter.slice(1) : argumenter,
)

const fraFil = filer[0]
  ? (JSON.parse(await readFile(filer[0], "utf8")) as Record<string, string>)
  : {}

const input: Partial<ThemeInput> = {}
for (const [norsk, engelsk] of Object.entries(NØKLER)) {
  const verdi = flagg[norsk] ?? fraFil[norsk] ?? fraFil[engelsk]
  if (verdi) input[engelsk] = verdi
}

const påkrevd: (keyof ThemeInput)[] = [
  "interactive",
  "danger",
  "success",
  "warning",
]
const mangler = påkrevd.filter((navn) => !input[navn])

if (mangler.length > 0) {
  const norske = mangler.map(
    (navn) =>
      Object.entries(NØKLER).find(([, engelsk]) => engelsk === navn)?.[0] ??
      navn,
  )
  console.error(
    `Mangler farger: ${norske.join(", ")}\n\n` +
      "Eksempel:\n  npx @fristil/designsystem tema --interaktiv=#7c3aed" +
      " --fare=#b3261e --suksess=#2b6940 --advarsel=#8a5a00\n",
  )
  process.exit(1)
}

let tema: ReturnType<typeof buildTheme>

try {
  tema = buildTheme(input as ThemeInput)
} catch (grunn) {
  // Som regel en farge som ikke er en farge. Et stakkspor sier ingenting om
  // hva brukeren skrev feil.
  console.error(
    `\n${grunn instanceof Error ? grunn.message : String(grunn)}\n\n` +
      "Fargene skrives som heksadesimale verdier, for eksempel #7c3aed.\n",
  )
  process.exit(1)
}

for (const justering of tema.adjustments) {
  console.error(
    `  justert ${justering.token} i ${justering.theme} tema: ` +
      `${justering.before.toFixed(2)}:1 ble ${justering.after.toFixed(2)}:1`,
  )
}

if (tema.problems.length > 0) {
  console.error(
    `\nTemaet holder ikke kontrastkravet:\n\n${tema.problems
      .map((linje) => `  ${linje}`)
      .join("\n")}\n\nVelg en mørkere eller lysere merkefarge.\n`,
  )
  process.exit(1)
}

const ut = flagg.ut

if (ut) {
  await writeFile(ut, tema.css)
  console.error(
    `\nSkrev ${ut}. ${tema.adjustments.length} verdier ble justert for å holde kontrastkravet.`,
  )
} else {
  console.log(tema.css)
}
