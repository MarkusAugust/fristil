#!/usr/bin/env node
/// <reference types="node" />
/**
 * Kommandolinja til Fristil, `npx @fristil/designsystem`.
 *
 * Kommandoene er skrevet i Rust og kjøres som WASI-modulen
 * `kjerne/fristil.wasm`. Verten, som åpner filsystemet og henter adresser,
 * står i `wasi-host.ts`. Pakken er denne: kommandolinja leser manifestet,
 * fargekontrakten, regelbøkene og komponentene herfra.
 */

import { runCommandLine } from "./wasi-host.js"

process.exit(
  await runCommandLine(
    new URL("../kjerne/fristil.wasm", import.meta.url),
    process.argv.slice(2),
    new URL("..", import.meta.url),
  ),
)
