/**
 * Setter versjonen som skal publiseres, i de tre filene den står i. Den
 * skriver bare filene, og publiserer ingenting.
 *
 * En utgivelse består av tre ting som må si det samme: nummeret i
 * `package.json`, overskriften i `CHANGELOG.md`, og taggen i git. Settes de
 * for hånd, er det lett å tagge `v0.3.0` på en commit som fortsatt sier
 * `0.2.0`. Da stopper kontrollen i `publish.yml` kjøringen, men først etter at
 * taggen er dyttet opp, og en tagg som er dyttet opp må fjernes igjen.
 *
 * Kjør med: bun run prepare-version <neste versjon>
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const pakke = fileURLToPath(new URL("../", import.meta.url))
const monorepoRot = fileURLToPath(new URL("../../", import.meta.url))
const manifestSti = join(pakke, "package.json")
const loggSti = join(pakke, "CHANGELOG.md")

const UUTGITT = "## Ikke utgitt"

function stopp(melding: string): never {
  console.error(melding)
  process.exit(1)
}

const nyVersjon = process.argv[2]

if (!nyVersjon) {
  stopp("Mangler versjonsnummer. Bruk: bun run prepare-version 0.4.0")
}

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(nyVersjon)) {
  stopp(`«${nyVersjon}» er ikke et versjonsnummer på formen 0.3.0.`)
}

const manifest = await Bun.file(manifestSti).text()
const logg = await Bun.file(loggSti).text()

const { name: pakkenavn, version: naavaerende } = JSON.parse(manifest) as {
  name: string
  version: string
}

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

// Datoen leses lokalt, ikke i UTC. `toISOString` ga dagen før når versjonen
// ble satt etter midnatt norsk tid, og loggen skal stå med den dagen den som
// gir ut faktisk hadde.
const naa = new Date()
const dato = [
  naa.getFullYear(),
  String(naa.getMonth() + 1).padStart(2, "0"),
  String(naa.getDate()).padStart(2, "0"),
].join("-")

await Bun.write(
  loggSti,
  logg.replace(UUTGITT, `${UUTGITT}\n\n## ${nyVersjon} (${dato})`),
)
await Bun.write(
  manifestSti,
  manifest.replace(`"version": "${naavaerende}"`, `"version": "${nyVersjon}"`),
)

// `bun.lock` har også versjonen til hvert workspace i seg, og den blir
// hengende igjen på forrige nummer. Testet med bun 1.3.14: dette stopper
// ikke `--frozen-lockfile`, som bare sammenligner oppløsningene av
// avhengigheter. Publiseringen går altså gjennom uansett.
//
// Den skrives likevel her, fordi en lockfil som oppgir feil versjon er
// villedende for den som leser den, og avviket bare vokser for hver utgivelse.
//
// Verdien må settes for hånd. Verken `bun install`, `--lockfile-only` eller
// `--force` oppdaterer den når det bare er versjonen som har endret seg. Bare
// en full regenerering gjør det, og å slette lockfila i et slipp ville rørt
// oppløsninger som ikke har noe med saken å gjøre.
const lockSti = join(monorepoRot, "bun.lock")
const lock = await Bun.file(lockSti).text()
const lockMonster = new RegExp(
  `("name":\\s*"${pakkenavn}",\\s*\n\\s*"version":\\s*")[^"]+(")`,
)

if (!lockMonster.test(lock)) {
  stopp(
    `Fant ikke versjonen til ${pakkenavn} i bun.lock. Sjekk formatet før du gir ut.`,
  )
}

await Bun.write(lockSti, lock.replace(lockMonster, `$1${nyVersjon}$2`))

/*
 * CDN-adressene i dokumentasjonen står med versjonen i seg.
 *
 * Oppskriftene i sporene uten byggesteg peker på en hel URL, siden en
 * nettleser ikke kan slå opp et pakkenavn. Adressene sto hardkodet 74 steder
 * i ni filer, og ingenting oppdaterte dem: ved neste utgivelse ville de
 * pekt på en eldre pakke enn teksten rundt dem beskrev. `sjekk-oppskrifter`
 * feller det, men først etter at noen har oppdaget det.
 */
const dokRot = join(monorepoRot, "documentation/src/content/docs")
let cdnEndret = 0
const oppdaterCdn = (mappe: string) => {
  for (const oppf of readdirSync(mappe, { withFileTypes: true })) {
    const p = join(mappe, oppf.name)
    if (oppf.isDirectory()) oppdaterCdn(p)
    else if (oppf.name.endsWith(".mdx")) {
      const før = readFileSync(p, "utf8")
      const etter = før.replaceAll(
        /@fristil\/designsystem@\d+\.\d+\.\d+\//g,
        `@fristil/designsystem@${nyVersjon}/`,
      )
      if (etter !== før) {
        writeFileSync(p, etter)
        cdnEndret += 1
      }
    }
  }
}
oppdaterCdn(dokRot)
if (cdnEndret > 0)
  console.log(`Oppdaterte CDN-adressene i ${cdnEndret} dokumentasjonsfiler.`)

console.log(`Versjonen er satt til ${nyVersjon}, med dato ${dato}.

Slik gir du den ut:

  bun run sjekk
  git checkout -b slipp-${nyVersjon}
  git commit -am "Slipp ${nyVersjon}"
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
