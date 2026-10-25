import { Containers, colorTokens } from "../src/tokens/tokens"

/*
 * Tailwind-temaet genereres, det skrives ikke.
 *
 * Fila var 62 håndskrevne oppføringer som pekte på tokens, og hver ny farge
 * måtte legges inn to steder. Nå som hvert token heter `--lt-<slag>-<navn>`,
 * er oversettelsen mekanisk: Tailwinds navnerom er `--color-*`, `--text-*` og
 * `--container-*`, og slaget står alt i navnet vårt.
 */

const linjer: string[] = [
  "/* Generert. Rediger tokens.ts eller generate-tailwind.ts, ikke denne fila. */",
  "",
  "/*",
  " * LO-TEKs verdier som Tailwind-tema.",
  " *",
  " * Fila er ren CSS, og pakken har ingen avhengighet til Tailwind. Det er",
  " * Tailwind-versjonen i appen din som leser den, så to versjoner kan ikke",
  " * komme i konflikt: her finnes det ingen andre.",
  " *",
  " * Krever Tailwind 4 og at `tokens.css` er lastet, siden verdiene peker dit.",
  " *",
  " * ```css",
  " * @layer theme, base, lotek, lotek-theme, components, utilities;",
  " *",
  ' * @import "tailwindcss";',
  ' * @import "@lo-tek/interfaces/tokens.css";',
  ' * @import "@lo-tek/interfaces/tailwind.css";',
  " * ```",
  " *",
  " * Rekkefølgen på den første linja er ikke pynt. Lagene teller i den",
  " * rekkefølgen de først blir nevnt, og vinneren er det siste laget, uansett",
  " * spesifisitet. Står `lotek` foran `base`, slår Tailwinds Preflight",
  " * komponentene våre og nullstiller for eksempel bakgrunnen på en knapp. Står",
  " * det etter `utilities`, slår komponentene våre `p-6` og resten av klassene",
  " * dine. Mellom `base` og `components` er det eneste stedet begge deler virker.",
  " *",
  " * `lotek-theme` er laget et tema fra `lotek tema` ligger i. Det skal stå i",
  " * linja selv om du ikke har noe tema ennå: temaet erklærer bare `lotek,",
  " * lotek-theme`, og en `@layer`-setning flytter ikke lag som alt er erklært,",
  " * så uten plassen her havner temaet sist, etter `utilities`, og slår",
  " * klassene dine.",
  " *",
  " * Alt vi legger til heter `lt-`, som klassene ellers i systemet. Da rører vi",
  " * ikke Tailwinds egne verdier: `bg-neutral-100` betyr fortsatt det samme.",
  " */",
  "",
  "@theme inline {",
  "  /*",
  "   * Avstandsenheten. Tailwind regner `p-4` som `calc(var(--spacing) * 4)`,",
  "   * så med `--lt-spacing-1` som enhet er `p-4` fire ganger enheten, altså",
  "   * `--lt-spacing-4` så lenge skalaen står som den er. Trinnene er egne",
  "   * verdier, ikke regnet av enheten: skriver du om skalaen, skriv om alle",
  "   * trinnene, ikke bare `--lt-spacing-1`, ellers holder ikke komponentene",
  "   * og klassene følge.",
  "   */",
  "  --spacing: var(--lt-spacing-1);",
  "",
  "  /* Fargene, én klasse per celle i matrisen */",
]

/*
 * Hver farge blir en klasse, gruppert på familie.
 *
 * `--lt-color-danger-fill` gir `--color-lt-danger-fill`, altså
 * `bg-lt-danger-fill` og `text-lt-danger-fill`. Skygge og fokusring er ikke
 * farger og hører i sine egne navnerom.
 */
let forrigeFamilie = ""
for (const navn of Object.keys(colorTokens).sort()) {
  if (!navn.startsWith("--lt-color-")) continue
  const familie = navn.slice(11).split("-")[0]
  if (familie !== forrigeFamilie) {
    if (forrigeFamilie) linjer.push("")
    forrigeFamilie = familie
  }
  linjer.push(`  --color-lt-${navn.slice(11)}: var(${navn});`)
}

linjer.push(
  "",
  "  /* Tekststørrelser */",
  ...["xxs", "xs", "s", "m", "l", "xl", "xxl", "mega"].map(
    (navn) => `  --text-lt-${navn}: var(--lt-font-size-${navn});`,
  ),
  "",
  "  /* Bredder for sideoppsett */",
  ...Object.entries(Containers).map(([navn, verdi]) => {
    const kebab = navn.replace(/[A-Z]/g, (b) => `-${b.toLowerCase()}`)
    return `  --container-lt-${kebab}: ${verdi};`
  }),
  "",
  "  /* Skyggen under flater som ligger over siden */",
  "  --shadow-lt-overlay: var(--lt-shadow-overlay);",
  "}",
)

await Bun.write(
  new URL("../src/tailwind/tailwind.css", import.meta.url),
  `${linjer.join("\n")}\n`,
)

const antall = linjer.filter((l) => l.trim().startsWith("--")).length
console.log(`✓ tailwind.css generert: ${antall} oppføringer`)
