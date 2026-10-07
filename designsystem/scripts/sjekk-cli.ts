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

import { lightCells } from "../src/tokens/matrise.js"

const pakke = fileURLToPath(new URL("../", import.meta.url))
const cli = join(pakke, "dist/cli.js")

/*
 * Kommandoen som prøves. Standard er den bygde fila, som en konsument får.
 * `FRISTIL_CLI` peker på en annen, som den kjørbare fila fra `kjerne/cli`, så
 * de samme påstandene prøves mot den. `FRISTIL_SAMMENLIGN` kjører hver
 * kjøring med begge og krever det samme svaret byte for byte: utdata,
 * feilkanalen og feilkoden. Begge kan være en JSON-liste, en kommando med
 * argumenter, som `["java", "-jar", "fristil.jar"]`.
 */
const kommando = (verdi: string): string[] =>
  verdi.startsWith("[") ? JSON.parse(verdi) : [verdi]
const KOMMANDO = process.env.FRISTIL_CLI
  ? kommando(process.env.FRISTIL_CLI)
  : ["node", cli]
const SAMMENLIGN = process.env.FRISTIL_SAMMENLIGN
  ? kommando(process.env.FRISTIL_SAMMENLIGN)
  : undefined
const avvik: string[] = []

const FARGER = [
  "--aksent=#7c3aed",
  "--fare=#b3261e",
  "--suksess=#2b6940",
  "--advarsel=#8a5a00",
]

type Kjøring = { kode: number; ut: string; feil: string }

let antallKjøringer = 0

async function kjør(argumenter: string[], mappe?: string): Promise<Kjøring> {
  antallKjøringer += 1

  const start = (kommando: string[]) =>
    Bun.spawn([...kommando, ...argumenter], {
      stdout: "pipe",
      stderr: "pipe",
      // `agent` leser package.json i arbeidsmappa. Uten dette ville hver
      // kjøring sett pakkens egen, og deteksjonen aldri blitt prøvd.
      cwd: mappe,
    })
  const svar = async (prosess: ReturnType<typeof start>) => {
    const [ut, feil, kode] = await Promise.all([
      new Response(prosess.stdout).text(),
      new Response(prosess.stderr).text(),
      prosess.exited,
    ])
    return { kode, ut, feil }
  }

  const resultat = await svar(start(KOMMANDO))
  // `overta` skrives i Rust i fase 4D, og til da finnes den bare her.
  if (SAMMENLIGN && argumenter[0] !== "overta") {
    const annet = await svar(start(SAMMENLIGN))
    /*
     * To forklaringer kom fra JavaScript-motoren selv, og kan ikke bli like:
     * hva som er galt i en JSON-fil, og hvorfor ingen svarte på en adresse
     * («fetch failed»). Resten av meldingen skal være lik.
     */
    const likt = (tekst: string) =>
      tekst
        .replace(/(er ikke gyldig JSON: ).*/g, "$1…")
        .replace(/(Fikk ikke kontakt med \S+: ).*/g, "$1…")
    for (const del of ["kode", "ut", "feil"] as const)
      if (likt(String(resultat[del])) !== likt(String(annet[del])))
        avvik.push(
          `${argumenter.join(" ")} (${del})\n    ${JSON.stringify(resultat[del]).slice(0, 400)}\n    ${JSON.stringify(annet[del]).slice(0, 400)}`,
        )
  }
  return resultat
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
    ut.includes("--fs-color-accent-fill"),
    "utdata mangler fargene fra matrisen",
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
      aksent: "#0f766e",
      fare: "#9f1239",
      suksess: "#15803d",
      advarsel: "#a16207",
    }),
  )

  const { kode, ut } = await kjør(["tema", sti])

  krev(kode === 0, `lesing fra fil avsluttet med kode ${kode}`)
  krev(ut.includes("--fs-color-accent-fill"), "utdata mangler fargene fra fila")

  await rm(mappe, { recursive: true, force: true })
}

