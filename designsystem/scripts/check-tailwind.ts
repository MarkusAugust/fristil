/**
 * Kontrollerer at Tailwind-temaet gir de verdiene det lover.
 *
 * Fila `src/tailwind/tailwind.css` er ren CSS, og pakken har ingen
 * avhengighet til Tailwind. Da kan ingen typefeil eller versjonskonflikt si
 * fra hvis noe er galt: en skrivefeil i et variabelnavn gir bare en
 * utility-klasse som stille ikke finnes.
 *
 * Her kompileres temaet med en ekte Tailwind, og det kontrolleres at
 * klassene faktisk kommer ut med LO-TEKs tokens i seg.
 *
 * Kjør med: bun scripts/check-tailwind.ts
 */

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"
import { colorTokens } from "../src/tokens/tokens.js"

const pakke = fileURLToPath(new URL("../", import.meta.url))

async function loadStylesheet(id: string, basedir: string) {
  const sti = id.startsWith(".")
    ? join(basedir, id)
    : Bun.resolveSync(id, basedir)
  return {
    path: sti,
    base: dirname(sti),
    content: await readFile(sti, "utf8"),
  }
}

const tema = await readFile(join(pakke, "src/tailwind/tailwind.css"), "utf8")

const input = `
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
${tema}
`

const compiler = await compile(input, { base: pakke, loadStylesheet })

/*
 * Hver farge, ikke et utvalg.
 *
 * Lista sto her med sju håndplukkede celler og en kommentar som sa «én celle
 * per rolle, og én per familie». Talt opp var det sju av 86 farger, altså
 * verken hver rolle eller hver familie, og en generator som hoppet over raden
 * `warning` eller kolonnen `content` gikk fri. Nå bygges lista av
 * `colorTokens`, altså av den samme kilden generatoren leser, og da er
 * dekningen komplett per definisjon.
 *
 * Det er ingen sirkel: det som kontrolleres er ikke at navnene stemmer, men
 * at en ekte Tailwind lager en klasse av hver av dem, med tokenet i seg.
 */
const fargeklasser: [klasse: string, inneholder: string][] = Object.keys(
  colorTokens,
)
  .filter((navn) => navn.startsWith("--lt-color-"))
  .map((navn) => [`bg-lt-${navn.slice("--lt-color-".length)}`, `var(${navn})`])

/** Klassen, og det den må inneholde for at koblingen skal være ekte. */
const forventet: [klasse: string, inneholder: string][] = [
  ["p-4", "calc(var(--lt-spacing-1) * 4)"],
  ["gap-2", "calc(var(--lt-spacing-1) * 2)"],
  // Tailwinds egen `px` er den faste pikselen, som `--lt-spacing-px`. Tabellen
  // på Design tokens-siden oppgir den som motstykket, og det må være sant.
  ["p-px", "1px"],
  ...fargeklasser,
  // Én farge også som tekst, så navnerommet ikke bare virker for bakgrunn.
  ["text-lt-accent-text", "var(--lt-color-accent-text)"],
  ["border-lt-neutral-border", "var(--lt-color-neutral-border)"],
  ["text-lt-xxs", "var(--lt-font-size-xxs)"],
  ["text-lt-mega", "var(--lt-font-size-mega)"],
  ["max-w-lt-aside", "384px"],
  ["shadow-lt-overlay", "var(--lt-shadow-overlay)"],
]

const css = compiler.build(forventet.map(([klasse]) => klasse))
const feil: string[] = []

for (const [klasse, inneholder] of forventet) {
  const regel = new RegExp(
    `\\.${klasse.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{[^}]*\\}`,
  ).exec(css)

  if (!regel) {
    feil.push(`.${klasse} ble ikke laget i det hele tatt`)
  } else if (!regel[0].includes(inneholder)) {
    feil.push(`.${klasse} inneholder ikke ${inneholder}: ${regel[0].trim()}`)
  }
}

/** Klasser som ville betydd at vi har tatt over noe som er Tailwinds eget. */
const skalIkkeRøres: [klasse: string, ikke: string][] = [
  ["bg-neutral-100", "--lt-color"],
  ["max-w-md", "--container-lt"],
]

const annetCss = compiler.build(skalIkkeRøres.map(([klasse]) => klasse))

for (const [klasse, ikke] of skalIkkeRøres) {
  const regel = new RegExp(
    `\\.${klasse.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{[^}]*\\}`,
  ).exec(annetCss)

  if (regel?.[0].includes(ikke)) {
    feil.push(`.${klasse} er overstyrt av LO-TEK: ${regel[0].trim()}`)
  }
}

if (feil.length > 0) {
  console.error(
    `Tailwind-temaet holder ikke det det lover:\n\n${feil
      .map((linje) => `  ${linje}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

console.log(
  `Tailwind-temaet gir ${forventet.length} kontrollerte klasser LO-TEKs verdier, ${fargeklasser.length} av dem hver sin farge, og lar Tailwinds egne være i fred.`,
)
