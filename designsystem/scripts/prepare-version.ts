/**
 * Setter versjonen som skal publiseres, i hver fil den står i. Den
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

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { englishDate } from "./english-date.js"

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

// `web-types.json` har også versjonen i seg. Fila genereres av
// generate-vocabulary.ts, og bygget krever at den på disk er byte-lik
// det generatoren ville skrevet, så versjonen skrives inn her framfor at
// hver utgivelse måtte huske å kjøre generatoren. Sjekken står før første
// skriving: stoppet den etterpå, sto loggen, manifestet og bun.lock alt
// med det nye nummeret, og neste forsøk nektet fordi versjonen var tatt.
const webTypesSti = join(monorepoRot, "designsystem", "web-types.json")
let webTypes = ""
try {
  webTypes = readFileSync(webTypesSti, "utf8")
} catch {
  stopp(
    "Fant ikke web-types.json. Kjør bun --filter @lo-tek/interfaces vocabulary først.",
  )
}
const webTypesFør = `"version": "${naavaerende}"`
if (!webTypes.includes(webTypesFør)) {
  stopp(
    `Fant ikke versjonen ${naavaerende} i web-types.json. Kjør bun --filter @lo-tek/interfaces vocabulary først.`,
  )
}

/*
 * Merket øverst i presentasjonen bærer versjonen og dagen den kom.
 *
 * Det sto «LO-TEK 0.15.0 · 26 September 2026» mens pakken var på 0.19.0,
 * altså fire versjoner bak, og ingenting oppdaterte det. Presentasjonen har
 * ingen byggesteg, så den kan ikke hente verdien selv slik dokumentasjonen nå
 * gjør; den må skrives, og `check-version.ts` feller hvis den glir fra igjen.
 *
 * Lesingen og kontrollen står her, sammen med de andre forhåndssjekkene, av
 * samme grunn som web-types over: stoppet den etter skrivingene, sto loggen,
 * manifestet og bun.lock alt med det nye nummeret, og neste forsøk nektet
 * fordi versjonen var tatt.
 *
 * Datasettet i avhengighetsgrafen røres ikke. Det er en måling med sin egen
 * dato, og et tall som er målt skal ikke settes av et skript som ikke har målt
 * noe.
 */
const dekkSti = join(
  monorepoRot,
  "presentation/design-system-architecture.html",
)
let dekk = ""
try {
  dekk = readFileSync(dekkSti, "utf8")
} catch {
  stopp(`Fant ikke ${dekkSti}. Er presentasjonen flyttet?`)
}

const merke = /(Design system architecture · LO-TEK )[^<·]+ · [^<·]+/
if (!merke.test(dekk)) {
  stopp(
    `Fant ikke merket med versjonen i ${dekkSti}. Står det fortsatt der, og heter det det samme?`,
  )
}

/*
 * Kotlin-pakken har samme versjon, og bygges av npm-pakken med det nummeret.
 * Står den bak, henter utgivelsen til Maven Central forrige versjon fra npm,
 * og `check-version.ts` feller. Kontrollen står før første skriving, som
 * for web-types over.
 */
const kotlinSti = join(monorepoRot, "kotlin/gradle.properties")
const kotlin = readFileSync(kotlinSti, "utf8")
const kotlinFør = `\nversion=${naavaerende}\n`
if (!kotlin.includes(kotlinFør)) {
  stopp(`Fant ikke version=${naavaerende} i ${kotlinSti}.`)
}

/*
 * `bun.lock` har også versjonen til hvert workspace i seg, og den blir
 * hengende igjen på forrige nummer. Testet med bun 1.3.14: dette stopper
 * ikke `--frozen-lockfile`, som bare sammenligner oppløsningene av
 * avhengigheter. Publiseringen går altså gjennom uansett.
 *
 * Den skrives likevel, fordi en lockfil som oppgir feil versjon er
 * villedende for den som leser den, og avviket bare vokser for hver utgivelse.
 *
 * Verdien må settes for hånd. Verken `bun install`, `--lockfile-only` eller
 * `--force` oppdaterer den når det bare er versjonen som har endret seg. Bare
 * en full regenerering gjør det, og å slette lockfila i et slipp ville rørt
 * oppløsninger som ikke har noe med saken å gjøre.
 *
 * Kontrollen av formatet står her, før første skriving, som de andre. Den
 * sto etter at loggen og `package.json` var skrevet, og en ny versjon av Bun
 * som skriver lockfila annerledes ville da stoppet skriptet med de to filene
 * alt endret, og neste forsøk nektet fordi `package.json` sa at versjonen
 * var tatt.
 */
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

await Bun.write(
  loggSti,
  logg.replace(UUTGITT, `${UUTGITT}\n\n## ${nyVersjon} (${dato})`),
)
await Bun.write(
  manifestSti,
  manifest.replace(`"version": "${naavaerende}"`, `"version": "${nyVersjon}"`),
)

await Bun.write(lockSti, lock.replace(lockMonster, `$1${nyVersjon}$2`))

writeFileSync(kotlinSti, kotlin.replace(kotlinFør, `\nversion=${nyVersjon}\n`))

writeFileSync(
  webTypesSti,
  webTypes.replace(webTypesFør, `"version": "${nyVersjon}"`),
)

const paaEngelsk = englishDate(dato)

writeFileSync(dekkSti, dekk.replace(merke, `$1${nyVersjon} · ${paaEngelsk}`))
console.log(`Merket i presentasjonen står nå på ${nyVersjon}, ${paaEngelsk}.`)

/*
 * `agent/*.md` og `manifest/*.json` har versjonen i seg, og generatorene
 * leser den fra `package.json`, som nå står på det nye nummeret. Uten dette
 * steget var det `build` i `sjekk` som skrev dem, og «Ingenting er ugenerert»
 * stoppet på filene som da sto på forrige versjon, så hver utgivelse trengte
 * en commit til.
 *
 * Kjøringen står sist, etter alle skrivingene som kan stoppes av en
 * forhåndskontroll. Feiler en generator, er versjonen alt satt, og meldingen
 * sier hva som må kjøres for hånd.
 */
for (const generator of ["generate-agent.ts", "generate-manifest.ts"]) {
  const resultat = Bun.spawnSync(["bun", join("scripts", generator)], {
    cwd: pakke,
    stdio: ["inherit", "inherit", "inherit"],
  })
  if (resultat.exitCode !== 0) {
    stopp(
      `${generator} feilet. Versjonen er alt satt til ${nyVersjon}. Kjør bun --filter @lo-tek/interfaces generate og se hva som stopper.`,
    )
  }
}

console.log(`Versjonen er satt til ${nyVersjon}, med dato ${dato}.

Slik gir du den ut. Alle filene som har versjonen i seg, er skrevet, så én
commit er nok: «Ingenting er ugenerert» i sjekk spør git om bygget endret noe,
og ville ellers stoppet på filene som nettopp ble skrevet.

  git checkout -b slipp-${nyVersjon}
  git commit -am "Slipp ${nyVersjon}"
  bun run check
  git push -u origin slipp-${nyVersjon} && gh pr create --fill

Når grenen er slått sammen, og først da:

  git checkout master && git pull
  bun run tag pakke`)

/** Sammenligner to versjoner på formen 0.3.0, tall for tall. */
function erHoyere(ny: string, gammel: string): boolean {
  const a = ny.split(".").map(Number)
  const b = gammel.split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }

  return false
}
