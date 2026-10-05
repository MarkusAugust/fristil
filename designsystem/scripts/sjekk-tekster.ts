/**
 * At hver tekst pakken skriver inn i siden kan oversettes.
 *
 * Fristil har nesten ingen tekst: den som rendrer skriver den, på sitt eget
 * språk. Det som står igjen er standardverdier, og hver av dem må kunne
 * byttes ut. En ny tekst skrevet rett i en komponent kunne ikke det, og
 * ingen ville merket det før en engelsk side leste opp noe på norsk.
 *
 * Tre regler:
 *
 *   - en tekst for brukeren i en komponent står i `default-texts.ts`, ikke
 *     som en streng i komponenten. Det gjelder `setText`, `textContent`,
 *     `append`, `aria-label` og konstanter som heter `DEFAULT_…`;
 *   - en tekst i `content:` i CSS leses fra en `--fs-`-variabel, med
 *     teksten som reserve, siden et stilark ikke kan importere noe;
 *   - hver av tekstene står i tabellen på dokumentasjonssiden om
 *     oversettelse, så siden ikke kan love at alt kan oversettes uten å si
 *     hvordan.
 *
 * Sjekken leser kilden, slik `sjekk-skriving.ts` gjør. Den fanger formene som
 * står i disse filene og dem som ligger nærmest å skrive neste gang, ikke
 * hver tenkelige måte å få tekst inn i en side på.
 *
 * Kjør med: bun scripts/sjekk-tekster.ts, eller som en del av `bun run build`.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { DEFAULT_TEXTS } from "../src/components/default-texts.js"

const KOMPONENTER = new URL("../src/components", import.meta.url).pathname
const TEKSTFIL = join(KOMPONENTER, "default-texts.ts")
const SIDE = new URL(
  "../../documentation/src/content/docs/oversettelse.mdx",
  import.meta.url,
).pathname

function filer(mappe: string, endelse: string): string[] {
  return readdirSync(mappe, { withFileTypes: true }).flatMap((oppføring) => {
    const sti = join(mappe, oppføring.name)
    if (oppføring.isDirectory()) return filer(sti, endelse)
    if (!oppføring.name.endsWith(endelse)) return []
    if (oppføring.name.includes(".test.")) return []
    return [sti]
  })
}

/** Kilden uten kommentarer, med linjeskiftene i behold så linjenumrene stemmer. */
function utenKommentarer(kilde: string): string {
  return kilde
    .replace(/\/\*[\s\S]*?\*\//g, (blokk) => blokk.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
}

/** En CSS-streng med escapene pakket ut: `p\\e5 krevd` blir «påkrevd». */
function pakkUt(streng: string): string {
  return streng.replace(/\\([0-9a-f]+) ?/gi, (_t, kode: string) =>
    String.fromCodePoint(Number.parseInt(kode, 16)),
  )
}

function linje(kilde: string, indeks: number): number {
  return kilde.slice(0, indeks).split("\n").length
}

/** En streng som inneholder minst én bokstav, altså tekst og ikke et tegn. */
// `\x60` er backtick, som ikke kan escapes på vanlig måte med Unicode-flagget.
const TEKST = String.raw`(["'\x60])((?:(?!\1)[^\\]|\\.)*\p{L}(?:(?!\1)[^\\]|\\.)*)\1`

/**
 * En linje som skriver tekst inn i siden. Står det en streng med bokstaver
 * på en slik linje, er det tekst for brukeren, uansett hvor i kallet den
 * står: `setText(s, n ? "a" : "b")` er like mye tekst som `setText(s, "a")`,
 * og `setText(this.querySelector("[role=status]"), "a")` like mye som begge.
 */
const SKRIVER_TEKST = new RegExp(
  [
    String.raw`\bsetText\(`,
    String.raw`\.(?:textContent|innerText|ariaLabel)\s*=`,
    String.raw`\bcreateTextNode\(`,
    String.raw`\.(?:append|prepend)\(`,
    String.raw`["'](?:aria-label|title|placeholder)["']\s*,`,
    String.raw`\bconst\s+DEFAULT_\w+\s*=`,
  ].join("|"),
)

/** Attributtnavnene selv er ikke tekst. */
const IKKE_TEKST = new Set(["aria-label", "title", "placeholder"])

/**
 * Linja uten det som ikke er tekst: argumentene til oppslag i DOM-en, som er
 * velgere, og strengen i en sammenligning, som `name === "label"`.
 */
function utenVelgere(kode: string): string {
  return kode
    .replace(
      /\b(?:querySelector(?:All)?|closest|matches|getAttribute|hasAttribute)\((?:[^()]|\([^()]*\))*\)/g,
      "",
    )
    .replace(/[!=]==\s*(["'])(?:(?!\1).)*\1/g, "")
}

const avvik: string[] = []

let tsLest = 0
for (const fil of filer(KOMPONENTER, ".ts")) {
  if (fil === TEKSTFIL) continue
  const kilde = utenKommentarer(readFileSync(fil, "utf8"))
  kilde.split("\n").forEach((kode, i) => {
    if (!SKRIVER_TEKST.test(kode)) return
    for (const treff of utenVelgere(kode).matchAll(new RegExp(TEKST, "gu"))) {
      if (IKKE_TEKST.has(treff[2])) continue
      avvik.push(
        `${relative(process.cwd(), fil)}:${i + 1}: teksten «${treff[2]}» ` +
          "står i komponenten. Legg den i default-texts.ts, med en måte å " +
          "bytte den ut på.",
      )
    }
  })
  tsLest++
}

const reserver: string[] = []
let cssLest = 0
for (const fil of filer(KOMPONENTER, ".css")) {
  const kilde = utenKommentarer(readFileSync(fil, "utf8"))
  for (const treff of kilde.matchAll(/content\s*:\s*([^;}]+)/g)) {
    const verdi = treff[1].trim()
    const strenger = [...verdi.matchAll(/(["'])((?:(?!\1).)*)\1/g)].map(
      (s) => s[2],
    )
    // Et tegn som «/» eller «×» er ikke språk. En bokstav er det, også
    // escapet: `\e5 ` er å.
    const tekster = strenger.map(pakkUt).filter((s) => /\p{L}/u.test(s))
    if (tekster.length === 0) continue
    // Hele verdien må være én variabel med teksten som reserve. Tekst ved
    // siden av variabelen kan ikke byttes ut.
    if (!/^var\(--fs-[a-z0-9-]+\s*,\s*(["'])(?:(?!\1).)*\1\s*\)$/.test(verdi)) {
      avvik.push(
        `${relative(process.cwd(), fil)}:${linje(kilde, treff.index ?? 0)}: ` +
          `content: ${verdi} har tekst som ikke kan byttes ut. ` +
          "Les den fra en --fs-variabel, med teksten som reserve.",
      )
      continue
    }
    reserver.push(...tekster)
  }
  cssLest++
}

/*
 * Hver tekst skal stå på siden om oversettelse. Mellomrom foran og bak er
 * pynt i CSS-en, ikke en del av teksten, og `{n}` står som den er.
 */
let side = ""
try {
  side = readFileSync(SIDE, "utf8")
} catch {
  avvik.push(`Fant ikke ${relative(process.cwd(), SIDE)}.`)
}
if (side !== "" && side.trim() === "") {
  avvik.push(`${relative(process.cwd(), SIDE)} er tom.`)
}
/*
 * Teksten skal stå i en celle i tabellen, ikke hvor som helst på siden. Et
 * ord i brødteksten, eller en stjerne i fet skrift, er ikke tabellen.
 */
const celler = new Set(
  [...side.matchAll(/\|([^|\n]+)(?=\|)/g)].map((celle) =>
    celle[1].trim().replace(/^`(.*)`$/, "$1"),
  ),
)
const forventet = [...Object.values(DEFAULT_TEXTS), ...new Set(reserver)]
let dokumentert = 0
for (const tekst of forventet) {
  const kjerne = tekst.trim()
  if (!celler.has(kjerne)) {
    avvik.push(
      `Teksten «${kjerne}» står ikke i tabellen på ${relative(process.cwd(), SIDE)}.`,
    )
    continue
  }
  dokumentert++
}

/*
 * Tell det som faktisk ble gjort, og krev at det er mer enn null. En sjekk
 * som ikke fant en eneste fil eller tekst, har ikke sjekket noe.
 */
if (tsLest === 0 || cssLest === 0) {
  avvik.push(
    `Leste ${tsLest} TypeScript-filer og ${cssLest} stilark. Det skal være flere enn null.`,
  )
}
if (forventet.length === 0) {
  avvik.push("Fant ingen standardtekster å kontrollere.")
}

if (avvik.length > 0) {
  console.error(
    `Tekstene kan ikke oversettes:\n\n${avvik.map((a) => `  ${a}`).join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Tekstene kan oversettes: ${tsLest} komponentfiler og ${cssLest} stilark lest, ` +
    `${dokumentert} av ${forventet.length} standardtekster står på siden om oversettelse.`,
)
