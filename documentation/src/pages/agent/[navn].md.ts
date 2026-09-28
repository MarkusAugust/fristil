/**
 * Regelbøkene som filer på nettsiden, på en stabil adresse.
 *
 * Den viktigste agenten har ingen `node_modules`. Blir noen bedt om å «lage et
 * skjema med Fristil» i en tom mappe, skrives markupen før `npm install` har
 * kjørt, og regelboka i pakken er da usynlig. Derfor ligger de samme filene
 * her, på `/agent/<navn>.md`, hentbare med nettilgang alene.
 *
 * Filene hentes med `import.meta.glob`, som Vite løser når siden bygges, framfor
 * med `readFileSync` og en relativ sti. En sti regnet ut fra `import.meta.url`
 * peker på chunken etter bundling, ikke på kilden, og traff bare ved at antallet
 * mapper opp tilfeldigvis var det samme. Her finnes ingen sti å bomme på, og
 * innholdet er det samme som pakken sender med: én kilde, to kanaler.
 */

import type { APIRoute, GetStaticPaths } from "astro"

const BØKER = import.meta.glob("../../../../designsystem/agent/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const navnet = (sti: string) => sti.replace(/^.*\/|\.md$/g, "")

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(BØKER).map((sti) => ({ params: { navn: navnet(sti) } }))

export const GET: APIRoute = ({ params }) => {
  const sti = Object.keys(BØKER).find(
    (kandidat) => navnet(kandidat) === params.navn,
  )

  if (!sti) return new Response("Finnes ikke", { status: 404 })

  return new Response(BØKER[sti], {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  })
}
