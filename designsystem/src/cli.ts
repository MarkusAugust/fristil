#!/usr/bin/env node
/// <reference types="node" />
/**
 * Lager et fargetema av merkefargene dine.
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

import { readFile, writeFile } from "node:fs/promises"
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

const argumenter = process.argv.slice(2)

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

const tema = buildTheme(input as ThemeInput)

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
