#!/usr/bin/env node
/// <reference types="node" />
/**
 * Kommandolinja til Fristil, med fem kommandoer.
 *
 * `fristil overta <komponent>` kopierer kildekoden til én komponent inn i
 * prosjektet ditt, når tilpasning gjennom CSS ikke strekker til. Regnestykket
 * ligger i `takeover.ts`.
 *
 * `fristil tema` lager et fargetema av merkefargene dine.
 *
 * ```bash
 * npx @fristil/designsystem tema --aksent=#7c3aed --fare=#b3261e \
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
  diagnoseMarkup,
  diagnosePage,
  type Finding,
} from "./diagnostics/index.js"
import {
  buildEntryPoints,
  type PackageExports,
  planTakeover,
  type SourceFile,
} from "./takeover.js"
import type { Family } from "./tokens/matrix.js"
import {
  buildTheme,
  type ThemeInput,
  type ThemeShape,
  type ThemeTypography,
} from "./tokens/theme.js"
import { inspectTheme } from "./tokens/theme-check.js"

/**
 * Temaet slik det bygges opp, før det er kontrollert.
 *
 * Utledet framfor skrevet av: kommer det en ny familie i matrisen, er den med
 * her, og døpes en om, slutter `NØKLER` under å kompilere.
 */
type ThemeDraft = ThemeInput

/** Nøklene som tar en farge. */
type ColorKey = Family

