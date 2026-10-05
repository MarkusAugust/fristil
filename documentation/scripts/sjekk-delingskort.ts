/**
 * At en lenke til hver side får bilde når den deles.
 *
 * Starlight skriver tittel, beskrivelse og `twitter:card` selv, men ikke noe
 * bilde, og forsiden står utenfor Starlight og fikk ingen av delene. En lenke
 * til forsiden ble delt på X som ren tekst. Bildet kommer nå fra `head` i
 * `astro.config.mjs` og fra `index.astro`, og en ny side under `src/pages/`
 * faller like lett utenfor som forsiden gjorde.
 *
 * Sidene under `demo/` er unntatt. De vises i en `<iframe>` på mønstersidene
 * og er eksempler leseren kopierer, så delingstagger hører ikke hjemme i dem.
 *
 * Kjør med: bun documentation/scripts/sjekk-delingskort.ts
 * Krever at `documentation/dist` er bygd.
 */

import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Glob } from "bun"

const ROT = fileURLToPath(new URL("../..", import.meta.url))
const DIST = `${ROT}documentation/dist/`

const { homepage } = JSON.parse(
  readFileSync(`${ROT}designsystem/package.json`, "utf8"),
) as { homepage: string }

// Det forventede bygges av adressen i pakken og fila i `dist`, ikke av
// lista taggene skrives fra. Ellers etterprøver sjekken bare seg selv.
const BILDE = "og.png"
const ADRESSE = `${homepage.replace(/\/$/, "")}/${BILDE}`

const funn: string[] = []

// Bildet må finnes, være PNG og ha målene taggene oppgir. X tar ikke SVG.
if (!existsSync(DIST + BILDE)) {
  funn.push(`${BILDE} finnes ikke i dist`)
} else {
  const png = readFileSync(DIST + BILDE)
  const signatur = png.subarray(0, 8).toString("hex")
  if (signatur !== "89504e470d0a1a0a") {
    funn.push(`${BILDE} er ikke en PNG`)
  } else {
    const bredde = png.readUInt32BE(16)
    const hoyde = png.readUInt32BE(20)
    if (bredde !== 1200 || hoyde !== 630)
      funn.push(`${BILDE} er ${bredde} × ${hoyde}, ikke 1200 × 630`)
  }
}

// Alle `<meta>` med det navnet, så en tagg som står to ganger blir sett.
// En senere Starlight som skriver sitt eget `og:image`, ville ellers gitt
// to bilder uten at noe sa fra.
function innhold(html: string, attributt: string, navn: string) {
  const verdier: string[] = []
  for (const tagg of html.matchAll(/<meta\b[^>]*>/g)) {
    if (!new RegExp(`\\s${attributt}="${navn}"`).test(tagg[0])) continue
    verdier.push(tagg[0].match(/\bcontent="([^"]*)"/)?.[1] ?? "")
  }
  return verdier
}

// Beskrivelsen kreves ikke: Starlight skriver den bare når siden har en i
// frontmatter, og kortet virker uten. 404-siden har ingen.
const KRAV: [string, string, (verdi: string) => boolean][] = [
  ["property", "og:title", (v) => v.length > 0],
  ["property", "og:image", (v) => v === ADRESSE],
  ["property", "og:image:width", (v) => v === "1200"],
  ["property", "og:image:height", (v) => v === "630"],
  ["property", "og:image:alt", (v) => v.length > 0],
  ["name", "twitter:card", (v) => v === "summary_large_image"],
  ["name", "twitter:image", (v) => v === ADRESSE],
]

/*
 * Det forventede antallet kommer fra kilden, ikke fra globben over `dist`:
 * én side per dokument under `src/content/docs`, én per `.astro`-side i
 * `src/pages` utenom demoene (forsiden og versjonsloggen), pluss 404-siden
 * Starlight lager selv. Telte den bare det globben fant, ville en side som
 * manglet i bygget aldri blitt savnet.
 */
const forventet =
  [
    ...new Glob("**/*.{md,mdx}").scanSync(
      `${ROT}documentation/src/content/docs`,
    ),
  ].length +
  [...new Glob("**/*.astro").scanSync(`${ROT}documentation/src/pages`)].filter(
    (rel) => !rel.startsWith("demo/"),
  ).length +
  1

for (const side of ["index.html", "404.html"]) {
  if (!existsSync(DIST + side)) funn.push(`${side} finnes ikke i dist`)
}

let unntatt = 0
let sjekket = 0

for (const rel of new Glob("**/*.html").scanSync(DIST)) {
  if (rel.startsWith("demo/")) {
    unntatt += 1
    continue
  }

  const html = readFileSync(DIST + rel, "utf8")
  for (const [attributt, navn, godtar] of KRAV) {
    const verdier = innhold(html, attributt, navn)
    if (verdier.length === 0) funn.push(`${rel} mangler ${navn}`)
    else if (verdier.length > 1)
      funn.push(`${rel} har ${navn} ${verdier.length} ganger`)
    else if (!godtar(verdier[0]))
      funn.push(`${rel} har ${navn}="${verdier[0]}"`)
  }

  sjekket += 1
}

if (sjekket === 0 || sjekket !== forventet) {
  funn.push(
    `Sjekken så på ${sjekket} sider, men kilden har ${forventet}. Er dist bygd?`,
  )
}

if (funn.length > 0) {
  console.error(
    `Delte lenker får ikke bilde:\n${funn.map((linje) => `  - ${linje}`).join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Alle ${sjekket} av ${forventet} sider har delingsbildet ${ADRESSE}, og ${unntatt} demosider er unntatt.`,
)
