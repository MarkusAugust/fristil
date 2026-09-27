import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
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
      /*
       * Tre minutter og ikke ett på å få kontakt med en nettleserside.
       *
       * Standarden er 30 sekunder, og på en travel maskin, som når to
       * testkjøringer deler tre nettlesere, rakk ikke Firefox å svare før
       * fristen: «Failed to connect to the browser session … within the
       * timeout», midt i en kjøring der 31 filer alt var grønne. Fristen er
       * ikke en test, og en kjøring som stopper på den sier ingenting om
       * koden.
       */
      connectTimeout: 180_000,
      // Ingen tester sammenlikner bilder, så skjermbildene fra feilede
      // kjøringer ble bare liggende og samle seg. Feilmeldingen sier det
      // samme. Sett den til true igjen om du trenger bildet en gang.
      screenshotFailures: false,
    },
  },
})
