import { defineEcConfig } from "@astrojs/starlight/expressive-code"
import { ecTabindex } from "./src/plugins/ec-tabindex.mjs"

/*
 * Valgene for Expressive Code står her og ikke i `astro.config.mjs`.
 * `<Code>`-komponenten krever at valgene der kan gjøres om til JSON, og et
 * tillegg med funksjoner kan ikke det. Starlight leser denne fila selv.
 */
export default defineEcConfig({
  /*
   * Expressive Code skriver stilarket sitt som en `<link>` inne i
   * `<body>`, ved den første kodeblokken på siden. På komponentsidene ser
   * nettleseren den først rundt 36 000 tegn inn i dokumentet, og må stoppe
   * tegningen på den: 59 av 61 sider hadde et tegneblokkerende stilark
   * midt i innholdet. Med `emitExternalStylesheet: false` legges stilen
   * inline i stedet, og ingen side har det lenger. Prisen er omtrent
   * 4 kB gzip mer HTML per side, altså ingen ekstra rundtur mot en litt
   * større førstelevering.
   */
  emitExternalStylesheet: false,
  // Tastaturtilgang til kodefeltene i HTML-en. Se `ec-tabindex.mjs`.
  plugins: [ecTabindex()],
})
