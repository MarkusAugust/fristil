import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  optimizeDeps: {
    include: [
      "lit",
      "lit/directives/if-defined.js",
      "lit/directives/live.js",
    ],
  },
  test: {
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
      // Ingen tester sammenlikner bilder, så skjermbildene fra feilede
      // kjøringer ble bare liggende og samle seg. Feilmeldingen sier det
      // samme. Sett den til true igjen om du trenger bildet en gang.
      screenshotFailures: false,
    },
  },
})
