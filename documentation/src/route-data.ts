/**
 * Pekeren til Markdown-utgaven, i sidehodet på hver side Starlight lager.
 *
 * En agent som har hentet HTML-en, finner Markdown-utgaven her uten å kjenne
 * regelen for adressen. Lenken er også det `markdownsider.mjs` leser når den
 * skriver filene: står den på en side, lages fila, og står den ikke, lages den
 * ikke. Da kan lenken aldri peke på noe som mangler.
 *
 * 404-siden får ingen. Den har ikke noe innhold en agent er ute etter.
 */

import { defineRouteMiddleware } from "@astrojs/starlight/route-data"
import { markdownAdresse } from "./markdownadresse"

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
