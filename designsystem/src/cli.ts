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
import {
  buildTheme,
  type ThemeInput,
  type ThemeShape,
  type ThemeTypography,
} from "./tokens/theme.js"

const NØKLER: Record<string, keyof ThemeInput> = {
  interaktiv: "interactive",
  fare: "danger",
  suksess: "success",
  advarsel: "warning",
  noytral: "neutral",
  besokt: "visited",
}

/**
 * Skrift og form, som flagg.
 *
 * Fargene er påkrevd, disse er ikke. Utelates de, står Fristils egen
 * typografi og form, og temaet endrer bare farger, slik det gjorde før disse
 * kom til.
 */
const SKRIFTFLAGG: Record<string, "fontFamily"> = {
  skrift: "fontFamily",
}

const FORMFLAGG: Record<string, keyof ThemeShape> = {
  "knapp-hjorner": "buttonRadius",
  "felt-hjorner": "fieldRadius",
  "flate-hjorner": "surfaceRadius",
  "knapp-ramme": "buttonBorderWidth",
  "knapp-vekt": "buttonFontWeight",
}

function lesArgumenter(argumenter: string[]) {
  const flagg: Record<string, string> = {}
  const filer: string[] = []

  for (const del of argumenter) {
    // Bindestrek er med i navnet: flagg som `--knapp-hjorner` leses ellers
    // som en fil, og temaet fikk da runde hjørner uten at noen ba om det.
    const treff = /^--([a-zæøå-]+)=(.+)$/.exec(del)
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

/** Det kommandoen kan, skrevet ut på én skjerm. */
const HJELP = `fristil <kommando>

  overta <komponent>   Kopierer kildekoden til én komponent inn i prosjektet
    --ut=<mappe>       Hvor kopien skal ligge. Standard: src/fristil
    --overskriv=ja     Skriv over en kopi som finnes fra før

  tema                 Lager et tema av merkefargene, skriften og formen din
    --interaktiv=<farge>  Lenker, knapper og fokus (påkrevd med farger)
    --fare=<farge>        Feil og sletting (påkrevd)
    --suksess=<farge>     Bekreftelser (påkrevd)
    --advarsel=<farge>    Advarsler (påkrevd)
    --noytral=<farge>     Tekst og flater
    --besokt=<farge>      Besøkte lenker
    --skrift=<stakk>      Skriftstakken temaet skal bruke
    --knapp-hjorner=<mål> Hjørner på knapp, paginering og hopplenke
    --felt-hjorner=<mål>  Hjørner på felt, tekstområde og nedtrekksliste
    --flate-hjorner=<mål> Hjørner på kort, dialog, sprettoppvindu, varsel,
                          trekkspill, feiloppsummering, filopplasting,
                          økttidsavbrudd, forslagsliste, melding og hjelpeboble
    --knapp-ramme=<mål>   Rammetykkelsen på knappen
    --knapp-vekt=<vekt>   Vekten på knappeteksten
    --ut=<fil>            Skriv til fil i stedet for til utdata

Fargene skrives heksadesimalt, for eksempel #7c3aed. Temaet kan også leses
fra en JSON-fil: fristil tema fristil.tema.json

Eksempler:
  npx @fristil/designsystem overta button --ut=src/ui
  npx @fristil/designsystem tema --interaktiv=#7c3aed --fare=#b3261e \
    --suksess=#2b6940 --advarsel=#8a5a00 --ut=tema.css
`

const HJELPEFLAGG = new Set(["--help", "-h", "help", "hjelp", "--hjelp"])
const KOMMANDOER = new Set(["overta", "tema"])

const argumenter = process.argv.slice(2)

// Uten argumenter, eller når noen ber om hjelp, skal kommandoen fortelle hva
// den kan. Før sto den rett inn i temakommandoen og klaget over manglende
// farger, uten å nevne at «overta» fantes.
if (argumenter.length === 0 || HJELPEFLAGG.has(argumenter[0])) {
  console.log(HJELP)
  process.exit(0)
}

// En ukjent kommando ble lest som et filnavn, og ga et stakkspor fra Node.
if (!KOMMANDOER.has(argumenter[0]) && !argumenter[0].startsWith("--")) {
  console.error(`Ukjent kommando «${argumenter[0]}».\n\n${HJELP}`)
  process.exit(1)
}

if (argumenter[0] === "overta") {
  await overta(argumenter.slice(1))
  process.exit(0)
}

// `tema` kan stå først, siden kommandoen kjøres som
// `npx @fristil/designsystem tema`.
const { flagg, filer } = lesArgumenter(
  argumenter[0] === "tema" ? argumenter.slice(1) : argumenter,
)

async function lesTemafil(sti: string): Promise<Record<string, unknown>> {
  let innhold: string

  try {
    innhold = await readFile(sti, "utf8")
  } catch {
    console.error(
      `Fant ikke fila «${sti}».\n\n` +
        "Oppgi en JSON-fil med fargene, eller sett dem som flagg. " +
        "Se `fristil --hjelp`.\n",
    )
    process.exit(1)
  }

  try {
    return JSON.parse(innhold) as Record<string, unknown>
  } catch (grunn) {
    console.error(
      `«${sti}» er ikke gyldig JSON: ${grunn instanceof Error ? grunn.message : String(grunn)}\n`,
    )
    process.exit(1)
  }
}

const fraFil = filer[0] ? await lesTemafil(filer[0]) : {}

const input: Partial<ThemeInput> = {}
for (const [norsk, engelsk] of Object.entries(NØKLER)) {
  const verdi = flagg[norsk] ?? fraFil[norsk] ?? fraFil[engelsk]
  if (typeof verdi === "string" && verdi) input[engelsk] = verdi
}

/*
 * Skrift og form kan komme fra fila eller fra flagg, og flagget vinner.
 * Fila kan skrive dem på norsk eller engelsk, som fargene.
 */
const typografi: ThemeTypography = {
  ...((fraFil.typography ?? fraFil.typografi ?? {}) as ThemeTypography),
}
for (const [norsk, engelsk] of Object.entries(SKRIFTFLAGG)) {
  if (flagg[norsk]) typografi[engelsk] = flagg[norsk]
}

const form: ThemeShape = {
  ...((fraFil.shape ?? fraFil.form ?? {}) as ThemeShape),
}
for (const [norsk, engelsk] of Object.entries(FORMFLAGG)) {
  if (flagg[norsk]) form[engelsk] = flagg[norsk]
}

if (Object.keys(typografi).length > 0) input.typography = typografi
if (Object.keys(form).length > 0) input.shape = form

/*
 * Et flagg som ikke finnes skal si fra.
 *
 * `--knapp-hjørner` med ø er den naturlige norske stavemåten, mens flagget
 * heter `hjorner`. Den gikk stille gjennom, og temaet kom ut uten hjørnet og
 * uten et ord om hvorfor. CLI-en har allerede «Ukjent kommando» for den samme
 * klassen feil.
 */
const KJENTE_FLAGG = new Set([
  ...Object.keys(NØKLER),
  ...Object.keys(SKRIFTFLAGG),
  ...Object.keys(FORMFLAGG),
  "ut",
])

const ukjente = Object.keys(flagg).filter((navn) => !KJENTE_FLAGG.has(navn))

if (ukjente.length > 0) {
  console.error(
    `Ukjent flagg: ${ukjente.map((navn) => `--${navn}`).join(", ")}\n\n` +
      `Kjente flagg: ${[...KJENTE_FLAGG].map((navn) => `--${navn}`).join(", ")}\n\n` +
      "Hele oversikten: fristil --hjelp\n",
  )
  process.exit(1)
}

const påkrevd: (keyof ThemeInput)[] = [
  "interactive",
  "danger",
  "success",
  "warning",
]
const mangler = påkrevd.filter((navn) => !input[navn])

/*
 * Fargene er påkrevd, med ett unntak: et tema som bare setter skrift og form.
 *
 * Det er ikke en kuriositet. Bruker organisasjonen allerede Fristils palett,
 * er det nettopp skriften og hjørnene som skiller, og å kjøre fargene gjennom
 * generatoren ville da flyttet dem bort fra der de skal være.
 */
const bareSkriftOgForm =
  mangler.length === påkrevd.length && (input.typography || input.shape)

if (mangler.length > 0 && !bareSkriftOgForm) {
  const norske = mangler.map(
    (navn) =>
      Object.entries(NØKLER).find(([, engelsk]) => engelsk === navn)?.[0] ??
      navn,
  )
  console.error(
    `Mangler farger: ${norske.join(", ")}\n\n` +
      "Eksempel:\n  npx @fristil/designsystem tema --interaktiv=#7c3aed" +
      " --fare=#b3261e --suksess=#2b6940 --advarsel=#8a5a00\n\n" +
      "Vil du bare sette skrift og form, og la fargene stå: utelat alle " +
      "fire, og oppgi minst én av --skrift, --knapp-hjorner, --felt-hjorner, " +
      "--flate-hjorner, --knapp-ramme eller --knapp-vekt.\n\n" +
      "Hele oversikten: fristil --hjelp\n",
  )
  process.exit(1)
}

let tema: ReturnType<typeof buildTheme>

try {
  tema = buildTheme(input as ThemeInput)
} catch (grunn) {
  /*
   * Et stakkspor sier ingenting om hva brukeren skrev feil.
   *
   * Hintet om heksadesimale farger står bare når feilen faktisk handler om en
   * farge. Sto det alltid, pekte det bort fra en verdi som ble avvist fordi
   * den kunne bryte ut av CSS-regelen.
   */
  const melding = grunn instanceof Error ? grunn.message : String(grunn)
  const omFarger = !melding.includes("CSS-regel")

  console.error(
    `\n${melding}\n` +
      (omFarger
        ? "\nFargene skrives som heksadesimale verdier, for eksempel #7c3aed.\n"
        : ""),
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
