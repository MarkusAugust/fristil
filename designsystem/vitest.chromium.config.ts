import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

// Midlertidig testoppsett for testeren: bare Chromium 141 fra /opt/pw-browsers.
export default defineConfig({
  test: {
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
      }),
      instances: [{ browser: "chromium" }],
      headless: true,
      connectTimeout: 180_000,
      screenshotFailures: false,
    },
  },
})
