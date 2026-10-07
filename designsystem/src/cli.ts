#!/usr/bin/env node
/// <reference types="node" />
/**
 * Kommandolinja til Fristil, `npx @fristil/designsystem`.
 *
 * Kommandoene er skrevet én gang, i Rust (`kjerne/cli/`), og kjøres her som
 * en WASI-modul, `kjerne/fristil.wasm`, med Node sin egen `node:wasi`. Den
 * samme koden er den kjørbare fila fra `cargo install` og det `java -jar`
 * kjører, så svarene er de samme overalt.
 *
 * Fila er skallet rundt den, og gjør bare det WASI ikke kan:
 *
 * - åpner mappene modulen skal lese og skrive i, arbeidsmappa og resten av
 *   filsystemet, så både relative og absolutte stier virker;
 * - henter adressene `fristil sjekk` får, siden WASI ikke har nettverk, og
 *   gir siden til modulen som en fil (se `kjerne/cli/src/fetch.rs`);
 * - sier fra når standard inn er en terminal, som WASI ikke kan se.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isatty } from "node:tty"

const MODULE = new URL("../kjerne/fristil.wasm", import.meta.url)

const args = process.argv.slice(2)

const windows = process.platform === "win32"

/**
 * En sti slik WASI-modulen ser den.
 *
 * På Windows åpnes hver stasjon som sin egen mappe, `C:\` som `/c`, og
 * skråstrekene snus. Andre steder er stien den samme.
 */
function forWasi(path: string): string {
  if (!windows) return path
  const absolute = /^([A-Za-z]):[\\/](.*)$/.exec(path)
  if (absolute)
    return `/${absolute[1].toLowerCase()}/${absolute[2].replace(/\\/g, "/")}`
  return path.replace(/\\/g, "/")
}

/** Et argument for WASI-modulen: stien i en fil eller i et `--flagg=verdi`. */
function toModule(part: string): string {
  const flag = /^(--[^=]+=)(.*)$/s.exec(part)
  return flag ? flag[1] + forWasi(flag[2]) : forWasi(part)
}

/*
 * Hele filsystemet åpnes, og modulen får vite hvor arbeidsmappa er og går dit
 * selv. En WASI-modul begynner ellers i `/`, og en relativ sti ble lest fra
 * rota.
 */
const preopens: Record<string, string> = {}
if (windows) {
  for (const letter of "abcdefghijklmnopqrstuvwxyz")
    preopens[`/${letter}`] = `${letter.toUpperCase()}:\\`
} else preopens["/"] = "/"

/*
 * Adressene hentes her og gis til modulen som filer.
 *
 * Fila har adressen, statuskoden (0 når ingen svarte), innholdstypen eller
 * grunnen, og siden, i den rekkefølgen. Vurderingen av svaret, om det er en
 * side og om statuskoden er i orden, gjør modulen.
 */
let fetchedDir: string | undefined
const address = /^https?:\/\//i
const moduleArgs: string[] = []
for (const [index, part] of args.entries()) {
  if (args[0] !== "sjekk" || index === 0 || !address.test(part)) {
    moduleArgs.push(toModule(part))
    continue
  }
  fetchedDir ??= mkdtempSync(join(tmpdir(), "fristil-"))
  let answer: string
  try {
    const response = await fetch(part)
    const type = response.headers.get("content-type") ?? ""
    answer = `${part}\n${response.status}\n${type}\n${await response.text()}`
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    answer = `${part}\n0\n${reason.replace(/\n/g, " ")}\n`
  }
  const file = join(fetchedDir, `${index}.txt`)
  writeFileSync(file, answer)
  moduleArgs.push(`--hentet=${forWasi(file)}`)
}

// `node:wasi` er merket eksperimentell, og sier det i konsollen. Det er ikke
// noe brukeren av kommandolinja kan gjøre noe med.
const warn = process.emitWarning
process.emitWarning = ((warning: string | Error, ...resten: unknown[]) => {
  if (String(warning).includes("WASI")) return
  ;(warn as (...a: unknown[]) => void).call(process, warning, ...resten)
}) as typeof process.emitWarning

const { WASI } = await import("node:wasi")
const wasi = new WASI({
  version: "preview1",
  args: ["fristil", ...moduleArgs],
  env: {
    FRISTIL_ARBEIDSMAPPE: forWasi(process.cwd()),
    // `isatty(0)`, ikke `process.stdin.isTTY`: å røre `process.stdin` setter
    // et rør i ikke-blokkerende modus, og modulen ga da opp å lese før
    // skriveren var ferdig, som i `curl … | fristil sjekk`.
    ...(isatty(0) ? { FRISTIL_TERMINAL: "1" } : {}),
  },
  preopens,
  returnOnExit: true,
})

const compiled = await WebAssembly.compile(readFileSync(MODULE))
const instance = await WebAssembly.instantiate(
  compiled,
  wasi.getImportObject() as WebAssembly.Imports,
)
const code = wasi.start(instance)

if (fetchedDir) rmSync(fetchedDir, { recursive: true, force: true })
process.exit(code)
