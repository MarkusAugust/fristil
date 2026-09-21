/**
 * Setter versjonen som skal publiseres, i begge filene den står i. Den
 * skriver bare de to filene, og publiserer ingenting.
 *
 * En utgivelse består av tre ting som må si det samme: nummeret i
 * `package.json`, overskriften i `CHANGELOG.md`, og taggen i git. Settes de
 * for hånd, er det lett å tagge `v0.3.0` på en commit som fortsatt sier
 * `0.2.0`. Da stopper kontrollen i `publish.yml` kjøringen, men først etter at
 * taggen er dyttet opp, og en tagg som er dyttet opp må fjernes igjen.
 *
 * Kjør med: bun run versjon <neste versjon>
 */

import { join } from "node:path"
import { fileURLToPath } from "node:url"

const pakke = fileURLToPath(new URL("../", import.meta.url))
const manifestSti = join(pakke, "package.json")
const loggSti = join(pakke, "CHANGELOG.md")

const UUTGITT = "## Ikke utgitt"

function stopp(melding: string): never {
  console.error(melding)
  process.exit(1)
}

const nyVersjon = process.argv[2]

if (!nyVersjon) {
  stopp("Mangler versjonsnummer. Bruk: bun run versjon 0.4.0")
}

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(nyVersjon)) {
  stopp(`«${nyVersjon}» er ikke et versjonsnummer på formen 0.3.0.`)
}

const manifest = await Bun.file(manifestSti).text()
const logg = await Bun.file(loggSti).text()

const naavaerende = (JSON.parse(manifest) as { version: string }).version

if (!erHoyere(nyVersjon, naavaerende)) {
  stopp(
    `Versjonen må være høyere enn ${naavaerende}, og ${nyVersjon} er det ikke.`,
  )
}

if (new RegExp(`^## ${nyVersjon.replace(/\./g, "\\.")}\\b`, "m").test(logg)) {
  stopp(`Versjonsloggen har allerede en overskrift for ${nyVersjon}.`)
}

const start = logg.indexOf(UUTGITT)

if (start === -1) {
  stopp(`Fant ingen «${UUTGITT}» i versjonsloggen.`)
}

// Det som står mellom «Ikke utgitt» og neste versjonsoverskrift er innholdet
// som skal ut. Er det tomt, er det ingenting å gi ut, og en tom overskrift i
// loggen er verre enn ingen utgivelse.
const resten = logg.slice(start + UUTGITT.length)
const neste = resten.search(/\n## \d/)
const innhold = (neste === -1 ? resten : resten.slice(0, neste)).trim()

if (innhold === "") {
  stopp(
    "«Ikke utgitt» er tom, så det er ingenting å gi ut. Skriv hva som er endret først.",
  )
}

const dato = new Date().toISOString().slice(0, 10)

await Bun.write(
  loggSti,
  logg.replace(UUTGITT, `${UUTGITT}\n\n## ${nyVersjon} (${dato})`),
)
await Bun.write(
  manifestSti,
  manifest.replace(`"version": "${naavaerende}"`, `"version": "${nyVersjon}"`),
)

console.log(`Versjonen er satt til ${nyVersjon}, med dato ${dato}.

Slik gir du den ut:

  bun run sjekk
  git checkout -b slipp-${nyVersjon}
  git commit -am "chore: slipp ${nyVersjon}"
  git push -u origin slipp-${nyVersjon} && gh pr create --fill

Når grenen er slått sammen, og først da:

  git checkout master && git pull
  git tag v${nyVersjon} && git push origin v${nyVersjon}`)

/** Sammenligner to versjoner på formen 0.3.0, tall for tall. */
function erHoyere(ny: string, gammel: string): boolean {
  const a = ny.split(".").map(Number)
  const b = gammel.split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }

  return false
}
