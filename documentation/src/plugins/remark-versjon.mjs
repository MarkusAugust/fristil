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
 * i lenkeadresser. Det dekker alle adressene i dag.
 *
 * Det den ikke når, er verdier som ikke ligger i `children`: JSX-attributter
 * som `kode={…}`, bildeadresser, mdx-uttrykk og frontmatter. Skriver noen en
 * adresse et slikt sted, blir plassholderen stående, og det er
 * `sjekk-bygget-versjon.ts` som fanger den: den krever at hver adresse
 * plassholderen står i, finnes i det bygde med versjonen satt inn.
 */

import { readFileSync } from "node:fs"

const PLASSHOLDER = "@fristil/designsystem@VERSJON"

const { version } = JSON.parse(
  readFileSync(new URL("../../../designsystem/package.json", import.meta.url)),
)

const MED_VERSJON = `@fristil/designsystem@${version}`

// Tarballen i npm-registeret, for den som henter pakken uten npm.
const TARBALL = "designsystem-VERSJON.tgz"

/*
 * Maven-koordinatene og WebJar-stien på Kotlin-siden har samme versjon som
 * npm-pakken, og sto med `{versjon}` i kilden, som leseren fikk se
 * bokstavelig. Ordet VERSJON byttes der det står rett etter
 * `markusaugust:fristil:`, `markusaugust.fristil") version "` og
 * `webjars/fristil/`, og ingen andre steder: et løst VERSJON i brødtekst
 * skal fortsatt stå, så `sjekk-bygget-versjon.ts` kan si fra om det.
 */
const MAVEN = [
  [
    "io.github.markusaugust:fristil:VERSJON",
    `io.github.markusaugust:fristil:${version}`,
  ],
  [
    'io.github.markusaugust.fristil") version "VERSJON"',
    `io.github.markusaugust.fristil") version "${version}"`,
  ],
  ["webjars/fristil/VERSJON/", `webjars/fristil/${version}/`],
]

const bytt = (tekst) => {
  if (typeof tekst !== "string") return tekst
  let ut = tekst
    .split(PLASSHOLDER)
    .join(MED_VERSJON)
    .split(TARBALL)
    .join(`designsystem-${version}.tgz`)
  for (const [fra, til] of MAVEN) ut = ut.split(fra).join(til)
  return ut
}

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
