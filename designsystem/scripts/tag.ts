/**
 * Setter og dytter taggen som gir ut en versjon.
 *
 * Taggen er det siste steget i en utgivelse, etter `bun run prepare-version`
 * og etter at versjonen er slått sammen til master. Den starter
 * arbeidsflyten som gir ut, og den skal settes med én gang: dokumentasjonen
 * rulles ut når master endrer seg, og peker da på en versjon som ikke finnes
 * før taggen har kjørt.
 *
 *   bun run tag                  viser hva som er tagget, og gjør ingenting
 *   bun run tag pakke            v<versjon>: npm og GitHub Releases
 *   bun run tag utvidelse        utvidelse-v<versjon>: VS Code Marketplace
 *   bun run tag intellij         intellij-v<versjon>: JetBrains Marketplace
 *   bun run tag pakke utvidelse  flere på én gang
 *   --prøv                        sier hva som ville skjedd, uten å tagge
 *
 * Skriptet nekter når master ikke er hentet, når arbeidstreet har endringer,
 * når taggen finnes fra før, og når versjonen mangler i versjonsloggen. Uten
 * argumenter tagger det ingenting: hva som skal ut, velges hver gang.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROT = fileURLToPath(new URL("../../", import.meta.url))

type Del = {
  /** Navnet i kommandoen. */
  navn: string
  /** Hva taggen gir ut. */
  gir: string
  prefiks: string
  versjon: () => string
  /** Versjonsloggen versjonen skal stå i, om delen har en. */
  logg?: { sti: string; overskrift: (versjon: string) => RegExp }
}

const lesJson = (sti: string) =>
  JSON.parse(readFileSync(join(ROT, sti), "utf8")) as { version: string }

const DELER: Del[] = [
  {
    navn: "pakke",
    gir: "@fristil/designsystem på npm, og kommandolinja på GitHub Releases",
    prefiks: "v",
    versjon: () => lesJson("designsystem/package.json").version,
    logg: {
      sti: "designsystem/CHANGELOG.md",
      overskrift: (v) => new RegExp(`^## ${v.replaceAll(".", "\\.")} \\(`, "m"),
    },
  },
  {
    navn: "utvidelse",
    gir: "VS Code-utvidelsen på Marketplace",
    prefiks: "utvidelse-v",
    versjon: () => lesJson("editor/package.json").version,
    logg: {
      sti: "editor/CHANGELOG.md",
      overskrift: (v) => new RegExp(`^## ${v.replaceAll(".", "\\.")}$`, "m"),
    },
  },
  {
    navn: "intellij",
    gir: "IntelliJ-pluginen på JetBrains Marketplace",
    prefiks: "intellij-v",
    versjon: () => {
      const treff = /^pluginVersion=(.+)$/m.exec(
        readFileSync(join(ROT, "editor-intellij/gradle.properties"), "utf8"),
      )
      if (!treff)
        stopp("Fant ikke pluginVersion i editor-intellij/gradle.properties.")
      return treff[1].trim()
    },
  },
]

function stopp(melding: string): never {
  console.error(`✗ ${melding}`)
  process.exit(1)
}

function git(...argumenter: string[]): string {
  const svar = Bun.spawnSync(["git", ...argumenter], { cwd: ROT })
  if (svar.exitCode !== 0)
    stopp(`git ${argumenter.join(" ")} feilet:\n${svar.stderr.toString()}`)
  return svar.stdout.toString().trim()
}

const argumenter = process.argv.slice(2)
const prøv = argumenter.includes("--prøv")
const valgt = argumenter.filter((a) => a !== "--prøv")
const ukjent = valgt.filter((a) => !DELER.some((d) => d.navn === a))
if (ukjent.length > 0)
  stopp(
    `Ukjent del: ${ukjent.join(", ")}. Velg blant ${DELER.map((d) => d.navn).join(", ")}.`,
  )

git("fetch", "--quiet", "--tags", "origin", "master")
const eksisterende = new Set(
  git("ls-remote", "--tags", "origin")
    .split("\n")
    .map((linje) => linje.split("refs/tags/")[1])
    .filter(Boolean),
)

const status = DELER.map((d) => {
  const versjon = d.versjon()
  const tagg = `${d.prefiks}${versjon}`
  return { del: d, versjon, tagg, finnes: eksisterende.has(tagg) }
})

if (valgt.length === 0) {
  console.log("Versjonene på denne commiten, og om de er tagget:\n")
  for (const { del, tagg, finnes } of status)
    console.log(
      `  ${del.navn.padEnd(10)} ${tagg.padEnd(22)} ${finnes ? "tagget" : "ikke tagget"}`,
    )
  console.log(
    "\nVelg hva som skal ut, for eksempel: bun run tag pakke utvidelse",
  )
  process.exit(0)
}

// Taggen skal på master slik den er på GitHub, ikke på en lokal commit.
const her = git("rev-parse", "HEAD")
const master = git("rev-parse", "origin/master")
if (her !== master)
  stopp(
    `Du står på ${her.slice(0, 7)}, og master på GitHub er ${master.slice(0, 7)}.\n  Slå sammen versjonen først, og kjør: git checkout master && git pull`,
  )
if (git("status", "--porcelain") !== "")
  stopp("Arbeidstreet har endringer. Commit eller fjern dem før du tagger.")

const skal = status.filter((s) => valgt.includes(s.del.navn))
for (const { del, versjon, tagg, finnes } of skal) {
  if (finnes)
    stopp(
      `${tagg} finnes fra før. En versjon gis bare ut én gang: sett en ny versjon for ${del.navn}.`,
    )
  if (del.logg) {
    const logg = readFileSync(join(ROT, del.logg.sti), "utf8")
    if (!del.logg.overskrift(versjon).test(logg))
      stopp(
        `${del.logg.sti} har ingen overskrift for ${versjon}. ${del.navn === "pakke" ? "Kjør bun run prepare-version først." : "Skriv den før du tagger."}`,
      )
  }
}

for (const { del, tagg } of skal) {
  if (prøv) {
    console.log(`Ville tagget ${tagg} på ${her.slice(0, 7)}: ${del.gir}.`)
    continue
  }
  git("tag", tagg, her)
  git("push", "--quiet", "origin", tagg)
  console.log(`Tagget ${tagg} på ${her.slice(0, 7)}. Gir ut ${del.gir}.`)
}
if (!prøv)
  console.log(
    "\nFølg med under Actions på GitHub. Arbeidsflytene kontrollerer selv at taggen og versjonen stemmer.",
  )
