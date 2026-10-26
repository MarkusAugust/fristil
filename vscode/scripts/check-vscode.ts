/**
 * The extension in a real VS Code: downloads VS Code, starts it with the
 * extension, and runs `test/suite.cjs` inside it. That tests the connection
 * to the language server, which no other test sees.
 *
 * Needs a network and a display, so in CI it runs under `xvfb-run`.
 *
 * Run with: bun run build && xvfb-run -a bun scripts/check-vscode.ts
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { runTests } from "@vscode/test-electron"

const extensionDir = fileURLToPath(new URL("..", import.meta.url))
const VERSION = (
  JSON.parse(readFileSync(join(extensionDir, "package.json"), "utf8")) as {
    engines: { vscode: string }
  }
).engines.vscode.replace(/^\^/, "")

try {
  await runTests({
    // The lowest version the extension promises to work on, `engines.vscode`.
    // The newest changes without warning, and the archive for 1.141.0 arrived
    // truncated.
    version: VERSION,
    extensionDevelopmentPath: extensionDir,
    extensionTestsPath: fileURLToPath(
      new URL("../test/suite.cjs", import.meta.url),
    ),
    launchArgs: [
      "--disable-extensions",
      "--disable-workspace-trust",
      // CI runs in a container as root, and Chromium will not start its
      // sandbox for root. Nowhere else does the flag apply.
      ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    ],
  })
  console.log("The extension gives findings and fixes in VS Code.")
  // `runTests` leaves something behind that fails after VS Code has closed,
  // and Bun then exits with an error code. The answer has already been given.
  process.exit(0)
} catch (error) {
  console.error(`✗ The extension in VS Code: ${error}`)
  process.exit(1)
}
