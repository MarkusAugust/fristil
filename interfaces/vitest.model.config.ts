import { defineConfig } from "vitest/config"
import base from "./vitest.config"

/**
 * The model tests, in all three browsers: every order of server updates and
 * user actions to a fixed depth, for each frame component
 * (`*.model.browser.test.ts`, on the search in `src/testing/model.ts`).
 *
 * Not in `bun run test`, `bun run check` or CI. They search for bugs nobody
 * has thought of, rather than guard what is known, and took the check from
 * nine minutes to sixteen. They are run before a pull request that touches a
 * frame component, `host-element.ts` or the search:
 *
 *     bun run test:model
 *
 * A bug they find gets a scenario test of its own next to the component,
 * which the ordinary run keeps.
 */
// Not `mergeConfig`: it joins the lists, and `include` would hold every test.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["src/**/*.model.browser.test.ts"],
    exclude: [],
  },
})
