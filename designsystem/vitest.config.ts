import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  optimizeDeps: {
    include: ["lit", "lit/directives/if-defined.js"],
  },
  test: {
    include: ["src/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
    },
  },
})
