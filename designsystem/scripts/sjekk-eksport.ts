/**
 * Kontrollerer hva pakken faktisk inneholder.
 *
 * To ting går galt stille her.
 *
 * Et inkrementelt `tsc -b` går ut fra at `tsconfig.tsbuildinfo` forteller
 * sannheten om hva som allerede er skrevet. Blir `dist` slettet uten at
 * buildinfo-fila følger med, hopper bygget over filer det tror finnes, og
 * pakken kan komme ut med JavaScript men uten `.d.ts`. Da forsvinner
 * typesikkerheten stille hos konsumenten, som er det siste vi vil.
 *
 * Og `files` i package.json tar med hele mapper. Testfilene lå ved siden av
 * komponentene og ble med i tarballen, 43 av dem.
 *
 * Kjør med: bun scripts/sjekk-eksport.ts, eller som en del av `bun run build`.
 */

import { existsSync } from "node:fs"
import { join } from "node:path"

const pakke = new URL("../", import.meta.url).pathname

type Exports = Record<string, string | Record<string, string>>

const manifest = (await Bun.file(join(pakke, "package.json")).json()) as {
  exports: Exports
}

const feil: string[] = []

/** Filene npm ville lagt i tarballen. */
async function pakkefiler(): Promise<string[]> {
  const kjøring = Bun.spawn(["npm", "pack", "--dry-run", "--json"], {
    cwd: pakke,
    stdout: "pipe",
    stderr: "pipe",
  })

  const utdata = await new Response(kjøring.stdout).text()
  await kjøring.exited

  const [resultat] = JSON.parse(utdata) as [{ files: { path: string }[] }]
  return resultat.files.map((fil) => fil.path)
}

const filer = new Set(await pakkefiler())

for (const [navn, verdi] of Object.entries(manifest.exports)) {
  const stier = typeof verdi === "string" ? [verdi] : Object.values(verdi)

  for (const sti of stier) {
    const relativ = sti.replace(/^\.\//, "")

    if (!existsSync(join(pakke, sti))) {
      feil.push(`${navn} → ${sti} finnes ikke`)
    } else if (!filer.has(relativ)) {
      feil.push(`${navn} → ${sti} finnes, men blir ikke med i pakken`)
    }
  }
}

const testfiler = [...filer].filter((sti) => sti.includes(".test."))

if (testfiler.length > 0) {
  feil.push(
    `${testfiler.length} testfiler er med i pakken, blant annet ${testfiler[0]}`,
  )
}

if (feil.length > 0) {
  console.error(
    `Pakken stemmer ikke med det den lover:\n\n` +
      feil.map((linje) => `  ${linje}`).join("\n") +
      "\n\nKjør `bun run build` på nytt. Holder ikke det, slett" +
      " designsystem/tsconfig.tsbuildinfo og prøv igjen.\n",
  )
  process.exit(1)
}

console.log(
  `Pakken leverer alle ${Object.keys(manifest.exports).length} inngangspunktene,` +
    ` i ${filer.size} filer, uten tester.`,
)
