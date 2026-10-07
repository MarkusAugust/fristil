/**
 * Utvidelsen i en ekte VS Code: laster ned VS Code, starter den med
 * utvidelsen, og kjører `test/suite.cjs` inne i den. Det prøver koblingen
 * til språkserveren, som ingen annen test ser.
 *
 * Trenger nettverk og en skjerm, så i CI kjøres den med `xvfb-run`.
 *
 * Kjør med: bun run build && xvfb-run -a bun scripts/sjekk-vscode.ts
 */

import { fileURLToPath } from "node:url"
import { runTests } from "@vscode/test-electron"

const utvidelse = fileURLToPath(new URL("..", import.meta.url))

try {
  await runTests({
    extensionDevelopmentPath: utvidelse,
    extensionTestsPath: fileURLToPath(
      new URL("../test/suite.cjs", import.meta.url),
    ),
    launchArgs: ["--disable-extensions", "--disable-workspace-trust"],
  })
  console.log("Utvidelsen gir funn og rettelser i VS Code.")
} catch (error) {
  console.error(`✗ Utvidelsen i VS Code: ${error}`)
  process.exit(1)
}
