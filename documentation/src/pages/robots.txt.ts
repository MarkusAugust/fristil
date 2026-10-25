/**
 * `robots.txt`: everything is open, and the sitemap is listed here.
 *
 * Without the file, an agent searching the web found neither `llms.txt` nor
 * the rulebooks, because no search engine had been given a list of the pages.
 * The address is read from `homepage` in the package, as `llms.txt` also does.
 */

import type { APIRoute } from "astro"
import pakke from "../../../interfaces/package.json"

const BASE = pakke.homepage.replace(/\/$/, "")

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap-index.xml\n`,
    {
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  )
