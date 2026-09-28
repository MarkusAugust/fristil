/**
 * Setter pakkeversjonen inn i dokumentasjonen, fra én kilde.
 *
 * CDN-adressene i eksemplene må peke på en versjon som finnes, og de sto
 * skrevet for hånd 74 steder i 12 filer. Ved hver utgivelse måtte alle 74
 * endres, og en som ble glemt ville sendt leseren til en gammel pakke uten at
 * noe sa fra. Nå står plassholderen `@fristil/designsystem@VERSJON` i kilden,
 * og versjonen leses av `designsystem/package.json` når siden bygges.
 *
 * `sjekk-dokumentasjon.ts` feller hvis noen skriver tallet for hånd likevel.
 *
 * Plassholderen byttes i kodeblokker, i kode inne i en setning, i brødtekst og
 * i lenkeadresser, altså overalt en adresse kan stå.
 */

import { readFileSync } from "node:fs"

const PLASSHOLDER = "@fristil/designsystem@VERSJON"

const { version } = JSON.parse(
  readFileSync(new URL("../../../designsystem/package.json", import.meta.url)),
)

const MED_VERSJON = `@fristil/designsystem@${version}`

const bytt = (tekst) =>
  typeof tekst === "string" && tekst.includes(PLASSHOLDER)
    ? tekst.split(PLASSHOLDER).join(MED_VERSJON)
    : tekst

export function remarkVersjon() {
  return (tre) => besok(tre)
}

function besok(node) {
  if (
    node.type === "code" ||
    node.type === "inlineCode" ||
    node.type === "text"
  )
    node.value = bytt(node.value)

  if (node.type === "link" || node.type === "definition")
    node.url = bytt(node.url)

  for (const barn of node.children ?? []) besok(barn)
}