const NØKLER: Record<string, ColorKey> = {
  aksent: "accent",
  fare: "danger",
  suksess: "success",
  advarsel: "warning",
  noytral: "neutral",
  besokt: "visited",
  merke1: "brand1",
  merke2: "brand2",
  merke3: "brand3",
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
async function overta(argumenter: string[]): Promise<void> {
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

/**
 * Regelbøkene i `agent/`, med miljøet hver av dem gjelder for.
 *
 * Kunnskapen følger pakken. En kodeagent leser derfor den samme regelboka som
 * versjonen i `node_modules`, og Fristil trenger ikke skrive en eneste fil i
 * konsumentens prosjekt for å nå den.
 */
const RULEBOOKS = new Map<string, string>([
  ["html", "agent/html.md"],
  ["maler", "agent/maler.md"],
  ["bundles", "agent/bundles.md"],
  ["react", "agent/react.md"],
  ["astro", "agent/astro.md"],
  ["datastar", "agent/datastar.md"],
])

/**
 * Rammeverk som deler regelbok, og navnet de peker på.
 *
 * Vue, Svelte, Solid og Lit gjør det samme på de tre tingene regelboka handler
 * om: stilarkene importeres i inngangsmodulen, attributtene heter det de heter
 * i HTML, og `defineFs*()` kjøres øverst i `main.ts`. Én tekst dekker dem, men
 * den som skriver `--rammeverk=svelte` skal ikke måtte vite det.
 */
const ALIASES = new Map<string, string>([
  ["vue", "bundles"],
  ["svelte", "bundles"],
  ["solid", "bundles"],
  ["solid-js", "bundles"],
  ["lit", "bundles"],
  ["vite", "bundles"],
])

/**
 * Avhengigheten som avgjør miljøet, i den rekkefølgen den leses.
 *
 * Astro står først: en Astro-app med React-øyer har begge i `package.json`, og
 * det er Astro som bestemmer hvordan stilarkene kommer inn. `vite` står sist,
 * siden et Vue- eller Svelte-prosjekt har den også, og da er rammeverket det
 * mer presise svaret.
 *
 * Datastar lastes oftest fra en CDN og står ikke i `package.json` i det hele
 * tatt, og SDK-en er bare for serveren. Treffet her er derfor et hint, ikke et
 * svar, og `--rammeverk=datastar` er den sikre veien.
 */
const DEPENDENCY_HINTS: [string, string][] = [
  ["astro", "astro"],
  ["react", "react"],
  ["vue", "bundles"],
  ["svelte", "bundles"],
  ["solid-js", "bundles"],
  ["lit", "bundles"],
  ["@starfederation/datastar-sdk", "datastar"],
  ["vite", "bundles"],
]

/** Miljøet prosjektet i arbeidsmappa bruker, og hvorfor vi tror det. */
async function detectFramework(): Promise<{ name: string; reason: string }> {
  let text: string

  try {
    text = await readFile("package.json", "utf8")
  } catch {
    // Go, Kotlin, PHP og Razor har ingen package.json. Da er markupen
    // serverens, og malregelboka er riktigere enn HTML-regelboka: den er den
    // eneste som forteller hvordan sjekken leser malsyntaks.
    return { name: "maler", reason: "ingen package.json i denne mappa" }
  }

  type Dependencies = Record<string, string> | undefined
  let manifest: { dependencies?: Dependencies; devDependencies?: Dependencies }

  try {
    const parsed: unknown = JSON.parse(text)

    // `null` er gyldig JSON, så `catch` fanget det ikke, og oppslaget på
    // `dependencies` ga et stakkspor fra Node.
    if (parsed === null || typeof parsed !== "object") {
      return { name: "maler", reason: "package.json er ikke et objekt" }
    }

    manifest = parsed
  } catch {
    return { name: "maler", reason: "package.json kunne ikke leses" }
  }

  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }

  for (const [dependency, framework] of DEPENDENCY_HINTS) {
    if (dependency in dependencies) {
      return { name: framework, reason: `${dependency} står i package.json` }
    }
  }

  // Det finnes en package.json, så det finnes et byggesteg. Da importeres
  // stilarkene, og `<link>`-regelboka ville sendt agenten feil vei.
  return {
    name: "bundles",
    reason: "package.json nevner ingen kjent rammeverk",
  }
}

/**
 * `fristil agent`: regelboka for dette prosjektet, til utdata.
 *
 * Til utdata, ikke til en fil. `AGENTS.md`, `CLAUDE.md` og
 * `.github/copilot-instructions.md` er konsumentens egne filer, og et verktøy
 * som skriver i dem må gjette stier, flette med innhold det ikke har skrevet,
 * og holde en kopi i takt med pakken. Ingen av de tre problemene finnes når
 * kunnskapen blir stående i pakken. Vil noen ha den på disk, er det ett rør
 * unna, og da er det deres beslutning.
 *
 * Valget av miljø skrives til feilkanalen, så utdata kan pipes rent samtidig
 * som valget er mulig å ettergå.
 */
async function agent(args: string[]): Promise<void> {
  // Flaggnavnet er norsk, som de andre flaggene i denne kommandoen.
  const { flagg: flags, filer: rest } = lesArgumenter(args)

  /*
   * `lesArgumenter` krever likhetstegn. `--rammeverk react` ble derfor lest som
   * to filnavn, deteksjonen overtok, og den som ba om React fikk bundles-boka
   * uten et ord om hvorfor.
   */
  const withoutValue = rest.find((part) => part.startsWith("--"))

  if (withoutValue) {
    console.error(
      `«${withoutValue}» mangler en verdi.\n\n` +
        `Skriv ${withoutValue}=<verdi>, med likhetstegn og uten mellomrom.\n`,
    )
    process.exit(1)
  }

  const requested = flags.rammeverk
  const chosen = requested
    ? { name: requested, reason: "oppgitt med --rammeverk" }
    : await detectFramework()

  const name = RULEBOOKS.has(chosen.name)
    ? chosen.name
    : ALIASES.get(chosen.name)
  const path = name ? RULEBOOKS.get(name) : undefined

  if (!path || !name) {
    console.error(
      `Kjenner ikke «${chosen.name}».\n\n` +
        `Velg mellom: ${[...RULEBOOKS.keys()].join(", ")}\n\n` +
        `Vue, Svelte, Solid og Lit deler «bundles», siden de gjør det samme med\n` +
        `stilarkene, attributtnavnene og registreringen.\n`,
    )
    process.exit(1)
  }

  // Aliaset skal være synlig: den som ba om «svelte» skal se at svaret er
  // bundles-regelboka, ellers ser det ut som flagget ble ignorert.
  const via = name === chosen.name ? "" : ` via ${chosen.name}`
  console.error(`Regelboka for ${name}${via} (${chosen.reason}).`)
  process.stdout.write(await readFile(join(PAKKEROT, path), "utf8"))
}

/**
 * `fristil sjekk <fil|adresse…>`: den samme sjekken som editoren kjører mens
 * du skriver, over ferdige filer. Uten filer leses standard inn, så en test
 * kan sende HTML-en serveren faktisk sender. Hvert funn skrives som
 * `fil:linje:kolonne: feil: melding`, som en kompilator, og ett funn er nok til
 * å avslutte med feil: en advarsel fra editoren er en feil i en mal ingen
 * kompilator ser på.
 *
 * En adresse hentes med `fetch` og sjekkes som en hel side: da kreves det i
 * tillegg at hver id det pekes på finnes, og at hvert felt er koblet. Det
 * samme gjør `--rendret` for filer og standard inn. En mal sjekkes ikke slik
 * uten flagget, siden en id i en mal kan stå i en annen fil.
 */
async function check(args: string[]): Promise<void> {
  const rendered = args.includes("--rendret")
  const paths = args.filter((arg) => arg !== "--rendret")
  const sources: Array<{ name: string; text: string; page: boolean }> = []
  const missing: string[] = []
  const unreachable: string[] = []

  if (paths.length > 0) {
    for (const path of paths) {
      if (/^https?:\/\//i.test(path)) {
        // Statuskoden leses: en 404-side er HTML, og uten dette ville den
        // blitt sjekket og kanskje meldt grønt uten at siden fantes.
        try {
          const response = await fetch(path)
          if (!response.ok) {
            unreachable.push(`${path} svarte ${response.status}.`)
            continue
          }
          // En sti som svarer JSON eller ren tekst, er ikke en side, og ville
          // ellers blitt meldt som ren markup.
          const type = response.headers.get("content-type") ?? ""
          if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
            unreachable.push(
              `${path} svarte med ${type || "ingen innholdstype"}, ikke HTML.`,
            )
            continue
          }
          sources.push({ name: path, text: await response.text(), page: true })
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          unreachable.push(`Fikk ikke kontakt med ${path}: ${reason}`)
        }
        continue
      }
      try {
        sources.push({
          name: path,
          text: await readFile(path, "utf8"),
          page: rendered,
        })
      } catch {
        missing.push(path)
      }
    }
  } else {
    if (process.stdin.isTTY) {
      console.error("Leser markup fra standard inn. Avslutt med Ctrl-D.")
    }
    // Strømmen, ikke `readFileSync(0)`. Å røre `process.stdin` setter et rør
    // i ikke-blokkerende modus, og en synkron lesing kastet da EAGAIN når
    // skriveren ikke var ferdig ennå, som i `curl … | fristil sjekk`.
    // Som tekst, ikke `Buffer`: et flerbytetegn delt over to biter ble
    // ellers to erstatningstegn, og «fs-knøpp» sto som «fs-kn��pp» i funnet.
    process.stdin.setEncoding("utf8")
    let text = ""
    for await (const chunk of process.stdin) text += chunk
    // Tom inndata er ikke markup som stemmer. Et glob som ikke traff noe,
    // eller en test som glemte å sende noe, ville ellers meldt grønt uten å
    // ha sett på noe.
    if (text.trim() === "") {
      console.error("Ingen markup å sjekke: standard inn var tom.")
      process.exit(1)
    }
    sources.push({ name: "stdin", text, page: rendered })
  }

  if (missing.length > 0 || unreachable.length > 0) {
    for (const path of missing) console.error(`Fant ikke fila «${path}».`)
    for (const reason of unreachable) console.error(reason)
    process.exit(1)
  }

  let count = 0
  for (const { name, text, page } of sources) {
    for (const finding of page ? diagnosePage(text) : diagnoseMarkup(text)) {
      count += 1
      console.log(`${name}:${describe(text, finding)}`)
    }
  }

  const files = `${sources.length} ${sources.length === 1 ? "fil" : "filer"}`
  if (count > 0) {
    console.error(`\n${count} funn i ${files}.`)
    process.exit(1)
  }
  console.log(`Markupen stemmer med Fristil i ${files}.`)
}

