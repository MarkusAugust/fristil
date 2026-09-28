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

/*
 * Det forventede kommer fra kilden, ikke fra det bygde.
 *
 * Første utgave talte hver adresse i `dist` som hadde versjonen i seg, og kom
 * til 320. Men 172 av dem skrives av `Eksempel.astro` på hver eneste
 * eksempelside, og de går aldri gjennom remark. Tallet kunne altså stå høyt og
 * grønt selv om hver eneste plassholder forsvant ut av kilden, og vakten påsto
 * arbeid den ikke hadde gjort.
 *
 * Nå samles adressene plassholderen står i, og hver av dem må finnes i det
 * bygde med versjonen satt inn. Det dekker samtidig de nodetypene plugin-en
 * ikke når: står plassholderen i en JSX-attributt som `kode={…}`, blir den ikke
 * byttet, og da mangler adressen her.
 */
const iKilden = new Set<string>()

for (const rel of new Glob("documentation/src/**/*.{mdx,md,astro}").scanSync(
  ROT,
)) {
  const tekst = readFileSync(ROT + rel, "utf8")

  for (const treff of tekst.matchAll(
    /@fristil\/designsystem@VERSJON(\/[^"'`\s)]+)/g,
  )) {
    iKilden.add(treff[1])
  }
}

let leste = 0
const manglende: string[] = []
const bygget: string[] = []

for (const rel of new Glob("documentation/dist/**/*.html").scanSync(ROT)) {
  const tekst = readFileSync(ROT + rel, "utf8")
  bygget.push(tekst)

  // Starlight rømmer `@` i noen sammenhenger, så det er ordet VERSJON rett
  // etter pakkenavnet som letes etter, ikke plassholderen tegn for tegn.
  if (
    tekst.includes(PLASSHOLDER) ||
    /designsystem@?(?:&#\d+;)?VERSJON/.test(tekst)
  )
    funn.push(`${rel} har en plassholder som ikke ble byttet ut`)

  leste += 1
}

for (const filsti of iKilden) {
  if (!bygget.some((tekst) => tekst.includes(MED_VERSJON + filsti))) {
    manglende.push(filsti)
  }
}

if (leste === 0 || iKilden.size === 0) {
  funn.push(
    `Sjekken så ikke på noe: ${leste} bygde sider og ${iKilden.size} adresser med plassholder i kilden. Er dist bygd?`,
  )
}

for (const filsti of manglende) {
  funn.push(
    `${MED_VERSJON}${filsti} finnes ikke i det bygde, men plassholderen står i kilden.`,
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
  `Alle ${iKilden.size} adressene fra kilden står i det bygde med ${version} i seg, over ${leste} sider, og ingen plassholder er igjen.`,
)
