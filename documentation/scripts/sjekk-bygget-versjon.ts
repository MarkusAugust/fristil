/**
 * At versjonen faktisk ble satt inn i det bygde resultatet.
 *
 * Adressene i eksemplene står som `@fristil/designsystem@VERSJON` i kilden, og
 * `remark-versjon.mjs` bytter plassholderen når siden bygges. To vaktposter
 * passer på kilden, og ingen passet på resultatet.
 *
 * Det er ikke en teoretisk mangel. `astro.config.mjs` sier selv at
 * `markdown.remarkPlugins` er merket som utfaset, og at MDX-veien er det eneste
 * som holder den i live. Slutter plugin-en å kjøre, går alle adressene ut med
 * ordet VERSJON i seg, «Ren HTML»- og Datastar-sporet er dødt for leseren, og
 * `bun run sjekk` er grønn hele veien.
 *
 * Kjør med: bun documentation/scripts/sjekk-bygget-versjon.ts
 * Krever at `documentation/dist` er bygd.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROT = fileURLToPath(new URL("../..", import.meta.url))

const { version } = JSON.parse(
  readFileSync(`${ROT}designsystem/package.json`, "utf8"),
) as { version: string }

const PLASSHOLDER = "@fristil/designsystem@VERSJON"
const MED_VERSJON = `@fristil/designsystem@${version}`

const funn: string[] = []
let leste = 0
let adresser = 0

for (const rel of new Glob("documentation/dist/**/*.html").scanSync(ROT)) {
  const tekst = readFileSync(ROT + rel, "utf8")
  leste += 1

  // Starlight rømmer `@` i noen sammenhenger, så det er ordet VERSJON rett
  // etter pakkenavnet som letes etter, ikke plassholderen tegn for tegn.
  if (
    tekst.includes(PLASSHOLDER) ||
    /designsystem@?(?:&#\d+;)?VERSJON/.test(tekst)
  )
    funn.push(`${rel} har en plassholder som ikke ble byttet ut`)

  adresser += tekst.split(MED_VERSJON).length - 1
}

/*
 * Tell hva som faktisk ble gjort. Er `leste` null, ble ingenting bygd; er
 * `adresser` null, ble ingen adresse skrevet ut med versjon i seg, og da har
 * plugin-en sluttet å virke selv om ingen plassholder er synlig.
 */
if (leste === 0 || adresser === 0) {
  funn.push(
    `Sjekken så ikke på noe: ${leste} sider og ${adresser} adresser med versjon. Er dist bygd?`,
  )
}

if (funn.length > 0) {
  console.error(
    `Versjonen kom ikke inn i det bygde resultatet:\n${funn
      .map((linje) => `  - ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Versjonen står i ${adresser} adresser over ${leste} bygde sider, ingen plassholder igjen.`,
)
