/**
 * Språkserveren, startet av utvidelsen: `lotek lsp`, kjørt som WASI-modul
 * med Node sin egen `node:wasi`, akkurat som `npx @lo-tek/interfaces lsp`.
 *
 * Modulen ligger ved siden av i `dist/`. Den leser manifestet prosjektet har
 * installert, eller det Gradle-pluginen har skrevet. Som reserve har
 * utvidelsen pakkens manifest i `dist/manifest/`, og `dist/` gis modulen
 * som pakken den leser fra.
 */

import { dirname, join } from "node:path"
import { runCommandLine } from "../../designsystem/src/wasi-host.js"

async function main() {
  // Stien fila ble startet fra. `__dirname` er byttet ut med kildemappa
  // når utvidelsen pakkes.
  const folder = dirname(process.argv[1] ?? ".")
  process.exit(
    await runCommandLine(join(folder, "lotek.wasm"), ["lsp"], folder),
  )
}

void main()
