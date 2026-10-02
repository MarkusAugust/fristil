import {
  colorTokens,
  cssTokens,
  darkColorTokens,
  darkTokens,
} from "../src/tokens/tokens"

const sections: Record<string, string[]> = {}

/*
 * Fargene kommer fra matrisen, resten fra `tokens.ts`.
 *
 * Systemets egne farger er kontrakten anvendt på systemets egne kulører, så
 * det finnes ingen håndskrevet utgave som kan komme ut av takt med løftene.
 */
const alle: Record<string, string> = { ...cssTokens, ...colorTokens }

for (const key of Object.keys(alle)) {
  // Fargene grupperes på familie, resten på slag: `--fs-color-danger-*` blir
  // «fs-color-danger», `--fs-spacing-4` blir «fs-spacing».
  const deler = key.replace(/^--/, "").split("-")
  const section = deler
    .slice(0, key.startsWith("--fs-color-") ? 3 : 2)
    .join("-")

  if (!sections[section]) sections[section] = []
  sections[section].push(`  ${key}: ${alle[key]};`)
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
 * `color-scheme` settes bare der noen har valgt et tema, aldri på bar `:root`.
 *
 * Egenskapen styrer nettleserens egne flater: nedtrekkslista til en
 * `<select>`, rullefelt, kalenderpanelet i et datofelt og standardfargen på
 * en side uten egen bakgrunn. Den er derfor nødvendig, men den arves nedover
 * fra `<html>`. Et barn kan melde seg ut med `color-scheme: normal`, men
 * det er en motregel verten aldri ba om å måtte skrive.
 *
 * Sto den på `:root`, tok Fristil over fargeskjemaet til et dokument det
 * ikke eier. En komponent som laster `fristil.css` inn i en vertsside ga hele
 * verten mørke rullefelt og skjemakontroller i mørk modus, langt utenfor
 * komponenten selv, og verten hadde aldri bedt om det.
 *
 * En side som vil at nettleserens flater skal følge systemet, skriver derfor
 * `color-scheme: light dark` på `<html>` selv. Det er den samme avtalen som
 * for lagrekkefølgen: to linjer konsumenten eier.
 *
 * Unntaket er temavelgeren nedenfor. Hvert av de tre valgene setter
 * `color-scheme` selv, og da skal konsumenten ikke skrive den: en regel
 * utenfor et lag slår `@layer fristil`.
 */
const lines = [
  "/* Generert. Rediger tokens.ts, ikke denne fila. */",
  "",
  "@layer fristil {",
  "  :root {",
]
for (const [index, [section, props]] of Object.entries(sections).entries()) {
  // Tom linje mellom gruppene, men ikke før den første: to på rad ville
  // biome flagget hver gang fila genereres på nytt.
  if (index > 0) lines.push("")
  lines.push(`    /* ${section} */`)
  lines.push(...props.map((line) => `  ${line}`))
}
lines.push("  }")

const morkeNavn = Object.keys({ ...darkTokens, ...darkColorTokens })

const darkLines = morkeNavn.map(
  (name) => `      ${name}: ${{ ...darkTokens, ...darkColorTokens }[name]};`,
)

/*
 * De lyse verdiene for nøyaktig de tokenene mørkt tema overstyrer.
 *
 * Uten denne lista sto `[data-theme="light"]` med bare `color-scheme`, mens
 * `[data-theme="dark"]` hadde alle 90. De to var altså ikke samme slags
 * regel: mørkt tema virket på et hvilket som helst element, lyst tema bare
 * på `<html>`, fordi et barn ikke kan overstyre en variabel det arver uten
 * å deklarere den på nytt. En komponent med `data-theme="light"` på sin egen
 * `<div>` fikk derfor mørke farger på en lys vertsside.
 *
 * Lista bygges av de samme nøklene, ikke av en egen håndskrevet utgave, så
 * de to blokkene ikke kan komme ut av takt. Et token uten lys verdi ville
 * vært en feil i `tokens.ts`, og stopper genereringen her.
 */
const lightLines = morkeNavn.map((name) => {
  const verdi = alle[name]
  if (verdi === undefined)
    throw new Error(
      `${name} er overstyrt i mørkt tema, men har ingen lys verdi i tokens.ts.`,
    )
  return `      ${name}: ${verdi};`
})

/*
 * Mørkt tema skrives to ganger, og det er med vilje.
 *
 * Mediespørringen gjør at systemvalget gjelder uten at konsumenten skriver
 * noe. `:not([data-theme="light"])` lar en app tvinge lyst tema på hele
 * dokumentet fra en maskin som står i mørkt.
 *
 * Attributtreglene under er noe annet: de er temagrenser, og virker på et
 * hvilket som helst element. Begge deklarerer alle de 90 tokenene, slik at
 * et tema kan ligge inne i et annet, begge veier, og slik at en innebygd
 * komponent kan
 * låse sitt eget tre uten å røre verten.
 */
/*
 * `.fs-theme-control` lar brukeren velge tema uten en linje JavaScript.
 *
 * Klassen står på en radioknapp, og `value` sier hvilket tema den velger.
 * Selektoren blir en ekstra linje på temablokkene framfor en kopi av dem, så
 * de 90 tokenene står ett sted.
 *
 * «Følg systemet» trenger ingen temablokk: en verdi uten blokk treffer
 * ingenting, og da gjelder `:root` og mediespørringen igjen.
 *
 * Den trenger likevel `color-scheme`, og det er funnet underveis. Fristil
 * setter den ikke på bar `:root`, siden pakken kan være en gjest på en side den
 * ikke eier, så rådet har vært at konsumenten skriver `color-scheme: light
 * dark` på `<html>` selv. Gjør den det utenfor et lag, slår regelen
 * `@layer fristil`, og et valgt mørkt tema fikk lyse rullefelt og
 * skjemakontroller. Å svare med «legg den i et lag foran fristil» er en felle:
 * lagrekkefølgen er alt etablert av tokens.css, som lastes først, så en senere
 * `@layer`-setning legger laget bak. Kontrollen tar derfor ansvaret selv, og
 * den som bruker den trenger ikke skrive `color-scheme` i det hele tatt.
 *
 * Kontrollen vinner over `data-theme` på det samme elementet, siden `:has()`
 * tar spesifisiteten til argumentet sitt. Det er med vilje: serveren sender
 * valget den har lagret, og klikket skal slå igjennom før svaret er tilbake.
 * Rekkefølgen er etterprøvd i alle tre motorene i `tema.browser.test.ts`,
 * ikke regnet ut her.
 */
const control = (tema: string) =>
  `:root:has(.fs-theme-control[value="${tema}"]:checked)`

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
  '  [data-theme="light"],',
  `  ${control("light")} {`,
  "    color-scheme: light;",
  "",
  ...lightLines.map((l) => l.slice(2)),
  "  }",
  "",
  '  [data-theme="dark"],',
  `  ${control("dark")} {`,
  "    color-scheme: dark;",
  "",
  ...darkLines.map((l) => l.slice(2)),
  "  }",
  "",
  /*
   * Ingen tokens her: `auto` skal nettopp falle tilbake på mediespørringen.
   * Bare nettleserens egne flater trenger å få vite at begge er i orden.
   *
   * Vilkåret er ikke pynt. `auto` betyr «ingen overstyring fra meg», så har
   * serveren skrevet et tema, er det serverens verdi som står, både for
   * tokenene og for flatene. Uten vilkåret vant `auto` på `color-scheme` fordi
   * `:has()` er mer spesifikk enn attributtet, mens tokenene kom fra
   * attributtblokka: mørke farger med lyse rullefelt, altså nøyaktig spriket
   * blokkene over finnes for å hindre.
   *
   * Det spør på **verdi** og ikke på om attributtet finnes. Et `data-theme`
   * uten blokk, som `auto` eller en skrivefeil, lar tokenene falle til `:root`
   * og mediespørringen. Spurte vi bare `:not([data-theme])`, ble `auto`-regelen
   * blokkert av en slik verdi, og `color-scheme` sto usatt mens tokenene fulgte
   * systemet: det samme spriket, utløst av den andre enden.
   */
  // Brytningen står inne i `:has(…)`. Et linjeskift mellom leddene utenfor
  // parentesen ville blitt en etterkommerselektor. Formen er Biomes.
  '  :root:not([data-theme="light"]):not([data-theme="dark"]):has(',
  '    .fs-theme-control[value="auto"]:checked',
  "  ) {",
  "    color-scheme: light dark;",
  "  }",
  "}",
)

await Bun.write(
  new URL("../src/tokens/tokens.css", import.meta.url),
  `${lines.join("\n")}\n`,
)

console.log(
  `✓ tokens.css generert: ${Object.keys(alle).length} verdier, ${darkLines.length} overstyrt i mørkt tema`,
)
