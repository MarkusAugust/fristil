/**
 * `llms.txt`: the entry point for an agent that only has web access.
 *
 * Following the format on llmstxt.org: one heading, one summary, and then
 * links with one line each. It is an index, not a rulebook. The rules in full
 * are in `/agent/<name>.md`, one complete file per environment.
 *
 * The four rules are still here, in short form. An agent that fetches only
 * this file and follows not a single link should still not have to guess at
 * what costs the most.
 *
 * Everything apart from the four rules is read from the content: the rulebooks
 * from the folder they are in, and the page list from the collection Starlight
 * builds. Then none of them can drift from what actually exists.
 */

import { getCollection } from "astro:content"
import type { APIRoute } from "astro"
import pakke from "../../../designsystem/package.json"
import { markdownAdresse } from "../markdown-address"

const BASE = pakke.homepage.replace(/\/$/, "")

/*
 * The rulebooks are loaded with `import.meta.glob`, which Vite resolves at build
 * time. A path computed from `import.meta.url` points at the chunk after
 * bundling, not at the source.
 */
const BØKER = import.meta.glob("../../../designsystem/agent/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/** The heading and first paragraph of a rulebook, as title and description. */
function lesRegelbok(sti: string) {
  const navn = sti.replace(/^.*\/|\.md$/g, "")
  const tekst = BØKER[sti]
  const tittel = /^# (.+)$/m.exec(tekst)?.[1] ?? navn
  const avsnitt = tekst.split("\n\n")[1] ?? ""

  /*
   * The first sentence is enough on an index row, and the link list has to be
   * readable. The split happens after the full stop, not on it, so the
   * sentence keeps its own and does not get another one added.
   */
  const første = avsnitt.replace(/\n/g, " ").split(/(?<=\.)\s/)[0]

  return {
    navn,
    tittel,
    beskrivelse: første.replace(/^(?:Regelboka|The rulebook) for /, ""),
  }
}

const REGELBØKER = Object.keys(BØKER).sort().map(lesRegelbok)

const REGLENE = `Four mistakes account for almost everything that goes wrong. They apply in every environment:

1. The stylesheet must be loaded. If it is missing, the components look
   unstyled, and the answer is to load it, never to write your own CSS to make
   them look right.
2. Only the classes and elements that exist, exist. \`lt-modal\`,
   \`lt-datepicker\` and \`data-variant="outline"\` belong to other design
   systems. The full list is in every rulebook.
3. No hard-coded colours or pixels. \`var(--lt-color-…)\` and
   \`var(--lt-spacing-…)\`.
4. Web components are registered once with \`defineLt*()\`, and a boolean
   attribute is true as long as it is there: \`invalid="false"\` makes the
   field invalid. The attribute has to be removed, not set to \`false\`.

Check the markup when you are done, and fix what it reports:

    npx @lo-tek/interfaces check <file>
    npx @lo-tek/interfaces check http://localhost:8080/page

It knows every class, every element, every attribute and every valid value,
writes \`file:line:column: error: message\`, or \`warning:\`, and exits with an error code when it finds something.
With an address it checks the page as the server sends it, and also requires
that every \`for\` and \`aria-describedby\` points at an id that exists, and
that every field has a label. You are done when both answer "The markup
matches LO-TEK". Everything about the commands: ${BASE}/command-line/`

type Rad = { tittel: string; beskrivelse: string; adresse: string }

function seksjon(overskrift: string, rader: Rad[]): string {
  if (rader.length === 0) return ""

  const linjer = rader.map(
    ({ tittel, beskrivelse, adresse }) =>
      `- [${tittel}](${adresse})${beskrivelse ? `: ${beskrivelse}` : ""}`,
  )

  return `## ${overskrift}\n\n${linjer.join("\n")}`
}

export const GET: APIRoute = async () => {
  const sider = await getCollection("docs")

  const somRad = (
    id: string,
    data: { title: string; description?: string },
  ) => ({
    tittel: data.title,
    beskrivelse: data.description ?? "",
    adresse: `${BASE}${markdownAdresse(`/${id}/`)}`,
  })

  const veiledning: Rad[] = []
  const mønstre: Rad[] = []
  const komponenter: Rad[] = []

  for (const side of sider.sort((a, b) => a.id.localeCompare(b.id))) {
    const rad = somRad(side.id, side.data)
    if (side.id.startsWith("components/")) komponenter.push(rad)
    else if (side.id.startsWith("patterns/")) mønstre.push(rad)
    else veiledning.push(rad)
  }

  const tekst = [
    "# LO-TEK",
    `> ${pakke.description} Version ${pakke.version}. The components are CSS classes and web components, things the browser already understands, so the same components work in plain HTML, in a Go template, with bundles, in React, in Astro and with Datastar.`,
    REGLENE,
    seksjon(
      "Rulebooks for coding agents",
      REGELBØKER.map(({ navn, tittel, beskrivelse }) => ({
        tittel,
        beskrivelse,
        adresse: `${BASE}/agent/${navn}.md`,
      })),
    ),
    `Each rulebook is complete for its environment. If the package is
installed, the same files are in
\`node_modules/@lo-tek/interfaces/agent/\`, and \`npx @lo-tek/interfaces agent\`
writes the one that fits this project.`,
    seksjon("Guides", veiledning),
    seksjon("Patterns", mønstre),
    seksjon("Components", komponenter),
  ]
    .filter(Boolean)
    .join("\n\n")

  return new Response(`${tekst}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
