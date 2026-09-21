/**
 * Kontrollerer at versjonsloggen følger pakken.
 *
 * En versjonslogg som ikke stemmer er verre enn ingen: den som leser den tror
 * den er ajour. Sjekken er derfor en del av byggesteget, ikke noe man husker.
 *
 * Kjør med: bun run sjekk:versjon
 */

import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROT = fileURLToPath(new URL("..", import.meta.url))
const pakke = await Bun.file(join(ROT, "package.json")).json()
const logg = await Bun.file(join(ROT, "CHANGELOG.md")).text()

const feil: string[] = []

const overskrifter = [...logg.matchAll(/^## (.+)$/gm)].map((treff) => treff[1])

if (overskrifter[0] !== "Ikke utgitt") {
  feil.push(
    "Første overskrift i CHANGELOG.md skal være «Ikke utgitt», slik at det finnes et sted å skrive endringer som ikke er sluppet ennå.",
  )
}

const utgitt = overskrifter
  .slice(1)
  .map((tekst) => tekst.match(/^(\d+\.\d+\.\d+)/)?.[1])

if (utgitt.some((versjon) => versjon === undefined)) {
  feil.push(
    "Hver overskrift under «Ikke utgitt» skal begynne med et versjonsnummer, for eksempel «## 0.2.0 (2026-09-21)».",
  )
}

if (!utgitt.includes(pakke.version)) {
  feil.push(
    `Versjonen i package.json er ${pakke.version}, men CHANGELOG.md har ingen overskrift for den. Skriv om «Ikke utgitt» til «## ${pakke.version} (${new Date().toISOString().slice(0, 10)})» når du slipper den.`,
  )
}

// Versjonene skal stå med den nyeste øverst.
const sortert = [...utgitt].sort((a, b) =>
  (b ?? "").localeCompare(a ?? "", undefined, { numeric: true }),
)
if (utgitt.join() !== sortert.join()) {
  feil.push("Versjonene i CHANGELOG.md skal stå med den nyeste øverst.")
}

// Filen må være med i pakken, ellers ser ingen den på npm.
if (!(pakke.files as string[]).includes("CHANGELOG.md")) {
  feil.push("CHANGELOG.md må stå i «files» i package.json for å bli sendt ut.")
}

if (feil.length > 0) {
  console.error(
    `Versjonsloggen stemmer ikke:\n\n${feil.map((f) => `  ${f}`).join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Versjonsloggen stemmer: ${pakke.version} er beskrevet, og «Ikke utgitt» står øverst.`,
)
