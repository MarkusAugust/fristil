/**
 * Kontrollerer at Tailwind-temaet gir de verdiene det lover.
 *
 * Fila `src/tailwind/tailwind.css` er ren CSS, og pakken har ingen
 * avhengighet til Tailwind. Da kan ingen typefeil eller versjonskonflikt si
 * fra hvis noe er galt: en skrivefeil i et variabelnavn gir bare en
 * utility-klasse som stille ikke finnes.
 *
 * Her kompileres temaet med en ekte Tailwind, og det kontrolleres at
 * klassene faktisk kommer ut med Fristils tokens i seg.
 *
 * Kjør med: bun scripts/sjekk-tailwind.ts
 */

import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "tailwindcss"

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

/** Klassen, og det den må inneholde for at koblingen skal være ekte. */
const forventet: [klasse: string, inneholder: string][] = [
  ["p-4", "calc(var(--size-1) * 4)"],
  ["gap-2", "calc(var(--size-1) * 2)"],
  ["text-fs-interactive", "var(--semantic-interactive-main)"],
  ["bg-fs-danger-bg", "var(--semantic-danger-background)"],
  ["text-fs-muted", "var(--semantic-muted-foreground)"],
  ["border-fs-field-border", "var(--semantic-field-border)"],
  ["text-fs-mega", "var(--font-size-mega)"],
  ["max-w-fs-aside", "384px"],
  ["shadow-fs-overlay", "var(--semantic-shadow-overlay)"],
  ["bg-fs-azure-70", "var(--palette-azure-70)"],
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
  ["bg-neutral-100", "--semantic"],
  ["max-w-md", "--container-fs"],
]

const annetCss = compiler.build(skalIkkeRøres.map(([klasse]) => klasse))

for (const [klasse, ikke] of skalIkkeRøres) {
  const regel = new RegExp(
    `\\.${klasse.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{[^}]*\\}`,
  ).exec(annetCss)

  if (regel?.[0].includes(ikke)) {
    feil.push(`.${klasse} er overstyrt av Fristil: ${regel[0].trim()}`)
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
  `Tailwind-temaet gir ${forventet.length} kontrollerte klasser Fristils verdier, og lar Tailwinds egne være i fred.`,
)
