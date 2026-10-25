/**
 * The language server, started by the extension: `lotek lsp`, run as a WASI
 * module with Node's own `node:wasi`, just like `npx @lo-tek/interfaces lsp`.
 *
 * The module sits next to it in `dist/`. It reads the manifest the project has
 * installed, or the one the Gradle plugin has written. As a fallback the
 * extension has the package's manifest in `dist/manifest/`, and `dist/` is
 * given to the module as the package it reads from.
 */

import { dirname, join } from "node:path"
import { runCommandLine } from "../../designsystem/src/wasi-host.js"

async function main() {
  // The path the file was started from. `__dirname` is replaced with the
  // source folder when the extension is packaged.
  const folder = dirname(process.argv[1] ?? ".")
  process.exit(
    await runCommandLine(join(folder, "lotek.wasm"), ["lsp"], folder),
  )
}

void main()
