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
 * Fire skrivemåter utløser en mutasjonspost uten at verdien endrer seg, og
 * alle fire er i bruk i disse komponentene. Det er derfor ikke nok å se etter
 * `setAttribute`:
 *
 * | Skriving | Bruk i stedet |
 * | --- | --- |
 * | `el.setAttribute(n, v)` | `setAttr(el, n, v)` |
 * | `el.hidden = x`, `el.disabled = x` | `setFlag(el, "hidden", x)` |
 * | `el.tabIndex = n`, `el.id = s` | `setAttr(el, "tabindex", …)` |
 * | `el.classList.add(k)` | `addClass(el, k)` |
 *
 * `removeAttribute`, `toggleAttribute` og `style.setProperty` gir ingen post
 * når ingenting endrer seg, og er trygge.
 *
 * `this.…` er unntaket. Verten observeres bare gjennom `observedAttributes`,
 * og der er det `attributeChangedCallback` som svarer. Den kan skrive tilbake
 * til verten, som `<fs-popover>` gjør når den setter `open` tilbake, men da
 * står det en vakt foran, og runden stopper fordi attributtet står riktig
 * neste gang.
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

/** Skrivemåtene som gir en mutasjonspost selv når verdien er den samme. */
const FORBUDT: { monster: RegExp; bruk: string }[] = [
  { monster: /\.setAttribute\(/, bruk: "setAttr()" },
  { monster: /\.classList\.(add|remove|toggle)\(/, bruk: "addClass()" },
  { monster: /\.(hidden|disabled|open|checked)\s*=[^=]/, bruk: "setFlag()" },
  { monster: /\.(tabIndex|id|className)\s*=[^=]/, bruk: "setAttr()" },
]

const funn: string[] = []

for (const fil of komponentfiler(ROT)) {
  const linjer = readFileSync(fil, "utf8").split("\n")
  linjer.forEach((linje, i) => {
    const trimmet = linje.trim()
    // Kommentarer er ikke kode. Både `//` og linjene inne i en `/** … */`.
    if (trimmet.startsWith("*") || trimmet.startsWith("/*")) return
    const kode = linje.split("//")[0]

    // Verten er unntaket, og en `set`-tilbehører er deklarasjonen av den.
    if (/\bthis\./.test(kode)) return
    if (/^\s*(set|get) /.test(kode)) return

    for (const { monster, bruk } of FORBUDT) {
      if (!monster.test(kode)) continue
      funn.push(
        `${fil.replace(`${ROT}/`, "")}:${i + 1}  ${trimmet}   → ${bruk}`,
      )
      break
    }
  })
}

if (funn.length > 0) {
  console.error(
    `\n✗ ${funn.length} rå skrivinger. Bruk hjelperne i host-element.ts, som\n` +
      "  sammenligner først. Uten dem kaller observatøren seg selv, og kjøringen henger.\n",
  )
  for (const f of funn) console.error(`  ${f}`)
  process.exit(1)
}

console.log("Komponentene skriver gjennom hjelperne som sammenligner.")
