/// <reference types="node" />
/**
 * Verten for kommandolinja i Node: kjører WASI-modulen `fristil.wasm` med
 * Node sin egen `node:wasi`. Brukt av `cli.ts`, og av VS Code-utvidelsen, som
 * starter språkserveren, `fristil lsp`, slik.
 *
 * Kommandoene er skrevet én gang, i Rust (`kjerne/cli/`). Den samme koden er
 * den kjørbare fila fra `cargo install` og det `java -jar` kjører, så svarene
 * er de samme overalt. Verten gjør bare det WASI ikke kan:
 *
 * - åpner mappene modulen skal lese og skrive i, arbeidsmappa og resten av
 *   filsystemet, så både relative og absolutte stier virker;
 * - henter adressene `fristil sjekk` får, siden WASI ikke har nettverk, og
 *   gir siden til modulen som en fil (se `kjerne/cli/src/fetch.rs`);
 * - sier fra når standard inn er en terminal, som WASI ikke kan se.
 */

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isatty } from "node:tty"

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

/**
 * Kjører én kommando, som `["sjekk", "skjema.html"]`, og gir feilkoden.
 * `module` er stien til `fristil.wasm`.
 */
export async function runCommandLine(
  module: string | URL,
  args: string[],
): Promise<number> {
  /*
   * Hele filsystemet åpnes, og modulen får vite hvor arbeidsmappa er og går dit
   * selv. En WASI-modul begynner ellers i `/`, og en relativ sti ble lest fra
   * rota.
   */
  const preopens: Record<string, string> = {}
  if (windows) {
    // Bare stasjonene som finnes. En mappe som ikke kan åpnes, stopper
    // `node:wasi` før modulen starter, og de fleste maskiner har bare C:.
    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
      const drive = `${letter.toUpperCase()}:\\`
      if (existsSync(drive)) preopens[`/${letter}`] = drive
    }
  } else preopens["/"] = "/"

  /*
   * Adressene hentes her og gis til modulen som filer.
   *
   * Fila har adressen, statuskoden (0 når ingen svarte), innholdstypen eller
   * grunnen, og siden, i den rekkefølgen. Vurderingen av svaret, om det er en
   * side og om statuskoden er i orden, gjør modulen.
   */
  let fetchedDir: string | undefined
  const warn = process.emitWarning
  try {
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

    const compiled = await WebAssembly.compile(readFileSync(module))
    const instance = await WebAssembly.instantiate(
      compiled,
      wasi.getImportObject() as WebAssembly.Imports,
    )
    return wasi.start(instance)
  } finally {
    // Også når modulen krasjer: de hentede sidene skal ikke bli liggende, og
    // varslene skal tilbake for resten av prosessen.
    process.emitWarning = warn
    if (fetchedDir) rmSync(fetchedDir, { recursive: true, force: true })
  }
}
