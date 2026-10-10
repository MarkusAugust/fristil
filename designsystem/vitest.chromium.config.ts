import { existsSync } from "node:fs"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import base from "./vitest.config"

/**
 * Testene i en Chromium som alt står på maskinen, uten `playwright install`.
 *
 * For et miljø uten nett, eller der Playwrights egne nettlesere ikke kan
 * hentes. Bare Chromium: Playwright kan bruke en vanlig Chrome eller
 * Chromium, men Firefox og WebKit må være Playwrights egne bygg. CI og
 * `bun run sjekk` bruker fortsatt alle tre.
 *
 * Stien leses fra `CHROMIUM`, og ellers prøves de vanlige stedene.
 *
 *     CHROMIUM=/usr/bin/chromium bun --filter @fristil/designsystem test:chromium
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
    `Fant ingen Chromium. Sett CHROMIUM til stien. Prøvde: ${candidates.join(", ")}`,
  )

// Feltene overstyres for hånd: `mergeConfig` legger lister etter hverandre,
// og da ville Chromium kjørt to ganger ved siden av Firefox og WebKit.
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
