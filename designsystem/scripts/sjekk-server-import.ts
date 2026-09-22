/**
 * At hvert inngangspunkt lar seg importere på en server, uten DOM.
 *
 * `HTMLElement` og `customElements` finnes bare i nettleseren, og en
 * `class X extends HTMLElement` blir evaluert i det modulen lastes. Ni av
 * inngangspunktene stoppet derfor med «HTMLElement is not defined» på en
 * server som bare ville hente `fs.button()`. Hovedinngangen var ett av dem,
 * altså nøyaktig den linja «Kom i gang» ber leseren skrive.
 *
 * Ingen nettlesertest kunne se det: der finnes `HTMLElement`. Denne kjører i
 * Bun, uten DOM, som en SSR-server gjør, og importerer hver JavaScript-
 * oppføring i `exports` fra `dist`.
 *
 * Kjøres av `bun run build`, etter at `dist` er bygd.
 */

import { fileURLToPath } from "node:url"

const pakke = fileURLToPath(new URL("../", import.meta.url))
const manifest = await Bun.file(`${pakke}package.json`).json()

if (typeof globalThis.HTMLElement !== "undefined") {
  console.error(
    "Denne sjekken skal kjøre uten DOM. Her fantes HTMLElement, så den beviser ingenting.",
  )
  process.exit(1)
}

type Oppforing = string | { import?: string }

const inngangspunkter = Object.entries(
  manifest.exports as Record<string, Oppforing>,
)
  .filter(([navn]) => !navn.endsWith(".css") && navn !== "./package.json")
  .map(([navn, verdi]) => [
    navn,
    typeof verdi === "string" ? verdi : verdi.import,
  ])
  .filter((par): par is [string, string] => typeof par[1] === "string")

const feil: string[] = []

for (const [navn, fil] of inngangspunkter) {
  try {
    await import(`${pakke}${fil.replace(/^\.\//, "")}`)
  } catch (error) {
    feil.push(`  ${navn}: ${String(error).split("\n")[0]}`)
  }
}

if (inngangspunkter.length < 20) {
  console.error(
    `Fant bare ${inngangspunkter.length} inngangspunkter å prøve. Sjekk formatet på exports.`,
  )
  process.exit(1)
}

if (feil.length > 0) {
  console.error(
    `Disse inngangspunktene lar seg ikke importere på en server:\n\n${feil.join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Alle ${inngangspunkter.length} inngangspunktene lar seg importere uten DOM.`,
)
