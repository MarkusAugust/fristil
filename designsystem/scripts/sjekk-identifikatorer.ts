/**
 * At identifikatorene i koden som sendes ut er engelske.
 *
 * Regelen står i CLAUDE.md: funksjoner, variabler, typer og konstanter
 * navngis på engelsk, også lokale variabler, og aldri blandet i ett navn.
 * Kommentarene er på norsk. Regelen sto lenge uten vaktpost, og en
 * gjennomgang fant ni norske navn i tre komponenter som ingen hadde sett,
 * blant dem `gått`, `forrigeFokus` og `bundne`. Reviewrunder fanger slikt
 * først når noen leser akkurat den fila.
 *
 * Sjekken leser tekst. Den fjerner kommentarer, strenger og regulære
 * uttrykk, deler hver identifikator i ord etter store bokstaver og
 * understrek, og feller på to ting: æ, ø eller å i navnet, og et ord fra
 * lista under. Bare æ, ø og å ville ikke funnet ett eneste av de ni; lista er
 * det som fanger dem. Ordene er valgt fordi de ikke er engelske ord: `rot`,
 * `rad`, `side`, `tom`, `tall`, `del`, `sett`, `vis` og `meld` står ikke der,
 * siden de er begge deler. Finner du et norsk ord lista ikke kjenner, legg
 * det til i samme endring.
 *
 * Testfiler og `src/testing/` er unntatt, som regelen sier, og `src/types/`
 * er deklarasjoner uten egne navn. Skriptene i `scripts/` sendes ikke ut og
 * leses ikke.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

const REPO = new URL("../..", import.meta.url).pathname

const KILDER = [
  {
    rot: new URL("../src", import.meta.url).pathname,
    unntatt: ["testing", "types"],
  },
  { rot: new URL("../../editor/src", import.meta.url).pathname, unntatt: [] },
  { rot: new URL("../../kjerne/js", import.meta.url).pathname, unntatt: [] },
  { rot: new URL("../../kjerne/src", import.meta.url).pathname, unntatt: [] },
  {
    rot: new URL("../../kotlin/src/main", import.meta.url).pathname,
    unntatt: [],
  },
]

/**
 * Filer som er norske tvers igjennom, og som ryddes i hver sin pull request.
 *
 * De er ikke unntatt: sjekken leser dem, og tallet er antall funn i dag.
 * Flere funn enn tallet feller, så et nytt norsk navn ikke forsvinner i
 * mengden, og færre funn feller også, til tallet er skrevet ned i samme
 * endring. Den dagen en fil er ren, tas den ut. Lista kan altså bare
 * krympe, og et vilkår som slår av sjekken finnes ikke.
 */
const KJENT_GJELD = new Map<string, number>([
  ["designsystem/src/cli.ts", 112],
  ["designsystem/src/tokens/color.ts", 5],
  ["designsystem/src/tokens/theme.ts", 77],
])

const NORSKE_ORD = new Set([
  "aktiv",
  "aktive",
  "alle",
  "antall",
  "attributt",
  "attributter",
  "boks",
  "bundet",
  "bundne",
  "bygger",
  "byggere",
  "deler",
  "egen",
  "eller",
  "fane",
  "faner",
  "fant",
  "farge",
  "farger",
  "feil",
  "felter",
  "ferdig",
  "fil",
  "finnes",
  "flate",
  "flater",
  "fokus",
  "forrige",
  "forste",
  "gammel",
  "gamle",
  "grunn",
  "hendelse",
  "hendelser",
  "hermetegn",
  "hjelp",
  "hver",
  "igjen",
  "ikke",
  "innhold",
  "innledning",
  "kilde",
  "klokke",
  "knapp",
  "knapper",
  "kontrast",
  "kontroll",
  "kontrollen",
  "krav",
  "kropp",
  "laget",
  "ledetekst",
  "lenke",
  "lenker",
  "linje",
  "linjer",
  "lista",
  "liste",
  "lukk",
  "lukke",
  "lukket",
  "mappe",
  "melde",
  "melding",
  "meldinger",
  "navn",
  "navnet",
  "neste",
  "omskrevet",
  "oppgitt",
  "pakke",
  "palett",
  "ramme",
  "sagt",
  "siste",
  "sjekk",
  "skille",
  "skjul",
  "skjult",
  "sti",
  "stil",
  "synlig",
  "synlige",
  "tekst",
  "tittel",
  "tomt",
  "treff",
  "trinn",
  "utmappe",
  "uten",
  "valg",
  "valgt",
  "valgte",
  "varsel",
  "varsler",
  "verdi",
  "verdier",
  "vert",
  "verten",
  "vises",
])