/** Linje, kolonne, alvor og melding, slik en kompilator skriver det. */
function describe(text: string, finding: Finding): string {
  const before = text.slice(0, finding.start)
  const line = before.split("\n").length
  const column = finding.start - before.lastIndexOf("\n")
  const kind = finding.severity === "error" ? "feil" : "advarsel"
  return `${line}:${column}: ${kind}: ${finding.message}`
}

/** Det kommandoen kan, skrevet ut på én skjerm. */
const HJELP = `fristil <kommando>

  sjekk <fil|adresse…> Sjekker markupen mot Fristil, som editoren gjør.
                       Uten filer leses standard inn. Ett funn gir feilkode.
                       En adresse hentes og sjekkes som en hel side: hver
                       id det pekes på må finnes, og hvert felt være koblet
    --rendret          Sjekk filer og standard inn som hele sider også

  sjekk-tema <fil…>    Kontrollerer at et fargetema holder kontrastløftene.
                       Leser --fs-color-*-verdiene i hver blokk og sier
                       hvilken celle som ryker. Ett brudd gir feilkode

  agent                Skriver regelboka for kodeagenter til utdata. Ingen
    --rammeverk=<navn> fil skrives noe sted. Uten flagget leses miljøet av
                       package.json. Navn: html, maler, bundles, react, astro,
                       datastar. Vue, Svelte, Solid og Lit deler «bundles»

  overta <komponent>   Kopierer kildekoden til én komponent inn i prosjektet
    --ut=<mappe>       Hvor kopien skal ligge. Standard: src/fristil
    --overskriv=ja     Skriv over en kopi som finnes fra før

  tema                 Lager et tema av merkefargene, skriften og formen din
    --aksent=<farge>      Lenker, knapper og fokus
    --fare=<farge>        Feil og sletting
    --suksess=<farge>     Bekreftelser
    --advarsel=<farge>    Advarsler
    --noytral=<farge>     Tekst og flater
    --besokt=<farge>      Besøkte lenker
    --merke1=<farge>      Merkefarge for flater og kategorier
    --merke2=<farge>      Merkefarge nummer to
    --merke3=<farge>      Merkefarge nummer tre
    --skrift=<stakk>      Skriftstakken temaet skal bruke
    --knapp-hjorner=<mål> Hjørner på knapp, paginering og hopplenke
    --felt-hjorner=<mål>  Hjørner på felt, tekstområde og nedtrekksliste
    --flate-hjorner=<mål> Hjørner på kort, dialog, sprettoppvindu, varsel,
                          trekkspill, feiloppsummering, filopplasting,
                          økttidsvarsel, forslagsliste, melding og hjelpeboble
    --knapp-ramme=<mål>   Rammetykkelsen på knappen
    --knapp-vekt=<vekt>   Vekten på knappeteksten
    --ut=<fil>            Skriv til fil i stedet for til utdata

Fargene skrives heksadesimalt, for eksempel #7c3aed. Temaet kan også leses
fra en JSON-fil: fristil tema fristil.tema.json

Eksempler:
  npx @fristil/designsystem sjekk maler/*.html
  npx @fristil/designsystem sjekk http://localhost:8080/skjema
  curl -s http://localhost:8080/skjema | npx @fristil/designsystem sjekk --rendret
  npx @fristil/designsystem agent
  npx @fristil/designsystem overta button --ut=src/ui
  npx @fristil/designsystem tema --aksent=#7c3aed --fare=#b3261e \\
    --suksess=#2b6940 --advarsel=#8a5a00 --ut=tema.css
`

