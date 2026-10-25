import { defineEcConfig } from "@astrojs/starlight/expressive-code"
import { ecTabindex } from "./src/plugins/ec-tabindex.mjs"

/*
 * The Expressive Code options are here and not in `astro.config.mjs`. The
 * `<Code>` component requires the options there to be serialisable as JSON,
 * and a plugin with functions is not. Starlight reads this file itself.
 */
export default defineEcConfig({
  /*
   * Expressive Code writes its stylesheet as a `<link>` inside `<body>`, at
   * the first code block on the page. On the component pages the browser only
   * sees it about 36,000 characters into the document, and has to stop
   * rendering on it: 59 of 61 pages had a render-blocking stylesheet in the
   * middle of the content. With `emitExternalStylesheet: false` the styles are
   * inlined instead, and no page has that any more. The cost is about 4 kB
   * gzip more HTML per page: no extra round trip, in exchange for a slightly
   * larger first response.
   */
  emitExternalStylesheet: false,
  // Keyboard access to the code blocks in the HTML. See `ec-tabindex.mjs`.
  plugins: [ecTabindex()],
})