function kildefiler(rot: string, unntatt: string[]): string[] {
  const filer: string[] = []
  const les = (mappe: string) => {
    for (const oppføring of readdirSync(mappe, { withFileTypes: true })) {
      const sti = join(mappe, oppføring.name)
      const relativt = relative(rot, sti)
      if (unntatt.some((u) => relativt === u || relativt.startsWith(`${u}/`)))
        continue
      if (oppføring.isDirectory()) {
        les(sti)
        continue
      }
      if (!/\.(ts|rs|kt)$/.test(oppføring.name)) continue
      if (oppføring.name.endsWith(".d.ts")) continue
      if (oppføring.name.includes(".test.")) continue
      filer.push(sti)
    }
  }
  les(rot)
  return filer
}

/**
 * Levetider (`'static`) og tegn (`'a'`, `b'x'`) i Rust, byttet med mellomrom.
 *
 * Skanneren under er skrevet for TypeScript, der `'` åpner en streng. I Rust
 * står den alene foran en levetid, og resten av linja ville blitt lest som
 * en streng som aldri lukkes. Kotlin har tegn i `'…'` som TypeScript har
 * strenger, så det trengs ikke der.
 */
function utenRustTegn(fil: string, innhold: string): string {
  if (!fil.endsWith(".rs")) return innhold
  return innhold
    .replace(/b?'(\\.|[^'\\\n])'/g, (treff) => " ".repeat(treff.length))
    .replace(/'[a-z_]+\b(?!')/g, (treff) => " ".repeat(treff.length))
}

/**
 * Koden uten strenger, malstrenger, regulære uttrykk og kommentarer.
 *
 * En skanner og ikke regulære uttrykk: en malstreng kan ha en malstreng
 * inni `${…}`, og da parer et regulært uttrykk anførselstegnene feil for
 * resten av fila. Første utgave meldte 13 «identifikatorer» i
 * `diagnostics.ts` som alle var ord i meldinger til brukeren. Tegnene byttes
 * ut med mellomrom framfor å fjernes, så linjenumrene står.
 *
 * Et regulært uttrykk kjennes igjen på det som står foran skråstreken: etter
 * en verdi er `/` divisjon, etter `(`, `,`, `=`, `:`, `[`, `!`, `&`, `|`,
 * `?`, `{`, `}`, `;`, `>`, `return`, `typeof` eller `case` er det et uttrykk.
 */
