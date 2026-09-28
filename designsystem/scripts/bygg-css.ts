/**
 * Bygger `dist/fristil.css`: alle stilarkene i én fil, uten `@import`.
 *
 * De enkelte stilarkene henter delene sine med `@import`, og en nettleser
 * uten bunter må først laste og lese den ytre fila før den vet at de finnes.
 * På et mobilnett er det en synlig forsinkelse, og den rammet nettopp
 * feltene: kommunefeltet i spilldemoen sto uten ramme og bakgrunn til den
 * andre runden kom. Demoen forhåndslastet fem filer for hånd for å komme
 * rundt det, og en liste hver konsument må vedlikeholde er ikke en løsning.
 *
 * Her flates alt ut til én fil som lenkes alene. Buntere bruker de enkelte
 * stilarkene som før, og laster bare det de trenger; denne er for dem som
 * lenker fra CDN eller `node_modules` og heller vil ha én rundtur enn et
 * utvalg.
 *
 * Lista er `exports` i `package.json`, ikke mappa: det er oppføringene som
 * er kontrakten, og en ny komponent kommer med av seg selv når den får sin
 * oppføring. `tokens.css` legges først, siden alt annet bygger på den, og
 * Tailwind-temaet holdes utenfor, siden det er en `@theme`-blokk for
 * Tailwind og ikke et stilark for en side.
 *
 * Hver fil tas med én gang, uansett hvor mange som importerer den, og en
 * import som ikke finnes stopper bygget framfor å bli borte i stillhet.
 * Kommentarene strykes; de er skrevet for den som leser kilden, og kilden
 * ligger i pakken som før.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PAKKE = fileURLToPath(new URL("../", import.meta.url))
const UT = join(PAKKE, "dist", "fristil.css")

const manifest = JSON.parse(readFileSync(join(PAKKE, "package.json"), "utf8"))
const versjon: string = manifest.version
const exports: Record<string, string | Record<string, string>> =
  manifest.exports

const oppføringer = Object.entries(exports)
  .filter(
    ([navn, sti]) =>
      navn.endsWith(".css") &&
      typeof sti === "string" &&
      navn !== "./tailwind.css" &&
      navn !== "./fristil.css",
  )
  .map(([navn, sti]) => ({ navn, fil: resolve(PAKKE, sti as string) }))
  .sort((a, b) => {
    if (a.navn === "./tokens.css") return -1
    if (b.navn === "./tokens.css") return 1
    return a.navn.localeCompare(b.navn)
  })

if (oppføringer.length === 0) {
  console.error("✗ bygg-css fant ingen CSS-oppføringer i exports.")
  process.exit(1)
}

const tatt = new Set<string>()
const deler: string[] = []
let importer = 0

function ta(fil: string, fra: string | null): void {
  if (tatt.has(fil)) return
  if (!existsSync(fil)) {
    const hvor = fra ? ` (importert fra ${relative(PAKKE, fra)})` : ""
    console.error(`✗ ${relative(PAKKE, fil)} finnes ikke${hvor}.`)
    process.exit(1)
  }
  tatt.add(fil)

  // Kommentarene først, så en `@import` i en kommentar ikke hentes. De er
  // for den som leser kilden, og de er mange: uten dem er fila under
  // halvparten så stor. Kildefilene ligger i pakken som før.
  const utenKommentarer = readFileSync(fil, "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  )

  // Importene, slik nettleseren ville lest dem: det de definerer skal være
  // der før fila selv. Bare den enkle formen kjennes igjen; en `@import` med
  // lag eller medieliste blir stående, og vakten under feller den.
  const uten = utenKommentarer.replace(
    /^\s*@import\s+(?:url\()?["']([^"']+)["']\)?\s*;[ \t]*$/gm,
    (_, sti: string) => {
      importer += 1
      ta(resolve(dirname(fil), sti), fil)
      return ""
    },
  )

  const ryddet = uten.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
  deler.push(`/* ${relative(PAKKE, fil)} */\n${ryddet.trim()}\n`)
}

for (const { fil } of oppføringer) ta(fil, null)

const hode = [
  `/* @fristil/designsystem ${versjon}. Alle stilarkene i én fil, uten @import,`,
  " * for den som lenker fra CDN eller node_modules. Buntere bruker de enkelte",
  " * stilarkene. Generert av scripts/bygg-css.ts; rediger kildene, ikke denne. */",
  "",
].join("\n")

const resultat = hode + deler.join("\n")

/*
 * Vakten teller det som faktisk står i resultatet, ikke det skriptet tror
 * det gjorde. Hver kildefil pakker alt i `@layer fristil { … }`, så antall
 * slike blokker i utdata skal være antall filer som ble tatt. Et tall
 * mindre er en fil som ble hentet uten å komme med, eller en kildefil uten
 * lag; det siste ville latt konsumentens regler tape mot våre. Og ingen
 * `@import` skal stå igjen, heller ikke en innrykket eller en med lag.
 */
const gjenstaaende = resultat.match(/^\s*@import\b.*$/gm) ?? []
if (gjenstaaende.length > 0) {
  console.error(
    `✗ fristil.css har fortsatt @import: ${gjenstaaende[0]?.trim() ?? ""}`,
  )
  process.exit(1)
}
const lag = (resultat.match(/^@layer fristil \{/gm) ?? []).length
if (lag !== tatt.size || tatt.size < oppføringer.length) {
  console.error(
    `✗ fristil.css har ${lag} @layer fristil-blokker, men ${tatt.size} filer ble tatt av ${oppføringer.length} oppføringer.`,
  )
  process.exit(1)
}

mkdirSync(dirname(UT), { recursive: true })
writeFileSync(UT, resultat)

console.log(
  `fristil.css: ${oppføringer.length} oppføringer og ${tatt.size} filer, ` +
    `${importer} @import flatet ut, ${(resultat.length / 1024).toFixed(1)} kB.`,
)
