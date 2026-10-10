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
import { MAANEDER, norskDato } from "./norsk-dato.js"

const ROT = fileURLToPath(new URL("..", import.meta.url))
const pakke = await Bun.file(join(ROT, "package.json")).json()
const logg = await Bun.file(join(ROT, "CHANGELOG.md")).text()
const dekk = await Bun.file(
  join(ROT, "../presentasjon/designsystemarkitektur.html"),
).text()

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

/*
 * Merket i presentasjonen bærer versjonen, og hadde ingenting som holdt det i
 * takt. Det sto på 0.15.0 mens pakken var på 0.19.0, altså fire versjoner bak,
 * og det er det første en tilskuer ser.
 *
 * `prepare-version` skriver det nå. Men et omskrivingssteg må finne den gamle
 * verdien for å bytte den, og det er nettopp det som svikter stille, slik det
 * gjorde for CDN-adressene i dokumentasjonen. Derfor denne.
 */
const iDekket = /Designsystemarkitektur · Fristil ([^\s·]+) · ([^<]+)/.exec(
  dekk,
)

/*
 * Datoen har en fasit: den dagen versjonen ble gitt ut, som står i overskriften
 * i versjonsloggen. Uten denne kunne noen satt versjonen for hånd og latt
 * datoen bli stående, og merket ville løyet om halvparten.
 */
const utgittDato = new RegExp(
  `^## ${pakke.version.replace(/\./g, "\\.")} \\((\\d{4}-\\d{2}-\\d{2})\\)`,
  "m",
).exec(logg)?.[1]

if (!iDekket) {
  feil.push(
    "Fant ikke merket med versjonen i presentasjon/designsystemarkitektur.html. Står det fortsatt der, og heter det det samme?",
  )
} else {
  if (iDekket[1] !== pakke.version) {
    feil.push(
      `Presentasjonen står på ${iDekket[1]}, mens pakken er ${pakke.version}. Kjør bun run prepare-version, eller rett merket for hånd.`,
    )
  }

  /*
   * Mangler datoen i overskrifta, hoppes datosjekken over, og merket kan stå
   * med hva som helst. Et vilkår som slår av en sjekk er farligere enn en sjekk
   * som mangler, så det feller i stedet. Den eksisterende sjekken over krever
   * bare at overskrifta begynner med et versjonsnummer, så «## 0.19.0» uten
   * dato passerer den.
   */
  if (!utgittDato) {
    feil.push(
      `Overskrifta for ${pakke.version} i CHANGELOG.md mangler en dato på formen «## ${pakke.version} (2026-09-28)», så datoen i presentasjonen kan ikke kontrolleres.`,
    )
  } else if (iDekket[2].trim() !== norskDato(utgittDato)) {
    feil.push(
      `Presentasjonen er datert «${iDekket[2].trim()}», mens ${pakke.version} ble gitt ut ${norskDato(utgittDato)}.`,
    )
  }
}

/*
 * Målingen i avhengighetsgrafen må si når den ble gjort.
 *
 * Tallene der er lest av `package-lock.json` en bestemt dag, og de eldes: en
 * graf uten dato leses som en påstand om nåtid. Datoen kan ikke utledes av noe
 * i repoet, så vakten kan bare kreve at den står der, og at den er en dato.
 * Det er nok til at den ikke kan bli borte i stillhet.
 */
const maalt = new RegExp(
  `class="[^"]*\\bavh-maalt\\b[^"]*"\\s*>\\s*Målt (\\d{1,2}\\. (?:${MAANEDER.join("|")}) \\d{4})`,
).exec(dekk)

if (!maalt) {
  feil.push(
    "Avhengighetsgrafen i presentasjonen sier ikke når målingen ble gjort. Den skal ha «Målt <dag>. <måned> <år>» i et element med klassen avh-maalt.",
  )
}

/*
 * Versjonen til hver workspace står også i `bun.lock`, og `bun install`
 * skriver den ikke på nytt når bare versjonen er endret. `prepare-version`
 * gjør det for pakken, men utvidelsen fikk 0.8.0 i `package.json` mens
 * låsefila sto på 0.7.0. Kravet gjelder derfor hver workspace som har en
 * versjon. `documentation` har ingen, og hoppes over.
 */
const rotpakke = await Bun.file(join(ROT, "../package.json")).json()
const laas = await Bun.file(join(ROT, "../bun.lock")).text()
let workspaces = 0
for (const mappe of rotpakke.workspaces as string[]) {
  const ws = await Bun.file(join(ROT, "..", mappe, "package.json")).json()
  if (ws.version === undefined) continue
  const iLaas = new RegExp(
    `"${mappe}": \\{\\s*"name": "${ws.name}",\\s*"version": "([^"]+)"`,
  ).exec(laas)?.[1]
  if (iLaas !== ws.version)
    feil.push(
      `bun.lock har ${ws.name} ${iLaas ?? "uten versjon"}, mens ${mappe}/package.json har ${ws.version}. Rett versjonen i bun.lock.`,
    )
  workspaces += 1
}
if (workspaces === 0)
  feil.push("Fant ingen workspace med versjon å sjekke mot bun.lock.")

if (feil.length > 0) {
  console.error(
    `Versjonsloggen stemmer ikke:\n\n${feil.map((f) => `  ${f}`).join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Versjonsloggen stemmer: ${pakke.version} er beskrevet, «Ikke utgitt» står øverst, presentasjonen står på ${iDekket?.[1]} datert ${iDekket?.[2].trim()}, og avhengighetsgrafen er ${maalt?.[1]}.`,
)
