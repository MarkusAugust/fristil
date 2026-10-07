/**
 * At Rust-kjernen svarer nøyaktig det TypeScript-versjonen svarer.
 *
 * Tre kilder til markup, fra den smaleste til den bredeste:
 *
 * 1. Fiksturene i `paritet/`, én per regel.
 * 2. Alt i repoet som har markup i seg: dokumentasjonen, regelbøkene,
 *    komponentene og testene deres. Det er markup skrevet av mennesker og
 *    agenter, med alt det rare det har i seg.
 * 3. Ødelagt markup: hver fikstur, klipt, skjøtet og med tegn satt inn og tatt
 *    bort, med et fast frø, så et avvik kan gjenskapes.
 *
 * Svaret sammenlignes felt for felt for både `diagnoseMarkup` og
 * `diagnosePage`. Kaster TypeScript-versjonen, regnes det som et eget funn:
 * da er det en feil der, ikke et avvik i kjernen.
 *
 * Kjør med: bun kjerne/scripts/sjekk-paritet.ts (etter bygg.ts)
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import {
  diagnoseMarkup,
  diagnosePage,
  type Finding,
} from "../../designsystem/src/diagnostics/index.js"
import { loadCore } from "../js/kjerne.js"
import { MODUL } from "./bygg.js"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const kjerne = loadCore(readFileSync(MODUL))

/** Feltene i fast rekkefølge, så to like funn blir like strenger. */
const kanonisk = (funn: Finding[]) =>
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
const avvik: string[] = []
const kaster: string[] = []

function sammenlign(navn: string, html: string) {
  for (const [hva, ts, rust] of [
    ["markup", diagnoseMarkup, kjerne.diagnoseMarkup],
    ["side", diagnosePage, kjerne.diagnosePage],
  ] as const) {
    antall += 1
    let fasit: string
    try {
      const funn = ts(html)
      funnTotalt += funn.length
      fasit = kanonisk(funn)
    } catch (feil) {
      kaster.push(
        `${navn} (${hva}): ${feil instanceof Error ? feil.message : feil}`,
      )
      continue
    }
    const svar = kanonisk(rust(html))
    if (svar !== fasit)
      avvik.push(
        `${navn} (${hva})\n  TS:   ${fasit.slice(0, 600)}\n  Rust: ${svar.slice(0, 600)}`,
      )
  }
}

// 1. Fiksturene.
const PARITET = join(ROT, "kjerne/paritet")
const fiksturer = readdirSync(PARITET)
  .filter((f) => f.endsWith(".html"))
  .map((f) => [f, readFileSync(join(PARITET, f), "utf8")] as const)
for (const [navn, html] of fiksturer) sammenlign(navn, html)

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
    sammenlign(relative(ROT, sti), tekst)
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
  sammenlign(
    `ødelagt #${n} fra ${navn}: ${JSON.stringify(html).slice(0, 300)}`,
    html,
  )
}

console.log(
  `${antall} sammenligninger: ${fiksturer.length} fiksturer, ${repofiler} filer fra repoet og ${ØDELAGTE} ødelagte, med ${funnTotalt} funn til sammen.`,
)
if (kaster.length > 0) {
  console.log(`\nTypeScript-versjonen kastet ${kaster.length} ganger:`)
  for (const k of kaster.slice(0, 10)) console.log(`  ${k}`)
}
if (avvik.length > 0) {
  console.error(`\n${avvik.length} avvik mellom Rust og TypeScript:\n`)
  for (const a of avvik.slice(0, 15)) console.error(`${a}\n`)
  process.exit(1)
}
console.log("Rust og TypeScript svarer det samme på alt.")
