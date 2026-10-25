/**
 * The pointer to the Markdown version, in the head of every page Starlight
 * makes.
 *
 * An agent that has fetched the HTML finds the Markdown version here without
 * knowing the rule for the address. The link is also what `markdown-pages.mjs`
 * reads when it writes the files: if it is on a page, the file is made, and if
 * it is not, the file is not. So the link can never point at something missing.
 *
 * The 404 page gets none. It has no content an agent is looking for.
 */

import { defineRouteMiddleware } from "@astrojs/starlight/route-data"
import { markdownAdresse } from "./markdown-address"

export const onRequest = defineRouteMiddleware((kontekst) => {
  const rute = kontekst.locals.starlightRoute

  if (rute.entry.id === "404") return

  rute.head.push({
    tag: "link",
    attrs: {
      rel: "alternate",
      type: "text/markdown",
      href: markdownAdresse(kontekst.url.pathname),
      title: "Markdown",
    },
  })
})