/**
 * `fristil sjekk-tema <fil…>` kontrollerer et tema noen har skrevet selv.
 *
 * Generatoren holder løftene av konstruksjon, men et tema skrevet for hånd er
 * konsumentens ansvar. Uten denne kommandoen er «du kan overstyre hvilken som
 * helst celle» en felle: du får vite at fargen er feil først når noen ikke kan
 * lese siden.
 *
 * Tellingen står sist og krever at tallet er større enn null. En kjøring som
 * ikke fant en eneste fil skal ikke kunne se ut som en kjøring uten funn.
 */
async function checkThemeFiles(args: string[]): Promise<void> {
  /*
   * Et ukjent flagg skal stoppe kjøringen, ikke forsvinne.
   * `fristil tema` gjør det samme, og grunnen er den samme: en skrivefeil i et
   * flagg ser ut som om kommandoen gjorde det du ba om.
   */
  const unknownFlags = args.filter((arg) => arg.startsWith("-"))
  if (unknownFlags.length > 0) {
    console.error(
      `Ukjent flagg: ${unknownFlags.join(", ")}.\n\n` +
        "`fristil sjekk-tema` tar bare filnavn.\n",
    )
    process.exit(1)
  }

  const paths = args
  if (paths.length === 0) {
    console.error(
      "Oppgi minst én CSS-fil: `fristil sjekk-tema tema.css`.\n\n" +
        "Kommandoen leser --fs-color-*-verdiene i fila og kontrollerer at " +
        "hvert kontrastløfte holder, i hver blokk.\n",
    )
    process.exit(1)
  }

  // Filer som ikke lot seg lese samles og meldes samlet, som i `fristil sjekk`.
  const sources: { path: string; css: string }[] = []
  const unreadable: string[] = []

  for (const path of paths) {
    try {
      sources.push({ path, css: await readFile(path, "utf8") })
    } catch (error) {
      const code = (error as { code?: string }).code
      unreadable.push(
        code === "EISDIR"
          ? `${path} (er en mappe)`
          : code === "ENOENT"
            ? `${path} (finnes ikke)`
            : `${path} (${code ?? "kunne ikke leses"})`,
      )
    }
  }

  if (unreadable.length > 0) {
    console.error(`Klarte ikke lese: ${unreadable.join(", ")}.`)
    process.exit(1)
  }

  let problems = 0
  let blocks = 0
  let declarations = 0
  let promises = 0

  for (const { path, css } of sources) {
    const report = inspectTheme(css)
    for (const problem of report.problems) {
      console.error(`${path}  ${problem.selector}\n  ${problem.message}`)
      problems++
    }
    blocks += report.blocks
    declarations += report.declarations
    promises += report.promises
  }

  /*
   * Tellingen står sist, og teller konsumentens egne verdier.
   *
   * «Tre filer kontrollert» er sant også om alle tre var tomme. Løftetallet
   * alene duger heller ikke: standardverdiene fyller hullene, så én linje gir
   * like mange løfter som et helt tema. Tallet som betyr noe er hvor mange av
   * fargene i fila som faktisk ble lest og forstått.
   */
  const files = `${sources.length} ${sources.length === 1 ? "fil" : "filer"}`
  const summary = `${declarations} ${declarations === 1 ? "verdi" : "verdier"} i ${blocks} ${blocks === 1 ? "blokk" : "blokker"}, mot ${promises} ${promises === 1 ? "løfte" : "løfter"}, i ${files}`

  if (declarations === 0 && problems === 0) {
    console.error(
      `Fant ingen --fs-color-*-verdier i ${files}. Sjekken har ikke sett på noe.`,
    )
    process.exit(1)
  }

  if (problems > 0) {
    console.error(
      `\n${problems} ${problems === 1 ? "problem" : "problemer"}. Kontrollerte ${summary}.`,
    )
    process.exit(1)
  }

  console.log(`Temaet holder hvert løfte. Kontrollerte ${summary}.`)
}

