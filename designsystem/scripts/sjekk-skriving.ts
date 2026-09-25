/**
 * At komponentene skriver attributter gjennom `setAttr`, ikke rått.
 *
 * Komponentene observerer de attributtene de selv setter, for å kunne sette
 * dem tilbake etter en patch fra serveren. Skriver en av dem en verdi som alt
 * står der, teller det som en endring, observatøren kaller seg selv, skriver
 * på nytt, og mikrotaskkøen tømmes aldri. Siden fryser.
 *
 * Det er derfor denne sjekken finnes, og hvorfor den er et skript og ikke en
 * nettlesertest: bryter en komponent regelen, **henger** en testkjøring
 * framfor å feile. Ingen stakksporing, ingen påstand, bare stillhet, og en
 * kjøring som må drepes for hånd. En regel som bare kan brytes på den måten
 * må håndheves i kilden, og den må feile på sekunder.
 *
 * Seks skrivemåter utløser en mutasjonspost uten at verdien endrer seg, og
 * fem av dem har vært i bruk i disse komponentene. Det er derfor ikke nok å
 * se etter `setAttribute`:
 *
 * | Skriving | Bruk i stedet |
 * | --- | --- |
 * | `el.setAttribute(n, v)` | `setAttr(el, n, v)` |
 * | `el.hidden = x`, `el.disabled = x` | `setFlag(el, "hidden", x)` |
 * | `el.tabIndex = n`, `el.id = s`, `el.htmlFor = s` | `setAttr(el, …)` |
 * | `el.textContent = s`, `el.innerText = s` | `setText(el, s)` |
 * | `el.classList.add(k)` | `addClass(el, k)` |
 * | `el.style.cssText = s` | `el.style.setProperty(…)` |
 *
 * `removeAttribute`, `toggleAttribute` og `style.setProperty` gir ingen post
 * når ingenting endrer seg, og er trygge.
 *
 * **Verten er ikke et unntak.** Den forrige utgaven lot `this.…` stå, med den
 * begrunnelsen at verten bare observeres gjennom `observedAttributes`. Det er
 * ikke sant: hver av komponentene kaller `observe(this, …)`, og en observatør
 * på en node ser nodens egne attributter og egne barn. `this.classList.add()`
 * i `<fs-field>`, som har `class` i filteret sitt, ville hengt en kjøring like
 * godt som en skriving på et barn.
 *
 * Det ene som er lov på verten er å tilordne en egenskap komponenten selv har
 * deklarert med `set`. `this.open = true` kaller da setteren i den samme fila,
 * og det er den som skriver, gjennom `setFlag`. Setternavnene leses ut av fila
 * framfor å stå i en liste her, så en ny setter ikke må huskes to steder.
 *
 * Sjekken leser tekst, og den fanger ikke alt. `Object.assign(el, { … })`,
 * en `setAttribute` lagret i en variabel og `replaceChildren()` slipper forbi.
 * Ingen av dem er i bruk, og en tekstsjekk som skal fange dem ville tatt like
 * mye riktig kode med seg. Det den fanger er formene som faktisk står i disse
 * filene, og de som ligger nærmest å skrive neste gang.
 *
 * Bare `ramme/` leses. De frittstående komponentene lager sitt eget innhold og
 * observerer det ikke, så en skriving der kan ikke kalle noen observatør.
 *
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

/**
 * Skrivemåtene som gir en mutasjonspost selv når verdien er den samme.
 *
 * `(?<!\bthis)` er unntaket for verten, og det må stå på selve mottakeren.
 * En sjekk på om linja inneholder `this.` var for bred: da slapp
 * `this.panel.setAttribute(...)` forbi, og det er nettopp skrivemåten en
 * komponent ville brukt.
 */
const FORBUDT: { monster: RegExp; bruk: string }[] = [
  { monster: /\.setAttribute\(/, bruk: "setAttr()" },
  { monster: /\.classList\.(add|remove|toggle)\(/, bruk: "addClass()" },
  { monster: /\.(hidden|disabled|open|checked)\s*=[^=]/, bruk: "setFlag()" },
  { monster: /\.(tabIndex|id|className|htmlFor)\s*=[^=]/, bruk: "setAttr()" },
  { monster: /\.(textContent|innerText)\s*=[^=]/, bruk: "setText()" },
  { monster: /\.style\.cssText\s*=[^=]/, bruk: "style.setProperty()" },
]

const funn: string[] = []

for (const fil of komponentfiler(ROT)) {
  const innhold = readFileSync(fil, "utf8")
  // Egenskapene fila selv deklarerer. `this.open = x` går da gjennom setteren.
  const settere = [...innhold.matchAll(/^\s*set ([a-zA-Z]+)\(/gm)].map(
    (treff) => treff[1],
  )

  const linjer = innhold.split("\n")
  linjer.forEach((linje, i) => {
    const trimmet = linje.trim()
    // Kommentarer er ikke kode. Både `//` og linjene inne i en `/** … */`.
    if (trimmet.startsWith("*") || trimmet.startsWith("/*")) return
    const kode = linje.split("//")[0]

    // En `set`-tilbehører er deklarasjonen av en egenskap, ikke en skriving.
    if (/^\s*(set|get) /.test(kode)) return
    if (settere.some((navn) => kode.includes(`this.${navn} =`))) return

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
