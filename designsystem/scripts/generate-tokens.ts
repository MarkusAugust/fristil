import {
  colorTokens,
  cssTokens,
  darkColorTokens,
  darkTokens,
} from "../src/tokens/tokens"
import { elements } from "../src/vocabulary/elements"

const ELEMENTER = Object.keys(elements)

/*
 * Hver `fs-`-klasse komponentstilarkene styler, lest fra stilarkene selv.
 * Eksakte klassevelgere og ikke `[class*="fs-"]`: den traff også
 * Bootstraps `fs-1`, og bommet på en klasse med tab eller linjeskift foran.
 */
const KLASSER = new Set<string>()
for await (const fil of new Bun.Glob("src/components/**/*.css").scan({
  cwd: `${import.meta.dir}/..`,
  absolute: true,
})) {
  const kilde = (await Bun.file(fil).text()).replace(/\/\*[\s\S]*?\*\//g, "")
  for (const [, navn] of kilde.matchAll(/\.(fs-[a-z0-9_-]+)/g))
    KLASSER.add(navn)
}

/*
 * Barn uten egen klasse som får `display` fra en komponentregel.
 * `skjult.browser.test.ts` leter selv etter slike regler i stilarkene, så et
 * nytt barn som mangler her, feiler der.
 */
const BARN = [
  ".fs-accordion summary",
  ".fs-breadcrumbs li",
  ".fs-file-upload-list li",
  ".fs-pagination *",
  ".fs-select option",
]

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
 * Tokenene som er bygget av andre tokens, som fokusringen og avslått tilstand.
 *
 * En `var()` i en egendefinert egenskap regnes ut der den deklareres, og
 * barna arver den ferdige verdien. Sto de bare på `:root`, fikk en seksjon
 * med `data-theme="dark"` på en lys side den lyse fokusringen, 2,4:1 mot den
 * mørke flaten, og en avslått knapp ble lysegrå. Deklarert på nytt i hver
 * temablokk, også mediespørringen så blokkene holder seg like, regnes de ut
 * mot temaets farger, også et generert tema i `fristil-tema`-laget.
 *
 * Prisen er at en overstyring på `:root` ikke når inn i et `data-theme`: en
 * deklarasjon på elementet selv slår en verdi det arver. Lista er derfor
 * skrevet ut, så et nytt alias som `var(--fs-font-family-base)` ikke havner
 * her uten at noen har bestemt det.
 */
const AVLEDET = [
  "--fs-color-disabled-surface",
  "--fs-color-disabled-text",
  "--fs-focus-ring",
]
const avledetLines = AVLEDET.map((name) => {
  if (alle[name] === undefined)
    throw new Error(`${name} finnes ikke i tokens.ts.`)
  return `      ${name}: ${alle[name]};`
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
  ...avledetLines,
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
  ...avledetLines.map((l) => l.slice(2)),
  "  }",
  "",
  '  [data-theme="dark"],',
  `  ${control("dark")} {`,
  "    color-scheme: dark;",
  "",
  ...darkLines.map((l) => l.slice(2)),
  ...avledetLines.map((l) => l.slice(2)),
  "  }",
  "",
  /*
   * En temagrense gir også flaten og teksten. Uten dette sto en
   * `<div data-theme="dark">` på en lys side gjennomsiktig: tokenene ble
   * mørke, men bakgrunnen var fortsatt sidens hvite, og brødteksten ble
   * 1,23:1. Bare `light` og `dark`: andre verdier har ingen temablokk.
   * `:where` gir spesifisitet null, så en komponent med `data-theme` på seg
   * beholder sin egen flate.
   *
   * Roten får ingenting. Pakken kan være gjest på en side den ikke eier, og
   * en bakgrunn på `<html>` stoppet sidens egen `body`-bakgrunn fra å fylle
   * vinduet. `fs-toast` er en fast kolonne over siden, og skal ikke bli en
   * mørk stripe bak meldingene.
   */
  "  :where(",
  '    [data-theme="light"]:not(:root, fs-toast),',
  '    [data-theme="dark"]:not(:root, fs-toast)',
  "  ) {",
  "    background-color: var(--fs-color-neutral-canvas);",
  "    color: var(--fs-color-neutral-text);",
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
  "",
  /*
   * `hidden` skal skjule, også en komponent som setter `display` selv.
   *
   * Forfatterstil i et hvilket som helst lag slår nettleserens
   * `[hidden] { display: none }`, så `<div class="fs-alert" hidden>` sto
   * synlig. `!important` i laget er det nettleseren selv gjør, og slår alle
   * vanlige deklarasjoner uansett spesifisitet, også varianter som
   * `.fs-select[data-picker="styled"] option`. Det slår også konsumentens
   * egen `!important` uten lag, så `hidden` kan ikke overstyres her.
   *
   * Elementene står for seg, siden en web component ikke trenger en klasse,
   * og barna i `BARN` har ingen. `until-found` skal ikke skjules helt:
   * nettleseren søker i det.
   */
  "  :is(",
  ...[
    ...[...KLASSER].sort().map((navn) => `.${navn}`),
    ...ELEMENTER,
    ...BARN,
  ].map((velger, i, alle) => `    ${velger}${i < alle.length - 1 ? "," : ""}`),
  '  )[hidden]:not([hidden="until-found" i]) {',
  "    /* biome-ignore lint/complexity/noImportantStyles: `hidden` skal vinne over komponentens `display`, slik nettleseren selv gjør */",
  "    display: none !important;",
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
