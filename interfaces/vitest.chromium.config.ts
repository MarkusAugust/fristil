import { existsSync } from "node:fs"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import base from "./vitest.config"

/**
 * The tests in a Chromium already installed on the machine, without
 * `playwright install`.
 *
 * For an environment without network access, or where Playwright's own
 * browsers cannot be downloaded. Chromium only: Playwright can use a regular
 * Chrome or Chromium, but Firefox and WebKit must be Playwright's own builds.
 * CI and `bun run check` still use all three.
 *
 * The path is read from `CHROMIUM`, and otherwise the usual places are tried.
 *
 *     CHROMIUM=/usr/bin/chromium bun --filter @lo-tek/interfaces test:chromium
 */
const candidates = [
  process.env.CHROMIUM,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter((path): path is string => path !== undefined && path !== "")

const executablePath = candidates.find((path) => existsSync(path))
if (executablePath === undefined)
  throw new Error(
    `No Chromium found. Set CHROMIUM to its path. Tried: ${candidates.join(", ")}`,
  )

// The fields are overridden by hand: `mergeConfig` concatenates lists, and
// Chromium would then have run twice alongside Firefox and WebKit.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    browser: {
      ...base.test?.browser,
      provider: playwright({ launchOptions: { executablePath } }),
      instances: [{ browser: "chromium" }],
    },
  },
})