const HJELPEFLAGG = new Set(["--help", "-h", "help", "hjelp", "--hjelp"])
const KOMMANDOER = new Set(["agent", "sjekk", "sjekk-tema", "overta", "tema"])

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

if (argumenter[0] === "agent") {
  await agent(argumenter.slice(1))
  process.exit(0)
}

if (argumenter[0] === "overta") {
  await overta(argumenter.slice(1))
  process.exit(0)
}

if (argumenter[0] === "sjekk") {
  await check(argumenter.slice(1))
  process.exit(0)
}

if (argumenter[0] === "sjekk-tema") {
  await checkThemeFiles(argumenter.slice(1))
  process.exit(0)
}

// `tema` kan stå først, siden kommandoen kjøres som
// `npx @fristil/designsystem tema`.
const { flagg, filer } = lesArgumenter(
  argumenter[0] === "tema" ? argumenter.slice(1) : argumenter,
)

async function lesTemafil(path: string): Promise<Record<string, unknown>> {
  let innhold: string

  try {
    innhold = await readFile(path, "utf8")
  } catch {
    console.error(
      `Fant ikke fila «${path}».\n\n` +
        "Oppgi en JSON-fil med fargene, eller sett dem som flagg. " +
        "Se `fristil --hjelp`.\n",
    )
    process.exit(1)
  }

  try {
    const parsed: unknown = JSON.parse(innhold)

    /*
     * `null`, en liste og en streng er alle gyldig JSON, og ingen av dem er en
     * oppskrift. `null` ga et stakkspor fra Node, og en streng ga «Ukjent
     * nøkkel i oppskriften: 0, 1, 2», altså indeksene i den.
     */
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      console.error(
        `«${path}» er gyldig JSON, men ikke en oppskrift.\n\n` +
          "Fila skal være et objekt med fargene i seg, for eksempel:\n" +
          '  {"aksent": "#7c3aed", "fare": "#b3261e"}\n',
      )
      process.exit(1)
    }

    return parsed as Record<string, unknown>
  } catch (grunn) {
    console.error(
      `«${path}» er ikke gyldig JSON: ${grunn instanceof Error ? grunn.message : String(grunn)}\n`,
    )
    process.exit(1)
  }
}

const fromFile = filer[0] ? await lesTemafil(filer[0]) : {}

const input: ThemeDraft = {}
for (const [norsk, engelsk] of Object.entries(NØKLER)) {
  const verdi = flagg[norsk] ?? fromFile[norsk] ?? fromFile[engelsk]
  if (typeof verdi === "string" && verdi) input[engelsk] = verdi
}

