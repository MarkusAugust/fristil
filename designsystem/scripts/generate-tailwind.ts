import { Containers, colorTokens } from "../src/tokens/tokens"

/*
 * Tailwind-temaet genereres, det skrives ikke.
 *
 * Fila var 62 håndskrevne oppføringer som pekte på tokens, og hver ny farge
 * måtte legges inn to steder. Nå som hvert token heter `--fs-<slag>-<navn>`,
 * er oversettelsen mekanisk: Tailwinds navnerom er `--color-*`, `--text-*` og
 * `--container-*`, og slaget står alt i navnet vårt.
 */

const linjer: string[] = [
  "/* Generert. Rediger tokens.ts eller generate-tailwind.ts, ikke denne fila. */",
  "",
  "/*",
  " * Fristils verdier som Tailwind-tema.",
  " *",
  " * Fila er ren CSS, og pakken har ingen avhengighet til Tailwind. Det er",
  " * Tailwind-versjonen i appen din som leser den, så to versjoner kan ikke",
  " * komme i konflikt: her finnes det ingen andre.",
  " *",
  " * Krever Tailwind 4 og at `tokens.css` er lastet, siden verdiene peker dit.",
  " *",
  " * ```css",
  " * @layer theme, base, fristil, components, utilities;",
  " *",
  ' * @import "tailwindcss";',
  ' * @import "@fristil/designsystem/tokens.css";',
  ' * @import "@fristil/designsystem/tailwind.css";',
  " * ```",
  " *",
  " * Rekkefølgen på den første linja er ikke pynt. Lagene teller i den",
  " * rekkefølgen de først blir nevnt, og vinneren er det siste laget, uansett",
  " * spesifisitet. Står `fristil` foran `base`, slår Tailwinds Preflight",
  " * komponentene våre og nullstiller for eksempel bakgrunnen på en knapp. Står",
  " * det etter `utilities`, slår komponentene våre `p-6` og resten av klassene",
  " * dine. Mellom `base` og `components` er det eneste stedet begge deler virker.",
  " *",
  " * Alt vi legger til heter `fs-`, som klassene ellers i systemet. Da rører vi",
  " * ikke Tailwinds egne verdier: `bg-neutral-100` betyr fortsatt det samme.",
  " */",
  "",
  "@theme inline {",
  "  /*",
  "   * Avstandsenheten. Tailwind regner `p-4` som `calc(var(--spacing) * 4)`,",
  "   * så med `--fs-spacing-1` som enhet er `p-4` nøyaktig `--fs-spacing-4`.",
  "   * Endrer du skalaen, følger Tailwind-klassene med.",
  "   */",
  "  --spacing: var(--fs-spacing-1);",
  "",
  "  /* Fargene, én klasse per celle i matrisen */",
]

/*
 * Hver farge blir en klasse, gruppert på familie.
 *
 * `--fs-color-danger-fill` gir `--color-fs-danger-fill`, altså
 * `bg-fs-danger-fill` og `text-fs-danger-fill`. Skygge og fokusring er ikke
 * farger og hører i sine egne navnerom.
 */
let forrigeFamilie = ""
for (const navn of Object.keys(colorTokens).sort()) {
  if (!navn.startsWith("--fs-color-")) continue
  const familie = navn.slice(11).split("-")[0]
  if (familie !== forrigeFamilie) {
    if (forrigeFamilie) linjer.push("")
    forrigeFamilie = familie
  }
  linjer.push(`  --color-fs-${navn.slice(11)}: var(${navn});`)
}

linjer.push(
  "",
  "  /* Tekststørrelser */",
  ...["xxs", "xs", "s", "m", "l", "xl", "xxl", "mega"].map(
    (navn) => `  --text-fs-${navn}: var(--font-size-${navn});`,
  ),
  "",
  "  /* Bredder for sideoppsett */",
  ...Object.entries(Containers).map(([navn, verdi]) => {
    const kebab = navn.replace(/[A-Z]/g, (b) => `-${b.toLowerCase()}`)
    return `  --container-fs-${kebab}: ${verdi};`
  }),
  "",
  "  /* Skyggen under flater som ligger over siden */",
  "  --shadow-fs-overlay: var(--fs-shadow-overlay);",
  "}",
)

await Bun.write(
  new URL("../src/tailwind/tailwind.css", import.meta.url),
  `${linjer.join("\n")}\n`,
)

const antall = linjer.filter((l) => l.trim().startsWith("--")).length
console.log(`✓ tailwind.css generert: ${antall} oppføringer`)
