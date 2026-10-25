#!/usr/bin/env node
/// <reference types="node" />
/**
 * The LO-TEK command line, `npx @lo-tek/interfaces`.
 *
 * The commands are written in Rust and run as the WASI module
 * `core/lotek.wasm`. The host, which opens the file system and fetches
 * addresses, is in `wasi-host.ts`. The package is this one: the command line
 * reads the manifest, the colour contract, the rulebooks and the components
 * from here.
 */

import { runCommandLine } from "./wasi-host.js"

process.exit(
  await runCommandLine(
    new URL("../core/lotek.wasm", import.meta.url),
    process.argv.slice(2),
    new URL("..", import.meta.url),
  ),
)