// `sjekk-tema` kontrollerer et tema, og teller konsumentens egne verdier
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-tema-"))
  const godt = join(mappe, "godt.css")

  // Matrisen skrevet ut som et tema, kontrollert mot seg selv
  await writeFile(
    godt,
    ":root {\n  color-scheme: light;\n" +
      Object.entries(lightCells)
        .map(([navn, verdi]) => `  ${navn}: ${verdi};`)
        .join("\n") +
      "\n}\n",
  )

  const rent = await kjør(["sjekk-tema", godt])
  krev(rent.kode === 0, `et tema som holder avsluttet med ${rent.kode}`)
  krev(
    /\d+ verdier/.test(rent.ut),
    `sjekk-tema sier ikke hvor mange verdier den leste: ${rent.ut.slice(0, 80)}`,
  )

  // En for lys faretekst skal felle, og si hvilken celle det gjelder
  const svakt = join(mappe, "svakt.css")
  await writeFile(
    svakt,
    ":root { color-scheme: light; --fs-color-danger-text: #ff9999; }",
  )
  const felt = await kjør(["sjekk-tema", svakt])
  krev(felt.kode !== 0, "en for lys faretekst skulle gitt feilkode")
  krev(
    felt.feil.includes("danger"),
    `meldingen nevner ikke familien: ${felt.feil.slice(0, 80)}`,
  )

  // Et ukjent flagg skal stoppe kjøringen, ikke forsvinne
  const flagg = await kjør(["sjekk-tema", godt, "--noe"])
  krev(flagg.kode !== 0, "et ukjent flagg skulle gitt feilkode")

  // Og uten filer skal den si hva den vil ha
  const uten = await kjør(["sjekk-tema"])
  krev(uten.kode !== 0, "sjekk-tema uten filer skulle gitt feilkode")

  await rm(mappe, { recursive: true, force: true })
}

// En familie som utelates arver Fristils egen, framfor å felle kjøringen
{
  const { kode, ut } = await kjør(["tema", "--aksent=#7c3aed"])

  krev(kode === 0, `ett merke alene avsluttet med kode ${kode}`)
  krev(
    ut.includes("--fs-color-danger-fill"),
    "et tema med bare aksent mangler de arvede familiene",
  )
}

/*
 * Skrift og form, som flagg og fra fil.
 *
 * Dette er den eneste sjekken som kjører flaggene slik en konsument gjør.
 * `buildTheme()` testes i nettleseren, men den ser aldri et flagg: reverteres
 * bindestreken i tegnklassen som leser dem, blir `--knapp-hjorner=2rem` lest
 * som et filnavn igjen, og alt annet melder grønt.
 */
{
  const { kode, ut } = await kjør([
    "tema",
    "--skrift=Helvetica, Arial, sans-serif",
    "--knapp-hjorner=2.75rem",
    "--felt-hjorner=0.25rem",
    "--flate-hjorner=0.25rem",
    "--knapp-ramme=3px",
    "--knapp-vekt=700",
  ])

  krev(kode === 0, `tema uten farger avsluttet med kode ${kode}`)
  krev(
    ut.includes("--fs-font-family-base: Helvetica, Arial, sans-serif;"),
    "skriften kom ikke med",
  )
  krev(
    ut.includes("font-family: var(--fs-font-family-base);"),
    "skriften ble ikke satt som en regel, bare som et token",
  )
  krev(
    ut.includes("--fs-button-radius: 2.75rem;"),
    "knappehjørnet kom ikke med",
  )
  krev(
    ut.includes("--fs-textarea-radius: 0.25rem;"),
    "tekstområdet kom ikke med",
  )
  krev(
    ut.includes("--fs-button-border-width: 3px;"),
    "knapperammen kom ikke med",
  )
  krev(
    ut.includes("--fs-button-font-weight: 700;"),
    "knappevekten kom ikke med",
  )
  krev(
    !ut.includes("--palette-") && !ut.includes("--semantic-"),
    "et tema uten farger skal ikke skrive farger",
  )
}

// Skrift og form fra en temafil, sammen med fargene
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-tema-"))
  const sti = join(mappe, "fristil.tema.json")
  await writeFile(
    sti,
    JSON.stringify({
      aksent: "#7c3aed",
      fare: "#b3261e",
      suksess: "#2b6940",
      advarsel: "#8a5a00",
      typografi: { fontFamily: "Georgia, serif" },
      form: { buttonRadius: "1rem" },
    }),
  )

  const { kode, ut } = await kjør(["tema", sti])

  krev(kode === 0, `tema fra fil med skrift og form avsluttet med kode ${kode}`)
  krev(
    ut.includes("--fs-font-family-base: Georgia, serif;"),
    "skriften fra fila kom ikke med",
  )
  krev(
    ut.includes("--fs-button-radius: 1rem;"),
    "hjørnet fra fila kom ikke med",
  )
  krev(ut.includes("--fs-color-accent-fill"), "fargene fra fila kom ikke med")

  await rm(mappe, { recursive: true, force: true })
}

