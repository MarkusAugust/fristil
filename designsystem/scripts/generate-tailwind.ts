import { Containers, colorTokens } from "../src/tokens/tokens"

/*
 * The Tailwind theme is generated, not written.
 *
 * The file was 62 hand-written entries pointing at tokens, and every new
 * colour had to be added in two places. Now that every token is called
 * `--lt-<kind>-<name>`, the translation is mechanical: Tailwind's namespaces
 * are `--color-*`, `--text-*` and `--container-*`, and the kind is already in
 * our name.
 */

const linjer: string[] = [
  "/* Generated. Edit tokens.ts or generate-tailwind.ts, not this file. */",
  "",
  "/*",
  " * LO-TEK's values as a Tailwind theme.",
  " *",
  " * The file is plain CSS, and the package has no dependency on Tailwind. It",
  " * is the Tailwind version in your app that reads it, so two versions cannot",
  " * conflict: there is no other one here.",
  " *",
  " * Requires Tailwind 4 and `tokens.css` to be loaded, since the values point there.",
  " *",
  " * ```css",
  " * @layer theme, base, lotek, lotek-theme, components, utilities;",
  " *",
  ' * @import "tailwindcss";',
  ' * @import "@lo-tek/interfaces/tokens.css";',
  ' * @import "@lo-tek/interfaces/tailwind.css";',
  " * ```",
  " *",
  " * The order of the first line matters. Layers count in the order they are",
  " * first mentioned, and the winner is the last layer, whatever the",
  " * specificity. With `lotek` before `base`, Tailwind's Preflight beats our",
  " * components and resets, for example, the background of a button. With it",
  " * after `utilities`, our components beat `p-6` and the rest of your",
  " * classes. Between `base` and `components` is the only place both work.",
  " *",
  " * `lotek-theme` is the layer a theme from `lotek theme` goes in. It must be",
  " * in the line even if you have no theme yet: the theme declares only",
  " * `lotek, lotek-theme`, and an `@layer` statement does not move layers that",
  " * are already declared, so without the place here the theme ends up last,",
  " * after `utilities`, and beats your classes.",
  " *",
  " * Everything we add is called `lt-`, like the other classes in the system.",
  " * That way we leave Tailwind's own values alone: `bg-neutral-100` still",
  " * means the same.",
  " */",
  "",
  "@theme inline {",
  "  /*",
  "   * The spacing unit. Tailwind computes `p-4` as `calc(var(--spacing) * 4)`,",
  "   * so with `--lt-spacing-1` as the unit, `p-4` is four times the unit, that",
  "   * is, `--lt-spacing-4` as long as the scale stays as it is. The steps are",
  "   * values of their own, not computed from the unit: if you rewrite the",
  "   * scale, rewrite every step, not only `--lt-spacing-1`, or the components",
  "   * and the classes drift apart.",
  "   */",
  "  --spacing: var(--lt-spacing-1);",
  "",
  "  /* The colours, one class per cell in the matrix */",
]

/*
 * Every colour becomes a class, grouped by family.
 *
 * `--lt-color-danger-fill` gives `--color-lt-danger-fill`, that is,
 * `bg-lt-danger-fill` and `text-lt-danger-fill`. Shadow and focus ring are not
 * colours and belong in their own namespaces.
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
  "  /* Text sizes */",
  ...["xxs", "xs", "s", "m", "l", "xl", "xxl", "mega"].map(
    (navn) => `  --text-lt-${navn}: var(--lt-font-size-${navn});`,
  ),
  "",
  "  /* Widths for page layout */",
  ...Object.entries(Containers).map(([navn, verdi]) => {
    const kebab = navn.replace(/[A-Z]/g, (b) => `-${b.toLowerCase()}`)
    return `  --container-lt-${kebab}: ${verdi};`
  }),
  "",
  "  /* The shadow under surfaces that sit above the page */",
  "  --shadow-lt-overlay: var(--lt-shadow-overlay);",
  "}",
)

await Bun.write(
  new URL("../src/tailwind/tailwind.css", import.meta.url),
  `${linjer.join("\n")}\n`,
)

const antall = linjer.filter((l) => l.trim().startsWith("--")).length
console.log(`✓ tailwind.css generated: ${antall} entries`)
