/**
 * At stilarkene vitner om det samme som manifestet.
 *
 * Manifestet er kilden: det skrives fra byggefunksjonene, og det er det
 * kjernen sjekker mot og Kotlin genereres fra. CSS-en er et vitne. Sier de
 * to noe forskjellig, er én av dem feil, og da skal det fram:
 *
 *   1. Hver lovlige verdi i manifestet, utenom standardverdien, har en
 *      selektor som `.fs-button[data-variant="ghost"]`. En verdi uten
 *      selektor gjør ingenting synlig. Det kan være riktig, som en verdi
 *      bare skript leser, og da står den i `UTEN_STYLING` med grunnen.
 *   2. Hver verdi en selektor bruker på en `fs-`-klasse, står i manifestet.
 *      En selektor på en verdi ingen byggefunksjon gir, er enten en verdi
 *      som mangler i API-et, eller en intern verdi komponenten setter selv.
 *      Den siste står i `INTERN` med grunnen.
 *
 * Kjør med: bun scripts/sjekk-css-vitne.ts, eller som en del av `bun run build`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const PAKKE = fileURLToPath(new URL("..", import.meta.url))

type Manifest = {
  classes: Record<
    string,
    {
      attributes: Record<
        string,
        { values?: string[]; default?: string; flag?: true }
      >
    }
  >
}
const manifest: Manifest = JSON.parse(
  readFileSync(join(PAKKE, "manifest/manifest.json"), "utf8"),
)

/**
 * Lovlige verdier uten egen selektor, med grunnen. Nøkkelen er
 * `klasse[attributt="verdi"]`.
 */
const UTEN_STYLING: Record<string, string> = {
  'fs-search[data-state="invalid"]':
    "fs.search() setter alltid fs-input i tillegg, og tilstanden styles der.",
  'fs-search[data-state="success"]':
    "fs.search() setter alltid fs-input i tillegg, og tilstanden styles der.",
}

/**
 * Verdier stilarkene bruker uten at de står i manifestet, med grunnen.
 * Nøkkelen er `klasse[attributt="verdi"]`, eller `klasse[attributt]` når
 * selektoren bare spør om attributtet finnes.
 */
const INTERN: Record<string, string> = {
  'fs-connection-status__bar[data-state="online"]':
    "<fs-connection-status> setter den selv i nettleseren når forbindelsen er tilbake. Serveren skriver bare linja.",
  'fs-toast__message[data-color="success"]':
    "<fs-toast> lager meldingene selv, med fargen fra show(). Serveren skriver bare regionen.",
  'fs-toast__message[data-color="warning"]':
    "<fs-toast> lager meldingene selv, med fargen fra show(). Serveren skriver bare regionen.",
  'fs-toast__message[data-color="danger"]':
    "<fs-toast> lager meldingene selv, med fargen fra show(). Serveren skriver bare regionen.",
}

const nøkkel = (klasse: string, attributt: string, verdi?: string) =>
  verdi === undefined
    ? `${klasse}[${attributt}]`
    : `${klasse}[${attributt}="${verdi}"]`

function* stilark(mappe: string): Generator<string> {
  for (const navn of readdirSync(mappe)) {
    const sti = join(mappe, navn)
    if (statSync(sti).isDirectory()) yield* stilark(sti)
    else if (navn.endsWith(".css")) yield sti
  }
}

/** Hver `klasse[attributt]` og `klasse[attributt="verdi"]` stilarkene bruker. */
const vitnet = new Map<string, string>()
const SAMMENSATT =
  /\.(fs-[a-z0-9_-]+)((?:\[[^\]]*\]|::?[a-z-]+(?:\([^()]*\))?|\.[a-z0-9_-]+)*)/g
const ATTRIBUTT = /\[(data-[a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\]/g
for (const sti of [
  ...stilark(join(PAKKE, "src/components")),
  ...stilark(join(PAKKE, "src/tokens")),
]) {
  const css = readFileSync(sti, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  const fil = sti.slice(PAKKE.length)
  for (const [, klasse, resten] of css.matchAll(SAMMENSATT)) {
    for (const [, attributt, a, b, c] of resten.matchAll(ATTRIBUTT)) {
      const verdi = a ?? b ?? c
      vitnet.set(nøkkel(klasse, attributt, verdi), fil)
    }
  }
}

const avvik: string[] = []
const brukt = new Set<string>()

// 1. Hver lovlige verdi har en selektor. En selektor som bare spør om
// attributtet finnes, som `.fs-label[data-required]`, vitner for alle
// verdiene, og er det eneste et flagg kan ha.
let verdier = 0
for (const [klasse, { attributes }] of Object.entries(manifest.classes)) {
  for (const [
    attributt,
    { values = [], default: standard, flag },
  ] of Object.entries(attributes)) {
    const bar = vitnet.has(nøkkel(klasse, attributt))
    for (const verdi of flag ? [undefined] : values) {
      if (verdi === standard) continue
      verdier += 1
      const k = nøkkel(klasse, attributt, verdi)
      if (bar || vitnet.has(k)) continue
      if (k in UTEN_STYLING) brukt.add(k)
      else
        avvik.push(
          `${k} er ${flag ? "et flagg" : "en lovlig verdi"} uten selektor. Style ${flag ? "det" : "den"}, eller før ${flag ? "det" : "den"} opp i UTEN_STYLING med grunnen.`,
        )
    }
  }
}

// 2. Hver verdi en selektor bruker, står i manifestet.
for (const [k, fil] of vitnet) {
  const [, klasse, attributt, verdi] =
    k.match(/^(fs-[^[]+)\[([^=\]]+)(?:="(.*)")?\]$/) ?? []
  const lovlige = manifest.classes[klasse]?.attributes[attributt]
  const kjent =
    lovlige !== undefined &&
    (verdi === undefined ||
      lovlige.values?.includes(verdi) ||
      verdi === lovlige.default)
  if (kjent) continue
  if (k in INTERN) brukt.add(k)
  else
    avvik.push(
      `${fil} styler ${k}, som ikke står i manifestet. Legg verdien til i byggefunksjonen, eller før den opp i INTERN med grunnen.`,
    )
}

// Et unntak som ikke lenger trengs, skal bort, ellers gjemmer det neste feil.
for (const k of [...Object.keys(UTEN_STYLING), ...Object.keys(INTERN)])
  if (!brukt.has(k))
    avvik.push(`${k} står som unntak, men trengs ikke lenger. Fjern det.`)

if (avvik.length > 0) {
  console.error(`CSS-en og manifestet sier ${avvik.length} ting forskjellig:\n`)
  for (const a of avvik) console.error(`  ${a}`)
  process.exit(1)
}
console.log(
  `CSS-en vitner om det samme som manifestet: ${verdier} lovlige verdier og ${vitnet.size} selektorer, med ${Object.keys(UTEN_STYLING).length + Object.keys(INTERN).length} begrunnede unntak.`,
)