/*
 * Skrift og form kan komme fra fila eller fra flagg, og flagget vinner.
 * Fila kan skrive dem på norsk eller engelsk, som fargene.
 */
const typografi: ThemeTypography = {
  ...((fromFile.typography ?? fromFile.typografi ?? {}) as ThemeTypography),
}
for (const [norsk, engelsk] of Object.entries(SKRIFTFLAGG)) {
  if (flagg[norsk]) typografi[engelsk] = flagg[norsk]
}

const form: ThemeShape = {
  ...((fromFile.shape ?? fromFile.form ?? {}) as ThemeShape),
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

/*
 * Det samme gjelder nøklene i oppskriftsfila.
 *
 * `{"form": {"buttonRadus": "2rem"}}` gikk stille gjennom, og temaet kom ut
 * uten hjørnet. Fila er nettopp det som kan komme fra et annet repo, så en
 * skrivefeil der er vanskeligere å oppdage enn en på kommandolinja.
 */
const SKRIFTNØKLER = new Set(["fontFamily", "weights", "lineHeights"])
const VEKTNØKLER = new Set(["regular", "medium", "semibold", "bold"])
const LINJENØKLER = new Set(["default", "heading", "article", "compact"])
const FORMNØKLER = new Set([
  "buttonRadius",
  "fieldRadius",
  "surfaceRadius",
  "buttonBorderWidth",
  "buttonFontWeight",
])

function ukjenteNøkler(
  objekt: unknown,
  lovlige: Set<string>,
  sti: string,
): string[] {
  if (!objekt || typeof objekt !== "object") return []
  return Object.keys(objekt as object)
    .filter((navn) => !lovlige.has(navn))
    .map((navn) => `${sti}.${navn}`)
}

/*
 * Toppnøklene i oppskriftsfila.
 *
 * Fargene redder seg selv: en skrivefeil der gir «Mangler farger». Taket gjør
 * ikke det, og `{"maksmetning": 0.32}` med liten m ga et tema uten tak og uten
 * et ord om hvorfor. Dokumentasjonen lover at en nøkkel som ikke finnes stopper
 * kjøringen, og det gjelder hele fila, ikke bare det som står inni `form`.
 */
const TOP_LEVEL_KEYS = new Set([
  ...Object.entries(NØKLER).flat(),
  "typografi",
  "typography",
  "form",
  "shape",
  // `$schema` er konvensjonen for en JSON-konfigurasjonsfil, og editorer
  // skriver den inn av seg selv. Den sa ingenting om temaet før, og skal ikke
  // begynne å felle kjøringen nå.
  "$schema",
])

const unknownKeys = [
  ...Object.keys(fromFile).filter((key) => !TOP_LEVEL_KEYS.has(key)),
  ...ukjenteNøkler(typografi, SKRIFTNØKLER, "typografi"),
  ...ukjenteNøkler(typografi.weights, VEKTNØKLER, "typografi.weights"),
  ...ukjenteNøkler(typografi.lineHeights, LINJENØKLER, "typografi.lineHeights"),
  ...ukjenteNøkler(form, FORMNØKLER, "form"),
]

if (unknownKeys.length > 0) {
  console.error(
    `Ukjent nøkkel i oppskriften: ${unknownKeys.join(", ")}\n\n` +
      "Hele oversikten: fristil --hjelp\n",
  )
  process.exit(1)
}

if (ukjente.length > 0) {
  console.error(
    `Ukjent flagg: ${ukjente.map((navn) => `--${navn}`).join(", ")}\n\n` +
      `Kjente flagg: ${[...KJENTE_FLAGG].map((navn) => `--${navn}`).join(", ")}\n\n` +
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

if (tema.violations.length > 0) {
  const brudd = tema.violations
    .map(
      (b) =>
        `  ${b.family}: ${b.promise} er ${b.ratio.toFixed(2)}:1, kravet er ${b.required}:1`,
    )
    .join("\n")

  console.error(`\nTemaet holder ikke kontrastkravet:\n\n${brudd}\n`)
  process.exit(1)
}

const ut = flagg.ut

if (ut) {
  await writeFile(ut, tema.css)
  console.error(
    `\nSkrev ${ut}. ${Object.keys(tema.light).length} farger i hvert tema, alle løfter holder.`,
  )
} else {
  console.log(tema.css)
}