// Sier fra om et flagg som ikke finnes, framfor å ignorere det
{
  // `--knapp-hjørner` med ø er den naturlige norske stavemåten, og flagget
  // heter `hjorner`. Den gikk stille gjennom før, og temaet kom ut uten
  // hjørnet og uten et ord.
  const { kode, feil: melding } = await kjør([
    "tema",
    "--skrift=Helvetica",
    "--knapp-hjørner=2rem",
  ])

  krev(kode !== 0, "et ukjent flagg skulle gitt en feilkode")
  krev(
    melding.includes("knapp-hjørner"),
    "feilmeldingen sier ikke hvilket flagg",
  )
}

// Avviser en verdi som kan bryte ut av CSS-regelen den skrives inn i
{
  const { kode, feil: melding } = await kjør([
    "tema",
    "--knapp-hjorner=4px; } html { display: none } :root { --x: 1",
  ])

  krev(kode !== 0, "en verdi som lukker regelen skulle gitt en feilkode")
  krev(
    melding.includes("CSS-regel"),
    `feilmeldingen forklarer ikke hvorfor: ${melding.slice(0, 120)}`,
  )
  krev(
    !melding.includes("heksadesimale"),
    "feilmeldingen peker på fargene, og feilen handler ikke om farger",
  )
}

// Sier fra når oppskriften ikke setter noe
{
  const { kode, feil: melding } = await kjør(["tema"])

  krev(kode !== 0, "et tomt tema skulle gitt en feilkode")
  krev(
    melding.includes("tomt"),
    `feilmeldingen sier ikke at temaet er tomt: ${melding.slice(0, 120)}`,
  )
}

