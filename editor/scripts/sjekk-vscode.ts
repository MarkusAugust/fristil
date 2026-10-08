/**
 * Utvidelsen i en ekte VS Code: laster ned VS Code, starter den med
 * utvidelsen, og kjører `test/suite.cjs` inne i den. Det prøver koblingen
 * til språkserveren, som ingen annen test ser.
 *
 * Trenger nettverk og en skjerm, så i CI kjøres den med `xvfb-run`.
 *
 * Kjør med: bun run build && xvfb-run -a bun scripts/sjekk-vscode.ts
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { runTests } from "@vscode/test-electron"

const utvidelse = fileURLToPath(new URL("..", import.meta.url))
const VERSJON = (
  JSON.parse(readFileSync(join(utvidelse, "package.json"), "utf8")) as {
    engines: { vscode: string }
  }
).engines.vscode.replace(/^\^/, "")

try {
  await runTests({
    // Den laveste versjonen utvidelsen lover å virke på, `engines.vscode`.
    // Den nyeste endrer seg uten varsel, og arkivet for 1.141.0 kom avkuttet.
    version: VERSJON,
    extensionDevelopmentPath: utvidelse,
    extensionTestsPath: fileURLToPath(
      new URL("../test/suite.cjs", import.meta.url),
    ),
    launchArgs: ["--disable-extensions", "--disable-workspace-trust"],
  })
  console.log("Utvidelsen gir funn og rettelser i VS Code.")
  // `runTests` lar noe stå igjen som feiler etter at VS Code er lukket, og
  // Bun avslutter da med feilkode. Svaret er alt gitt.
  process.exit(0)
} catch (error) {
  console.error(`✗ Utvidelsen i VS Code: ${error}`)
  process.exit(1)
}
