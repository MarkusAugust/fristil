/**
 * At hvert inngangspunkt lar seg importere på en server, uten DOM, og at
 * registreringen ikke gjør noe der.
 *
 * `HTMLElement` og `customElements` finnes bare i nettleseren, og en
 * `class X extends HTMLElement` blir evaluert i det modulen lastes. Ni av
 * inngangspunktene stoppet derfor med «HTMLElement is not defined» på en
 * server som bare ville hente `fs.button()`. Hovedinngangen var ett av dem,
 * altså nøyaktig den linja «Kom i gang» ber leseren skrive.
 *
 * Ingen nettlesertest kunne se det: der finnes `HTMLElement`. Denne kjører i
 * Bun, uten DOM, som en SSR-server gjør.
 *
 * Kjøres av `bun run build`, etter at `dist` er bygd.
 */

const pakke = new URL("../", import.meta.url)
const manifest = await Bun.file(new URL("package.json", pakke)).json()

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

if (inngangspunkter.length < 20) {
  console.error(
    `Fant bare ${inngangspunkter.length} inngangspunkter å prøve. Sjekk formatet på exports.`,
  )
  process.exit(1)
}

const feil: string[] = []
const registreringer: Array<[string, () => void]> = []

for (const [navn, fil] of inngangspunkter) {
  try {
    // Stien gjøres om til en URL. `import()` med en ren filsti er ikke
    // portabel: på Windows leser ESM `C:\…` som et `c:`-skjema, og da ville
    // sjekken meldt hvert eneste inngangspunkt som feilende.
    const modul = await import(new URL(fil, pakke).href)

    for (const [eksportnavn, verdi] of Object.entries(modul)) {
      if (eksportnavn.startsWith("defineFs") && typeof verdi === "function") {
        registreringer.push([`${navn} → ${eksportnavn}`, verdi as () => void])
      }
    }
  } catch (error) {
    feil.push(`  ${navn}: ${String(error).split("\n")[0]}`)
  }
}

if (feil.length > 0) {
  console.error(
    `Disse inngangspunktene lar seg ikke importere på en server:\n\n${feil.join("\n")}\n`,
  )
  process.exit(1)
}

/*
 * Å importere holder ikke. `defineFs*` kalles fra filer som i TanStack Start
 * kjøres både på serveren og i nettleseren, og der finnes det ingen
 * `customElements` å registrere i. Uten dette kunne `customElements`-vakten i
 * `defineElement` forsvinne uten at noe sa fra.
 */
const registreringsfeil: string[] = []

for (const [navn, registrer] of registreringer) {
  try {
    registrer()
  } catch (error) {
    registreringsfeil.push(`  ${navn}: ${String(error).split("\n")[0]}`)
  }
}

if (registreringer.length < 8) {
  console.error(
    `Fant bare ${registreringer.length} registreringsfunksjoner. Ventet én per web component.`,
  )
  process.exit(1)
}

if (registreringsfeil.length > 0) {
  console.error(
    `Disse registreringene stopper på en server:\n\n${registreringsfeil.join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Alle ${inngangspunkter.length} inngangspunktene lar seg importere uten DOM, og alle ${registreringer.length} registreringene er stille der.`,
)
