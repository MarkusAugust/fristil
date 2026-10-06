/**
 * `llms.txt`: inngangen for en agent som bare har nettilgang.
 *
 * Etter oppskriften på llmstxt.org: én overskrift, ett sammendrag, og så lenker
 * med en linje hver. Den er en indeks, ikke en regelbok. Reglene i sin helhet
 * står i `/agent/<navn>.md`, én komplett fil per miljø.
 *
 * De fire reglene står likevel her, i kortform. En agent som henter bare denne
 * fila og ikke følger en eneste lenke, skal fortsatt slippe å gjette på det som
 * koster mest.
 *
 * Alt utenom de fire reglene leses av innholdet: regelbøkene av mappa de ligger
 * i, og sidelista av samlingen Starlight bygger. Da kan ingen av dem gli fra
 * det som faktisk finnes.
 */

import { getCollection } from "astro:content"
import type { APIRoute } from "astro"
import pakke from "../../../designsystem/package.json"

const BASE = pakke.homepage.replace(/\/$/, "")

/*
 * Regelbøkene hentes med `import.meta.glob`, som Vite løser ved bygging. En sti
 * regnet ut fra `import.meta.url` peker på chunken etter bundling, ikke på kilden.
 */
const BØKER = import.meta.glob("../../../designsystem/agent/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/** Overskrifta og første avsnitt i en regelbok, som tittel og beskrivelse. */
function lesRegelbok(sti: string) {
  const navn = sti.replace(/^.*\/|\.md$/g, "")
  const tekst = BØKER[sti]
  const tittel = /^# (.+)$/m.exec(tekst)?.[1] ?? navn
  const avsnitt = tekst.split("\n\n")[1] ?? ""

  /*
   * Første setning er nok på en indeksrad, og lenkelista skal kunne leses.
   * Delingen skjer etter punktumet, ikke på det, så setningen beholder sitt
   * eget og ikke får et nytt på toppen.
   */
  const første = avsnitt.replace(/\n/g, " ").split(/(?<=\.)\s/)[0]

  return { navn, tittel, beskrivelse: første.replace(/^Regelboka for /, "") }
}

const REGELBØKER = Object.keys(BØKER).sort().map(lesRegelbok)

const REGLENE = `Fire feil står for nesten alt som går galt. De gjelder i alle miljøer:

1. Stilarket må lastes. Mangler det, ser komponentene ustilte ut, og svaret er
   å laste det, aldri å skrive egen CSS for å få dem til å se riktige ut.
2. Bare klassene og elementene som finnes, finnes. \`fs-modal\`,
   \`fs-datepicker\` og \`data-variant="outline"\` hører til andre
   designsystemer. Hele lista står i hver regelbok.
3. Ingen hardkodede farger eller piksler. \`var(--fs-color-…)\` og
   \`var(--fs-spacing-…)\`.
4. Web components registreres én gang med \`defineFs*()\`, og et boolsk
   attributt er sant så lenge det står der: \`invalid="false"\` gjør feltet
   ugyldig. Attributtet må fjernes, ikke settes til \`false\`.

Sjekk markupen når du er ferdig, og rett det den melder:

    npx @fristil/designsystem sjekk <fil>
    npx @fristil/designsystem sjekk http://localhost:8080/side

Den kjenner hver klasse, hvert element, hvert attributt og hver lovlige verdi,
skriver \`fil:linje:kolonne: feil: melding\`, eller \`advarsel:\`, og avslutter med feilkode ved funn.
Med en adresse sjekker den siden slik serveren sender den, og krever i tillegg
at hver \`for\` og \`aria-describedby\` peker på en id som finnes, og at hvert
felt har en ledetekst. Du er ferdig når begge svarer «Markupen stemmer med
Fristil». Alt om kommandoene: ${BASE}/kommandolinjen/`

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
    adresse: `${BASE}/${id}/`,
  })

  const veiledning: Rad[] = []
  const mønstre: Rad[] = []
  const komponenter: Rad[] = []

  for (const side of sider.sort((a, b) => a.id.localeCompare(b.id))) {
    const rad = somRad(side.id, side.data)
    if (side.id.startsWith("components/")) komponenter.push(rad)
    else if (side.id.startsWith("monster/")) mønstre.push(rad)
    else veiledning.push(rad)
  }

  const tekst = [
    "# Fristil",
    `> ${pakke.description} Versjon ${pakke.version}. Komponentene er CSS-klasser og web components, altså ting nettleseren allerede forstår, så de samme komponentene virker i ren HTML, i en Go-mal, med bundles, i React, i Astro og med Datastar.`,
    REGLENE,
    seksjon(
      "Regelbøker for kodeagenter",
      REGELBØKER.map(({ navn, tittel, beskrivelse }) => ({
        tittel,
        beskrivelse,
        adresse: `${BASE}/agent/${navn}.md`,
      })),
    ),
    `Hver regelbok er komplett for sitt miljø. Er pakken
installert, ligger de samme filene i
\`node_modules/@fristil/designsystem/agent/\`, og \`npx @fristil/designsystem agent\`
skriver den som passer dette prosjektet.`,
    seksjon("Veiledning", veiledning),
    seksjon("Mønstre", mønstre),
    seksjon("Komponenter", komponenter),
  ]
    .filter(Boolean)
    .join("\n\n")

  return new Response(`${tekst}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  })
}
