/**
 * At kjernen svarer det den skal, på alt den kan møte.
 *
 * Tre kilder til markup, fra den smaleste til den bredeste:
 *
 * 1. Fiksturene i `paritet/`, én per regel. Svaret skal være nøyaktig
 *    fasiten ved siden av, felt for felt. Fasiten ble skrevet av
 *    TypeScript-versjonen av sjekken før den ble slettet, og er nå en vanlig
 *    test: en endring i et svar er en endring i fasiten, og synes i diffen.
 * 2. Alt i repoet som har markup i seg: dokumentasjonen, regelbøkene,
 *    komponentene og testene deres. Det er markup skrevet av mennesker og
 *    agenter, med alt det rare det har i seg.
 * 3. Ødelagt markup: hver fikstur, klipt, skjøtet og med tegn satt inn og tatt
 *    bort, med et fast frø, så et funn kan gjenskapes.
 *
 * For 2 og 3 finnes ingen fasit, men svaret må holde: kjernen kaster ikke,
 * hvert funn ligger innenfor teksten, linja og kolonnen svarer til `start`,
 * regelen er en kjernen har, og en rettelse ligger innenfor teksten. Sjekken
 * gjøres med både `diagnoseMarkup` og `diagnosePage`.
 *
 * Kjør med: bun kjerne/scripts/sjekk-kjerne.ts (etter bygg.ts)
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type Finding,
  loadCore,
} from "../../designsystem/src/diagnostics/core.js"
import { MODUL } from "./bygg.js"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const kjerne = loadCore(readFileSync(MODUL))

/** Reglene kjernen har. Står i `kjerne/src/types.rs`. */
const REGLER = new Set([
  "ukjent-element",
  "ukjent-attributt",
  "boolsk-med-verdi",
  "ugyldig-verdi",
  "ikke-tall",
  "ukjent-klasse",
  "ugyldig-klasseverdi",
  "felt-uten-kontroll",
  "felt-uten-ledetekst",
  "tidsavbrudd-uten-dialog",
  "duplikat-id",
  "id-finnes-ikke",
  "for-peker-feil",
  "oppsummering-peker-feil",
  "kontroll-uten-ledetekst",
  "tekst-ikke-koblet",
])

/** Feltene fasiten har, i fast rekkefølge, så to like funn blir like strenger. */
const kanonisk = (funn: Omit<Finding, "rule" | "line" | "column">[]) =>
  JSON.stringify(
    funn.map((f) => ({
      start: f.start,
      end: f.end,
      severity: f.severity,
      link: f.link,
      message: f.message,
      fix: f.fix && {
        title: f.fix.title,
        start: f.fix.start,
        end: f.fix.end,
        text: f.fix.text,
        preferred: f.fix.preferred ?? false,
      },
    })),
  )

let antall = 0
let funnTotalt = 0
const feil: string[] = []

/** Linja og kolonnen `start` har i teksten, fra 1. */
function plass(html: string, start: number): [number, number] {
  let linje = 1
  let linjestart = 0
  for (let i = 0; i < start; i++)
    if (html[i] === "\n") {
      linje += 1
      linjestart = i + 1
    }
  return [linje, start - linjestart + 1]
}

/** Det et svar må holde, også uten fasit. */
function holder(navn: string, html: string) {
  for (const [hva, sjekk] of [
    ["markup", kjerne.diagnoseMarkup],
    ["side", kjerne.diagnosePage],
  ] as const) {
    antall += 1
    let funn: Finding[]
    try {
      funn = sjekk(html)
    } catch (e) {
      feil.push(
        `${navn} (${hva}): kastet ${e instanceof Error ? e.message : e}`,
      )
      continue
    }
    funnTotalt += funn.length
    for (const f of funn) {
      const galt = !(0 <= f.start && f.start <= f.end && f.end <= html.length)
        ? "utenfor teksten"
        : plass(html, f.start).join(":") !== `${f.line}:${f.column}`
          ? `linje og kolonne ${f.line}:${f.column}, ventet ${plass(html, f.start).join(":")}`
          : !REGLER.has(f.rule)
            ? `ukjent regel ${f.rule}`
            : f.fix &&
                !(
                  0 <= f.fix.start &&
                  f.fix.start <= f.fix.end &&
                  f.fix.end <= html.length
                )
              ? "rettelsen er utenfor teksten"
              : undefined
      if (galt) feil.push(`${navn} (${hva}): ${galt} i ${JSON.stringify(f)}`)
    }
  }
}