// Sier fra på en lesbar måte når en farge ikke er en farge
{
  const { kode, feil: melding } = await kjør([
    "tema",
    "--aksent=lilla",
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

// Merkefargene har et siffer i flaggnavnet, og ble lest som filnavn
{
  const uten = await kjør(["tema", "--aksent=#7c3aed"])
  const med = await kjør(["tema", "--aksent=#7c3aed", "--merke1=#aa3366"])

  krev(med.kode === 0, `--merke1 avsluttet med kode ${med.kode}`)
  krev(
    med.ut.includes("--fs-color-brand1-fill") && med.ut !== uten.ut,
    "--merke1 endret ikke temaet",
  )
}

// Et flagg uten likhetstegn stopper, framfor å skrive til standardmappa
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-overta-"))
  const { kode, feil: melding } = await kjør([
    "overta",
    "button",
    "--ut",
    join(mappe, "ui"),
  ])

  krev(kode !== 0, "overta med --ut uten likhetstegn skulle gitt en feilkode")
  krev(
    melding.includes("--ut") && melding.includes("="),
    "feilmeldingen sier ikke at --ut mangler en verdi",
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

// `sjekk`: filer som stemmer gir 0, ett funn gir 1 med fil, linje og kolonne
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-cli-"))
  const riktig = join(mappe, "riktig.html")
  const galt = join(mappe, "galt.html")
  await writeFile(
    riktig,
    `<fs-field id="f"><label>Navn</label><input class="fs-input" name="navn"></fs-field>\n`,
  )
  await writeFile(
    galt,
    `<p>Hei</p>\n<button class="fs-buton">Lagre</button>\n<fs-dialog-header>Tittel</fs-dialog-header>\n`,
  )

  const rent = await kjør(["sjekk", riktig])
  krev(
    rent.kode === 0,
    `sjekk av riktig markup avsluttet med kode ${rent.kode}`,
  )
  krev(rent.ut.includes("stemmer"), "sjekk sier ikke at markupen stemmer")

  const funn = await kjør(["sjekk", galt, riktig])
  krev(funn.kode === 1, `sjekk med funn avsluttet med kode ${funn.kode}`)
  krev(
    funn.ut.includes(`${galt}:2:`) && funn.ut.includes("fs-buton"),
    `funnet står ikke med fil og linje: ${funn.ut.slice(0, 160)}`,
  )
  krev(
    funn.ut.includes(`${galt}:3:`) && funn.ut.includes("fs-dialog-header"),
    "elementet som ikke finnes ble ikke meldt på linje 3",
  )
  krev(!funn.ut.includes("riktig.html:"), "den riktige fila fikk et funn")

  // Fra standard inn, slik en test i en app sender HTML-en serveren lager
  const prosess = Bun.spawn([...KOMMANDO, "sjekk"], {
    stdin: new Blob([`<fs-popover placemnet="top-start"></fs-popover>`]),
    stdout: "pipe",
    stderr: "pipe",
  })
  antallKjøringer += 1
  const [stdinUt, stdinKode] = await Promise.all([
    new Response(prosess.stdout).text(),
    prosess.exited,
  ])
  krev(
    stdinKode === 1,
    `sjekk fra standard inn avsluttet med kode ${stdinKode}`,
  )
  krev(
    stdinUt.includes("stdin:1:") && stdinUt.includes("placement"),
    `funnet fra standard inn mangler: ${stdinUt.slice(0, 120)}`,
  )

  const borte = await kjør([
    "sjekk",
    join(mappe, "finnes-ikke.html"),
    join(mappe, "heller-ikke.html"),
  ])
  krev(borte.kode === 1, "en fil som ikke finnes skulle gitt feilkode")
  krev(
    borte.feil.includes("finnes-ikke.html") &&
      borte.feil.includes("heller-ikke.html"),
    "begge filene som mangler skulle vært nevnt",
  )

  // Tom standard inn er ikke markup som stemmer: et glob uten treff eller en
  // test som glemte å sende noe skal ikke melde grønt.
  const tom = Bun.spawn([...KOMMANDO, "sjekk"], {
    stdin: new Blob([""]),
    stdout: "pipe",
    stderr: "pipe",
  })
  antallKjøringer += 1
  const [tomFeil, tomKode] = await Promise.all([
    new Response(tom.stderr).text(),
    tom.exited,
  ])
  krev(tomKode === 1, `tom standard inn avsluttet med kode ${tomKode}`)
  krev(
    tomFeil.includes("standard inn var tom"),
    "feilmeldingen sier ikke at inndata var tom",
  )

  // Et rør der skriveren bruker tid, som `curl … | fristil sjekk`. En
  // synkron lesing av fd 0 kastet EAGAIN her etter at `process.stdin` var
  // rørt, siden strømmen da setter røret i ikke-blokkerende modus. Bitene
  // deles midt i `ø`: lest som `Buffer` ble hver halvdel et erstatningstegn,
  // og funnet siterte «fs-kn��pp». Første bit skrives før pausen, så barnet
  // må lese to ganger uansett hvor travel maskinen er.
  const bytes = new TextEncoder().encode(
    `<button class="fs-knøpp">Lagre</button>`,
  )
  const kutt = bytes.indexOf(0xc3) + 1
  // Uten en ø å dele blir første bit tom, og tilfellet passerer stille.
  krev(kutt > 0, "teksten i det trege røret har ingen ø å dele")
  const treg = Bun.spawn([...KOMMANDO, "sjekk"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  antallKjøringer += 1
  treg.stdin.write(bytes.slice(0, kutt))
  await Bun.sleep(300)
  treg.stdin.write(bytes.slice(kutt))
  treg.stdin.end()
  const [tregUt, tregFeil, tregKode] = await Promise.all([
    new Response(treg.stdout).text(),
    new Response(treg.stderr).text(),
    treg.exited,
  ])
  krev(
    tregKode === 1 &&
      tregUt.includes("stdin:1:") &&
      tregUt.includes("«fs-knøpp»"),
    `et tregt rør ga ikke funnet med hel tekst: kode ${tregKode}, ${(tregUt + tregFeil).slice(0, 120)}`,
  )
  krev(!tregFeil.includes("EAGAIN"), "lesingen av standard inn kastet EAGAIN")

  await rm(mappe, { recursive: true, force: true })
}

// `agent`: regelboka til utdata, meldinga til feilkanalen, og ingen fil skrevet
{
  const mappe = await mkdtemp(join(tmpdir(), "fristil-agent-"))

  // Uten package.json er markupen serverens, og malregelboka er den riktige.
  const mal = await kjør(["agent"], mappe)

  krev(mal.kode === 0, `agent uten package.json avsluttet med kode ${mal.kode}`)
  krev(
    mal.ut.startsWith("# Fristil i maler"),
    `agent uten package.json ga ikke malregelboka: ${mal.ut.slice(0, 60)}`,
  )
  krev(
    mal.feil.includes("maler") && mal.feil.includes("ingen package.json"),
    `grunnen til valget står ikke i feilkanalen: ${mal.feil.slice(0, 80)}`,
  )
  // Hele poenget med at meldinga går til feilkanalen: utdata kan pipes rent.
  // Teksten det letes etter står bare i meldinga; regelboka begynner selv med
  // ordene «Regelboka for», så den kan ikke brukes til å skille de to.
  krev(
    !mal.ut.includes("ingen package.json i denne mappa"),
    "meldinga om valget havnet i utdata, som da ikke kan pipes rent",
  )
  // Kommandoen skal ikke ha rørt mappa den ble kjørt i.
  krev(
    (await readdir(mappe)).length === 0,
    "agent skrev en fil i arbeidsmappa; den skal aldri skrive noe",
  )

  // Avhengighetene avgjør, og de tre utfallene er ulike regelbøker.
  const oppdaget: [Record<string, string>, string, string][] = [
    [{ react: "19.0.0" }, "react", "# Fristil i React"],
    [{ vue: "3.5.0" }, "bundles", "# Fristil med bundles"],
    [{ astro: "6.0.0" }, "astro", "# Fristil i Astro"],
    // En package.json betyr et byggesteg, og da importeres stilarkene.
    [{ typescript: "6.0.0" }, "bundles", "# Fristil med bundles"],
  ]

  for (const [avhengigheter, navn, overskrift] of oppdaget) {
    await writeFile(
      join(mappe, "package.json"),
      JSON.stringify({ dependencies: avhengigheter }),
    )
    const kjøring = await kjør(["agent"], mappe)

    krev(kjøring.kode === 0, `agent med ${navn} ga kode ${kjøring.kode}`)
    krev(
      kjøring.ut.startsWith(overskrift),
      `${Object.keys(avhengigheter)[0]} ga ikke ${navn}-regelboka: ${kjøring.ut.slice(0, 50)}`,
    )
  }

  // En Astro-app med React-øyer har begge, og Astro bestemmer stilarkene.
  await writeFile(
    join(mappe, "package.json"),
    JSON.stringify({ dependencies: { astro: "6.0.0", react: "19.0.0" } }),
  )
  const begge = await kjør(["agent"], mappe)

  krev(
    begge.ut.startsWith("# Fristil i Astro"),
    "astro tapte mot react, men den bestemmer hvordan stilarkene kommer inn",
  )

  // Vue, Svelte, Solid og Lit deler regelbok, og den som skriver navnet sitt
  // skal ikke måtte vite det. Aliaset skal likevel være synlig i meldinga.
  const svelte = await kjør(["agent", "--rammeverk=svelte"], mappe)

  krev(svelte.kode === 0, `--rammeverk=svelte ga kode ${svelte.kode}`)
  krev(
    svelte.ut.startsWith("# Fristil med bundles"),
    "svelte pekte ikke på bundles-regelboka",
  )
  krev(
    svelte.feil.includes("bundles") && svelte.feil.includes("svelte"),
    `meldinga viser ikke at svelte ble et alias: ${svelte.feil.slice(0, 80)}`,
  )

  const ukjent = await kjør(["agent", "--rammeverk=kohana"], mappe)

  krev(ukjent.kode === 1, `et ukjent navn ga kode ${ukjent.kode}`)
  krev(
    ukjent.feil.includes("Kjenner ikke") && ukjent.feil.includes("bundles"),
    `et ukjent navn fikk ikke lista over valgene: ${ukjent.feil.slice(0, 80)}`,
  )

  // Flagget slår deteksjonen: astro og react står fortsatt i package.json her.
  const html = await kjør(["agent", "--rammeverk=html"], mappe)

  krev(html.kode === 0, `--rammeverk=html avsluttet med kode ${html.kode}`)
  krev(
    html.ut.startsWith("# Fristil i ren HTML"),
    "--rammeverk=html overstyrte ikke deteksjonen",
  )
  // Regelboka skal være regelboka, ikke en tom fil som ser riktig ut.
  for (const del of ["fristil.css", "data-variant", "defineFsField", "sjekk"]) {
    krev(html.ut.includes(del), `regelboka nevner ikke ${del}`)
  }

  // Markupen i regelbøkene må tåle Fristils egen sjekk. En agent-instruksjon
  // med et eksempel sjekken ville avvist er verre enn ingen instruksjon.
  for (const rammeverk of [
    "html",
    "maler",
    "bundles",
    "react",
    "astro",
    "datastar",
  ]) {
    const bok = await kjør(["agent", `--rammeverk=${rammeverk}`], mappe)
    const blokker = [...bok.ut.matchAll(/```html\n([\s\S]*?)```/g)]

    for (const [nummer, blokk] of blokker.entries()) {
      const prøve = Bun.spawn([...KOMMANDO, "sjekk"], {
        stdin: new Blob([blokk[1]]),
        stdout: "pipe",
        stderr: "pipe",
      })
      antallKjøringer += 1
      const [ut, kode] = await Promise.all([
        new Response(prøve.stdout).text(),
        prøve.exited,
      ])

      krev(
        kode === 0,
        `eksempel ${nummer + 1} i ${rammeverk}-regelboka stemmer ikke med Fristil: ${ut.slice(0, 120)}`,
      )
    }
  }

  await rm(mappe, { recursive: true, force: true })
}

// En adresse hentes og sjekkes som en hel side
{
  const side =
    '<!doctype html><html lang="nb"><body><label for="borte">Navn</label><button class="fs-buton">Lagre</button></body></html>'
  const tjener = Bun.serve({
    port: 0,
    fetch(forespørsel) {
      const sti = new URL(forespørsel.url).pathname
      const html = { "content-type": "text/html; charset=utf-8" }
      if (sti === "/side") return new Response(side, { headers: html })
      if (sti === "/videre")
        return new Response(null, {
          status: 302,
          headers: { location: "/side" },
        })
      if (sti === "/biter")
        return new Response(
          new ReadableStream({
            start(kontroll) {
              const koder = new TextEncoder()
              kontroll.enqueue(koder.encode(side.slice(0, 40)))
              kontroll.enqueue(koder.encode(side.slice(40)))
              kontroll.close()
            },
          }),
          { headers: html },
        )
      if (sti === "/json") return Response.json({ ok: true })
      return new Response("<p>Finnes ikke</p>", { status: 404, headers: html })
    },
  })
  const rot = `http://localhost:${tjener.port}`

  for (const sti of ["/side", "/videre", "/biter"]) {
    const { kode, ut } = await kjør(["sjekk", `${rot}${sti}`])
    krev(kode === 1, `${sti} skulle gitt feilkode for funnene, ga ${kode}`)
    krev(
      ut.includes(`${rot}${sti}:1:`) && ut.includes("fs-buton"),
      `${sti}: klassen som ikke finnes, ble ikke meldt med adressen: ${ut.slice(0, 160)}`,
    )
    krev(
      ut.includes("«borte»"),
      `${sti}: siden ble ikke sjekket som hel side, for-koblingen mangler: ${ut.slice(0, 200)}`,
    )
  }

  const json = await kjør(["sjekk", `${rot}/json`])
  krev(json.kode === 1, "en adresse som svarer JSON skulle gitt feilkode")
  krev(json.feil.includes("ikke HTML"), `JSON ble ikke avvist: ${json.feil}`)

  const borte = await kjør(["sjekk", `${rot}/borte`])
  krev(borte.kode === 1, "en 404 skulle gitt feilkode")
  krev(borte.feil.includes("svarte 404"), `404 ble ikke meldt: ${borte.feil}`)

  tjener.stop(true)
  const ingen = await kjør(["sjekk", rot])
  krev(ingen.kode === 1, "en adresse der ingen svarer, skulle gitt feilkode")
  krev(
    ingen.feil.includes(`Fikk ikke kontakt med ${rot}`),
    `en adresse der ingen svarer, ble ikke meldt: ${ingen.feil}`,
  )
}

if (avvik.length > 0) {
  console.error(
    `${avvik.length} kjøringer svarte forskjellig fra ${SAMMENLIGN}:\n\n${avvik.map((a) => `  ${a}`).join("\n\n")}\n`,
  )
  process.exit(1)
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
