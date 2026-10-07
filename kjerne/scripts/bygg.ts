/**
 * Skriver ordforrådet som Rust, bygger WebAssembly-modulen og skriver fasiten.
 *
 * Ordforrådet er det samme som `classes.ts` og `elements.ts`, i samme
 * rekkefølge, og står som Rust av samme grunn som `Klasser.kt` står som
 * Kotlin: kompilatoren leser dataene, og modulen trenger ingen parser.
 *
 * Fasiten er det TypeScript-versjonen svarer på hver fil i `paritet/`. JVM-
 * testen sammenligner med den. `sjekk-paritet.ts` sammenligner modulen med
 * TypeScript direkte, også på markupen i dokumentasjonen.
 *
 * Kjør med: bun kjerne/scripts/bygg.ts
 * Krever Rust med målet wasm32-unknown-unknown.
 */

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  classes,
  diagnoseMarkup,
  diagnosePage,
  elements,
} from "../../designsystem/src/diagnostics/index.js"

const KJERNE = fileURLToPath(new URL("..", import.meta.url))
const WASM = join(
  KJERNE,
  "target/wasm32-unknown-unknown/release/fristil_kjerne.wasm",
)
export const MODUL = join(KJERNE, "dist/fristil-kjerne.wasm")

/** En Rust-strengliteral. JSON-strenger er gyldige, bortsett fra `\u{…}`. */
const r = (s: string) =>
  JSON.stringify(s).replace(/\\u([0-9a-f]{4})/gi, (_, h) => `\\u{${h}}`)

const liste = (verdier: readonly string[]) => `&[${verdier.map(r).join(", ")}]`

function ordforråd(): string {
  const elementer = Object.entries(elements).map(([tagg, e]) => {
    const attributter = Object.entries(e.attributes).map(([navn, a]) => {
      const type =
        a.type === "values"
          ? `Attributt::Verdier(${liste(a.values)})`
          : {
              flag: "Attributt::Flagg",
              text: "Attributt::Tekst",
              number: "Attributt::Tall",
            }[a.type]
      return `(${r(navn)}, ${type})`
    })
    return `    Element {\n        tagg: ${r(tagg)},\n        lenke: ${r(e.link)},\n        attributter: &[${attributter.join(", ")}],\n    },`
  })
  const klasser = Object.entries(classes).map(([navn, k]) => {
    const attributter = Object.entries(k.attributes).map(
      ([a, info]) =>
        `(${r(a)}, KlasseAttributt { verdier: ${liste(info.values)}, standard: ${info.default === undefined ? "None" : `Some(${r(info.default)})`} })`,
    )
    return `    Klasse {\n        navn: ${r(navn)},\n        tittel: ${r(k.title)},\n        lenke: ${r(k.link)},\n        attributter: &[${attributter.join(", ")}],\n    },`
  })
  return `// Generert av kjerne/scripts/bygg.ts fra classes.ts og elements.ts. Ikke rediger.
use crate::typer::*;

pub static ELEMENTER: &[Element] = &[
${elementer.join("\n")}
];

pub static KLASSER: &[Klasse] = &[
${klasser.join("\n")}
];
`
}

export function skrivOrdforråd(): string {
  return ordforråd()
}

if (import.meta.main) {
  writeFileSync(join(KJERNE, "src/ordforrad.rs"), ordforråd())

  const cargo = Bun.spawnSync(
    ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
    { cwd: KJERNE, stdout: "inherit", stderr: "inherit" },
  )
  if (cargo.exitCode !== 0) process.exit(cargo.exitCode ?? 1)
  mkdirSync(join(KJERNE, "dist"), { recursive: true })
  copyFileSync(WASM, MODUL)

  const PARITET = join(KJERNE, "paritet")
  for (const fil of readdirSync(PARITET).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(join(PARITET, fil), "utf8")
    const fasit = { markup: diagnoseMarkup(html), side: diagnosePage(html) }
    writeFileSync(
      join(PARITET, fil.replace(/\.html$/, ".json")),
      `${JSON.stringify(fasit, null, 2)}\n`,
    )
  }

  const kb = (statSync(MODUL).size / 1024).toFixed(0)
  console.log(`Skrev ${MODUL} (${kb} kB), ordforrad.rs og fasiten i paritet/.`)
}
