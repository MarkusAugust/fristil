import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.browser.test.ts"],
    // The model tests run on their own, before a pull request:
    // `vitest.model.config.ts`.
    exclude: ["src/**/*.model.browser.test.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      // Three browsers, because the whole premise is that we use the
      // browser's own APIs. Those are exactly what differ: :has(),
      // ::file-selector-button, <details name>, popover and pseudo-elements
      // on <input> behave differently.
      instances: [
        { browser: "chromium" },
        /*
         * Firefox runs one file at a time. Each file gets its own page, but
         * all the pages share one Firefox, and Playwright makes the page that
         * gets a mouse action the active window. The tests run in an iframe,
         * where Playwright's focus emulation does not apply: the other pages
         * get `blur`, `:focus` stops matching, and `:hover` goes away. The
         * test is correct, but another file took focus and mouse from it.
         * https://github.com/microsoft/playwright/issues/42933 (focus, open)
         * https://github.com/microsoft/playwright/issues/40562 (mouse)
         * Chromium and WebKit emulate focus and mouse per page.
         */
        { browser: "firefox", fileParallelism: false },
        { browser: "webkit" },
      ],
      headless: true,
      /*
       * Three minutes, not one, to reach a browser page.
       *
       * The default is 30 seconds, and on a busy machine, such as when two
       * test runs share three browsers, Firefox did not answer before the
       * deadline: "Failed to connect to the browser session … within the
       * timeout", in the middle of a run where 31 files were already green.
       * The deadline is not a test, and a run that stops on it says nothing
       * about the code.
       */
      connectTimeout: 180_000,
      // No test compares images, so the screenshots from failed runs just
      // piled up. The error message says the same. Set it back to true if you
      // ever need the image.
      screenshotFailures: false,
    },
  },
})
