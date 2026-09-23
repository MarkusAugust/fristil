/**
 * At komponentene skriver attributter gjennom `setAttr`, ikke rått.
 *
 * Komponentene observerer de attributtene de selv setter, for å kunne sette
 * dem tilbake etter en patch fra serveren. Skriver en av dem en verdi som alt
 * står der, teller det som en endring, observatøren kaller seg selv, skriver
 * på nytt, og mikrooppgavekøen tømmes aldri. Siden fryser.
 *
 * Det er derfor denne sjekken finnes, og hvorfor den er et skript og ikke en
 * nettlesertest: bryter en komponent regelen, **henger** en testkjøring
 * framfor å feile. Ingen stakksporing, ingen påstand, bare stillhet, og en
 * kjøring som må drepes for hånd. En regel som bare kan brytes på den måten
 * må håndheves i kilden, og den må feile på sekunder.
 *
 * `this.setAttribute(...)` er unntaket, og det er trygt: verten observeres
 * bare gjennom `observedAttributes`, og komponentene skriver ikke tilbake dit
 * fra `attributeChangedCallback`.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ROT = new URL("../src/components/ramme", import.meta.url).pathname

function komponentfiler(mappe: string): string[] {
  return readdirSync(mappe, { withFileTypes: true }).flatMap((oppføring) => {
    const sti = join(mappe, oppføring.name)
    if (oppføring.isDirectory()) return komponentfiler(sti)
    if (!oppføring.name.startsWith("fs-")) return []
    if (!oppføring.name.endsWith(".ts")) return []
    if (oppføring.name.includes(".test.")) return []
    return [sti]
  })
}

const funn: string[] = []

for (const fil of komponentfiler(ROT)) {
  const linjer = readFileSync(fil, "utf8").split("\n")
  linjer.forEach((linje, i) => {
    if (!linje.includes(".setAttribute(")) return
    if (linje.includes("this.setAttribute(")) return
    funn.push(`${fil.replace(`${ROT}/`, "")}:${i + 1}  ${linje.trim()}`)
  })
}

if (funn.length > 0) {
  console.error(
    `\n✗ ${funn.length} rå skrivinger av attributter. Bruk setAttr() fra host-element.ts,\n` +
      "  som sammenligner først. Uten den kaller observatøren seg selv, og kjøringen henger.\n",
  )
  for (const f of funn) console.error(`  ${f}`)
  process.exit(1)
}

console.log("Komponentene skriver attributter gjennom setAttr.")