// 1. Fiksturene.
const PARITET = join(ROT, "kjerne/paritet")
const fiksturer = readdirSync(PARITET)
  .filter((f) => f.endsWith(".html"))
  .map((f) => [f, readFileSync(join(PARITET, f), "utf8")] as const)
for (const [navn, html] of fiksturer) {
  const fasit = JSON.parse(
    readFileSync(join(PARITET, navn.replace(/\.html$/, ".json")), "utf8"),
  )
  for (const [hva, sjekk] of [
    ["markup", kjerne.diagnoseMarkup],
    ["side", kjerne.diagnosePage],
  ] as const) {
    antall += 1
    const ventet = kanonisk(fasit[hva])
    const svar = kanonisk(sjekk(html))
    if (svar !== ventet)
      feil.push(
        `${navn} (${hva})\n  Fasit:  ${ventet.slice(0, 600)}\n  Kjerne: ${svar.slice(0, 600)}`,
      )
  }
  holder(navn, html)
}

// 2. Markupen i repoet.
const UTVIDELSER = /\.(html|astro|mdx?|ts)$/
const HOPP = new Set([
  "node_modules",
  "dist",
  ".astro",
  "target",
  "build",
  ".gradle",
])
function* filer(mappe: string): Generator<string> {
  for (const navn of readdirSync(mappe)) {
    if (HOPP.has(navn) || navn.startsWith(".")) continue
    const sti = join(mappe, navn)
    if (statSync(sti).isDirectory()) yield* filer(sti)
    else if (UTVIDELSER.test(navn)) yield sti
  }
}
let repofiler = 0
for (const mappe of [
  "documentation/src",
  "designsystem/src",
  "designsystem/agent",
  "editor/src",
]) {
  for (const sti of filer(join(ROT, mappe))) {
    const tekst = readFileSync(sti, "utf8")
    if (!tekst.includes("<")) continue
    repofiler += 1
    holder(relative(ROT, sti), tekst)
  }
}

// 3. Ødelagt markup, med et fast frø.
let frø = 20261007
const tilfeldig = (n: number) => {
  frø = (frø * 1103515245 + 12345) % 2 ** 31
  return frø % n
}
const BITER = [
  "<",
  ">",
  '"',
  "'",
  "=",
  "/",
  " ",
  "\n",
  "fs-",
  "<fs-field>",
  "</fs-field>",
  "<label>",
  "{{",
  "}}",
  "<!--",
  "-->",
  "<script>",
  "&amp;",
  "&#x41;",
  "%C3%B8",
  "#",
  "ø",
  "🧾",
  'class="fs-',
  'aria-describedby="',
  'id="x"',
]
const ØDELAGTE = 4000
for (let n = 0; n < ØDELAGTE; n++) {
  const [navn, original] = fiksturer[tilfeldig(fiksturer.length)]
  let html = original
  for (let steg = 0, ganger = 1 + tilfeldig(6); steg < ganger; steg++) {
    const ved = tilfeldig(html.length + 1)
    const valg = tilfeldig(4)
    if (valg === 0)
      html =
        html.slice(0, ved) + BITER[tilfeldig(BITER.length)] + html.slice(ved)
    else if (valg === 1)
      html = html.slice(0, ved) + html.slice(ved + 1 + tilfeldig(8))
    else if (valg === 2) html = html.slice(0, ved)
    else
      html =
        html.slice(ved) +
        fiksturer[tilfeldig(fiksturer.length)][1].slice(0, tilfeldig(200))
  }
  holder(
    `ødelagt #${n} fra ${navn}: ${JSON.stringify(html).slice(0, 300)}`,
    html,
  )
}

console.log(
  `${antall} sjekker: ${fiksturer.length} fiksturer mot fasiten, ${repofiler} filer fra repoet og ${ØDELAGTE} ødelagte, med ${funnTotalt} funn til sammen.`,
)
if (feil.length > 0) {
  console.error(`\n${feil.length} feil:\n`)
  for (const f of feil.slice(0, 15)) console.error(`${f}\n`)
  process.exit(1)
}
console.log("Kjernen svarer det den skal på alt.")
