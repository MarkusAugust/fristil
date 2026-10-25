import pakke from "../../designsystem/package.json" with { type: "json" }

/*
 * Bildet en lenke til dokumentasjonen får når den deles. Starlight-sidene får
 * taggene fra `head` i `astro.config.mjs`, og forsiden, som står utenfor
 * Starlight, skriver dem selv i `index.astro`. Begge leser lista herfra.
 *
 * Adressen må være absolutt: X og de andre leser ikke en relativ sti.
 * Bildet er `public/og.png`, 1200 × 630 piksler.
 */
const BASE = pakke.homepage.replace(/\/$/, "")

export const DELINGSBILDE = [
  ["og:image", `${BASE}/og.png`],
  ["og:image:width", "1200"],
  ["og:image:height", "630"],
  ["og:image:alt", "Fristil. Rammeverksuavhengig designsystem."],
  ["twitter:image", `${BASE}/og.png`],
]

// `og:*` er en `property` i Open Graph, `twitter:*` er et `name`.
export const metaAttributter = ([navn, verdi]) =>
  navn.startsWith("og:")
    ? { property: navn, content: verdi }
    : { name: navn, content: verdi }
