/**
 * `robots.txt`: alt er åpent, og sitemapen står her.
 *
 * Uten fila fant en agent som søkte på nettet verken `llms.txt` eller
 * regelbøkene, fordi ingen søkemotor hadde fått en liste over sidene.
 * Adressen leses av `homepage` i pakken, som `llms.txt` også gjør.
 */

import type { APIRoute } from "astro"
import pakke from "../../../designsystem/package.json"

const BASE = pakke.homepage.replace(/\/$/, "")

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap-index.xml\n`,
    {
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  )
