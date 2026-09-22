import { cssTokens, darkTokens } from "../src/tokens/tokens"

const sections: Record<string, string[]> = {}

for (const key of Object.keys(cssTokens) as (keyof typeof cssTokens)[]) {
  const section = key
    .replace(/^--/, "")
    .split("-")
    .slice(
      0,
      key.startsWith("--semantic") ? 2 : key.startsWith("--palette") ? 2 : 1,
    )
    .join("-")

  if (!sections[section]) sections[section] = []
  sections[section].push(`  ${key}: ${cssTokens[key]};`)
}

/*
 * Alt legges i et cascade layer.
 *
 * Uten det måtte en konsument som vil ha egne farger slå spesifisiteten vår.
 * Den mørke mediespørringen bruker :root:not([data-theme="light"]), altså
 * 0,2,0, og en vanlig :root i konsumentens CSS taper mot den. Overstyringen
 * virket da i lyst tema og med data-theme, men røk stille for alle som har
 * operativsystemet i mørkt. CSS uten layer slår alltid CSS i et layer,
 * uansett spesifisitet, så nå holder en enkel :root.
 */
/*
 * `color-scheme` er ikke et token, men hører likevel hjemme her.
 *
 * Uten den tegner nettleseren sine egne flater lyst uansett hva tokenene
 * sier: nedtrekkslista til en `<select>`, rullefelt, kalenderpanelet i et
 * datofelt og standardfargen på en side uten egen bakgrunn. En side i mørkt
 * tema fikk da en hvit liste midt i seg. Verdien `light dark` sier at begge
 * deler finnes, og at systemvalget avgjør.
 */
const lines = [
  "/* Generert. Rediger tokens.ts, ikke denne fila. */",
  "",
  "@layer fristil {",
  "  :root {",
  "    color-scheme: light dark;",
  "",
]
for (const [index, [section, props]] of Object.entries(sections).entries()) {
  // Tom linje mellom gruppene. Den første står allerede etter
  // `color-scheme`, og to på rad ville biome flagget hver gang fila
  // genereres på nytt.
  if (index > 0) lines.push("")
  lines.push(`    /* ${section} */`)
  lines.push(...props.map((line) => `  ${line}`))
}
lines.push("  }")

const darkLines = Object.entries(darkTokens).map(
  ([name, value]) => `      ${name}: ${value};`,
)

/*
 * Mørkt tema skrives to ganger, og det er med vilje.
 *
 * Mediespørringen gjør at systemvalget gjelder uten at konsumenten skriver
 * noe. `:not([data-theme="light"])` lar en app likevel tvinge lyst tema på en
 * maskin som står i mørkt. Attributtregelen under gjør det motsatte, og står
 * sist så den vinner.
 */
lines.push(
  "",
  "  @media (prefers-color-scheme: dark) {",
  '    :root:not([data-theme="light"]) {',
  ...darkLines,
  "    }",
  "  }",
  "",
  // Tvinger appen fram et tema, må nettleserens egne flater følge med.
  // Ellers får en app som står på lyst tema på en mørk maskin en svart
  // nedtrekksliste under et hvitt felt.
  '  [data-theme="light"] {',
  "    color-scheme: light;",
  "  }",
  "",
  '  [data-theme="dark"] {',
  "    color-scheme: dark;",
  "",
  ...darkLines.map((l) => l.slice(2)),
  "  }",
  "}",
)

await Bun.write(
  new URL("../src/tokens/tokens.css", import.meta.url),
  `${lines.join("\n")}\n`,
)

console.log(
  `✓ tokens.css generert: ${Object.keys(cssTokens).length} verdier, ${Object.keys(darkTokens).length} overstyrt i mørkt tema`,
)