function bareKode(innhold: string): string {
  const ut: string[] = []
  const blank = (tegn: string) => (tegn === "\n" ? "\n" : " ")
  let i = 0
  // Hvor dypt vi står i `${…}` inne i malstrenger. Hvert nivå husker hvor
  // mange krøllparenteser som er åpne, så `}` som lukker et objekt ikke tas
  // for slutten på uttrykket.
  const uttrykk: number[] = []
  let sisteKode = ""

  const les = () => innhold[i]
  const hopp = (tekst: string) => {
    for (const tegn of tekst) {
      ut.push(blank(tegn))
      i += 1
    }
  }

  function malstreng(): void {
    hopp("`")
    while (i < innhold.length) {
      const tegn = les()
      if (tegn === "\\") {
        hopp(innhold.slice(i, i + 2))
      } else if (tegn === "`") {
        hopp("`")
        // En streng er en verdi: `/` rett etter den er divisjon.
        sisteKode = "v"
        return
      } else if (tegn === "$" && innhold[i + 1] === "{") {
        hopp("${")
        uttrykk.push(0)
        kode()
      } else {
        hopp(tegn)
      }
    }
  }

  function streng(avslutter: string): void {
    hopp(avslutter)
    while (i < innhold.length) {
      const tegn = les()
      if (tegn === "\\") hopp(innhold.slice(i, i + 2))
      else if (tegn === avslutter || tegn === "\n") {
        hopp(tegn)
        sisteKode = "v"
        return
      } else hopp(tegn)
    }
  }

  function regulaertUttrykk(): void {
    hopp("/")
    let iKlasse = false
    while (i < innhold.length) {
      const tegn = les()
      if (tegn === "\\") hopp(innhold.slice(i, i + 2))
      else if (tegn === "\n") return
      else if (iKlasse) {
        if (tegn === "]") iKlasse = false
        hopp(tegn)
      } else if (tegn === "[") {
        iKlasse = true
        hopp(tegn)
      } else if (tegn === "/") {
        hopp(tegn)
        while (/[a-z]/.test(innhold[i] ?? "")) hopp(innhold[i])
        sisteKode = "v"
        return
      } else hopp(tegn)
    }
  }

  function erUttrykkStart(): boolean {
    if (sisteKode === "") return true
    // `>` er med for `=>`: en pilfunksjon som returnerer et regulært uttrykk.
    // Uten den ble `(s) => /\`/.test(s)` lest som divisjon, backticken åpnet
    // en malstreng, og resten av fila ble usynlig for sjekken.
    if (/[(,=:[!&|?{};>]/.test(sisteKode)) return true
    const bak = ut.join("").slice(-12)
    return /\breturn\s*$|\btypeof\s*$|\bcase\s*$/.test(bak)
  }

  function kode(): void {
    while (i < innhold.length) {
      const tegn = les()
      const neste = innhold[i + 1]
      if (tegn === "/" && neste === "/") {
        while (i < innhold.length && les() !== "\n") hopp(les())
      } else if (tegn === "/" && neste === "*") {
        const slutt = innhold.indexOf("*/", i + 2)
        hopp(innhold.slice(i, slutt === -1 ? innhold.length : slutt + 2))
      } else if (tegn === '"' || tegn === "'") {
        streng(tegn)
      } else if (tegn === "`") {
        malstreng()
      } else if (tegn === "/" && erUttrykkStart()) {
        regulaertUttrykk()
      } else if (uttrykk.length > 0 && tegn === "{") {
        uttrykk[uttrykk.length - 1] += 1
        ut.push(tegn)
        sisteKode = tegn
        i += 1
      } else if (uttrykk.length > 0 && tegn === "}") {
        if (uttrykk[uttrykk.length - 1] === 0) {
          uttrykk.pop()
          hopp("}")
          return
        }
        uttrykk[uttrykk.length - 1] -= 1
        ut.push(tegn)
        sisteKode = tegn
        i += 1
      } else {
        ut.push(tegn)
        if (!/\s/.test(tegn)) sisteKode = tegn
        i += 1
      }
    }
  }

  kode()
  return ut.join("")
}

/** `forrigeFokus` blir `forrige` og `fokus`; `FS_FIELD_TAG` blir tre ord. */
function ord(identifikator: string): string[] {
  return identifikator
    .split(/_|(?<=[a-zæøå0-9])(?=[A-ZÆØÅ])|(?<=[A-ZÆØÅ])(?=[A-ZÆØÅ][a-zæøå])/)
    .map((del) => del.toLowerCase())
    .filter(Boolean)
}

const IDENTIFIKATOR = /[A-Za-z_$æøåÆØÅ][\w$æøåÆØÅ]*/g

const funn: string[] = []
const gjeld = new Map<string, number>()
let lest = 0

for (const { rot, unntatt } of KILDER) {
  for (const fil of kildefiler(rot, unntatt)) {
    lest += 1
    const relativt = relative(REPO, fil)
    const kode = bareKode(utenRustTegn(fil, readFileSync(fil, "utf8")))
    kode.split("\n").forEach((linje, i) => {
      for (const treff of linje.matchAll(IDENTIFIKATOR)) {
        const navn = treff[0]
        const norsk =
          /[æøåÆØÅ]/.test(navn) || ord(navn).some((o) => NORSKE_ORD.has(o))
        if (!norsk) continue
        if (KJENT_GJELD.has(relativt)) {
          gjeld.set(relativt, (gjeld.get(relativt) ?? 0) + 1)
        } else {
          funn.push(`${relativt}:${i + 1}  ${navn}`)
        }
      }
    })
  }
}

// Gjelden må stemme på tallet, begge veier.
for (const [fil, tillatt] of KJENT_GJELD) {
  const antall = gjeld.get(fil) ?? 0
  if (antall === 0) {
    funn.push(`${fil}  står i KJENT_GJELD, men er ren. Ta den ut av lista.`)
  } else if (antall > tillatt) {
    funn.push(
      `${fil}  har ${antall} norske identifikatorer, men KJENT_GJELD tillater ${tillatt}. Nye norske navn er ikke lov, heller ikke der.`,
    )
  } else if (antall < tillatt) {
    funn.push(
      `${fil}  har ${antall} norske identifikatorer, men KJENT_GJELD sier ${tillatt}. Skriv tallet ned til ${antall}.`,
    )
  }
}

// Tell hva som faktisk ble lest. Null filer er en feil i sjekken, ikke en
// ren kodebase.
if (lest === 0) {
  console.error("✗ sjekk-identifikatorer leste ingen filer.")
  process.exit(1)
}

if (funn.length > 0) {
  const unike = [...new Set(funn)]
  console.error(
    `\n✗ ${unike.length} norske identifikatorer i ${lest} leste filer. ` +
      "Identifikatorer i koden som sendes ut skal være engelske; kommentarene er norske.\n",
  )
  for (const f of unike) console.error(`  ${f}`)
  process.exit(1)
}

const gjeldsliste = [...gjeld]
  .map(([fil, antall]) => `${fil} (${antall})`)
  .join(", ")
console.log(
  `Identifikatorene er engelske i ${lest} filer. Kjent gjeld: ${gjeldsliste}.`,
)
