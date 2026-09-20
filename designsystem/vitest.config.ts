import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  optimizeDeps: {
    include: ["lit", "lit/directives/if-defined.js", "lit/directives/live.js"],
  },
  test: {
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      // Tre nettlesere, fordi hele premisset er at vi bruker nettleserens
      // egne API-er. Det er nettopp de som spriker: :has(),
      // ::file-selector-button, <details name>, popover og pseudoelementer
      // på <input> oppfører seg ulikt.
      instances: [
        { browser: "chromium" },
        { browser: "firefox" },
        { browser: "webkit" },
      ],
      headless: true,
      // Ingen tester sammenlikner bilder, så skjermbildene fra feilede
      // kjøringer ble bare liggende og samle seg. Feilmeldingen sier det
      // samme. Sett den til true igjen om du trenger bildet en gang.
      screenshotFailures: false,
    },
  },
})
