/**
 * Skriver regelbøkene i `agent/`, én per miljø.
 *
 * Hver fil er komplett for sitt miljø og nevner ingen andre. En agent som
 * leser om `className` i et prosjekt med Go-maler er en agent som skriver
 * `className` i en Go-mal, og støy fra et rammeverk du ikke bruker er nettopp
 * det som får den til å gjette. Duplisering mellom filene koster ingenting,
 * siden alle seks skrives herfra.
 *
 * Rekkefølgen i hver fil følger feilene agenter faktisk gjør, dyreste først:
 * glemt stilark, oppfunne komponenter og varianter, hardkodede farger, og
 * bommet registrering av web components. Sjekken står sist, fordi den er
 * løkka agenten retter seg selv i.
 *
 * Kjør med: bun run generate
 * `scripts/sjekk-agent.ts` kjører det samme i minnet og feller hvis filene på
 * disk er utdaterte.
 */

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  antallByggefunksjoner,
  antallCssKomponenter,
  antallElementer,
  byggefunksjoner,
  CDN,
  cdnTil,
  cssTabell,
  malOgSkrift,
  ombrekk,
  PAKKE,
  tokenListe,
  VERSJON,
  webTabell,
} from "./agent-deler.js"

/** Pakkenavnet, som bundles slår opp. */
const PAKKENAVN = (komponent: string) => `@fristil/designsystem/${komponent}`

/** Stilarket, slik det skrives der det finnes et byggesteg. */
const STILARK_PAKKE = (komponent: string) =>
  `@fristil/designsystem/${komponent}.css`

/**
 * Stilarket uten byggesteg: hele adressen.
 *
 * Kolonna sto med bare filnavnet, og da måtte leseren gjette stien. `field.css`
 * ligger under `ramme/`, ikke under `css/`, så en agent som generaliserte fra
 * knappe-eksempelet fikk 404 på ni av komponentene.
 */
const STILARK_URL = (komponent: string) => cdnTil(`${komponent}.css`)

/**
 * Adressen uten bundles: en URL.
 *
 * Et pakkenavn i en `<script type="module">` uten bundles eller importmap slår
 * ikke opp i nettleseren, og importen feiler stille. Sporene uten byggesteg må
 * derfor ha hele adressen.
 */
const URL_TIL = (_komponent: string, modul: string) => `${CDN}/${modul}`

type Oppskrift = {
  /** Navnet kommandoen tar, og filnavnet. */
  navn: string
  tittel: string
  /** Hvem fila er for, og hva som er særegent ved miljøet. */
  innledning: string
  /** Punkt 1 i kortversjonen: hvordan stilarket kommer inn. */
  stilarkRegel: string
  /** Punkt 4 i kortversjonen: registrering og boolske attributter. */
  punktFire: string
  /** Første av de tre reglene, altså hvor registreringen hører. */
  registreringRegel: string
  /** Seksjon 1, med eksempel. */
  stilark: string
  /** Adressen importen skal ha i dette miljøet. */
  adresse: (komponent: string, modul: string) => string
  /** Adressen stilarket skal ha i dette miljøet. */
  stilarkAdresse: (komponent: string) => string
  /** Seksjon 5: alt satt sammen, slik det faktisk skrives her. */
  markup: string
  /** Det bare dette miljøet har. Står mellom markupen og fallgruvene. */
  ekstra?: string
  /** Kommandoen som sjekker markupen her. */
  sjekk: string
  /** Punkt 5, når sjekken ikke er hovedsikringen i dette miljøet. */
  punktFem?: string
  /** Radene i fallgruvetabellen som gjelder her. */
  fallgruver: [string, string][]
}

const kortversjon = (oppskrift: Oppskrift) => `## Kortversjon

1. ${oppskrift.stilarkRegel}
2. **Bruk bare klassene og elementene i tabellene under.** \`fs-modal\`,
   \`fs-datepicker\` og \`data-variant="outline"\` finnes i andre
   designsystemer, ikke i Fristil. Er du usikker på om noe finnes, står det her
   eller så gjør det ikke det.
3. **Ingen hardkodede farger eller piksler.** \`var(--fs-color-…)\` og
   \`var(--fs-spacing-…)\`.
4. ${oppskrift.punktFire}
5. ${
  oppskrift.punktFem ??
  `**Kjør sjekken på det du har skrevet:** \`${oppskrift.sjekk}\`. Den kjenner
   hver klasse, hvert element, hvert attributt og hver lovlige verdi, skriver
   \`fil:linje:kolonne: melding\`, og avslutter med feilkode hvis den finner
   noe.`
}`

const hvaSomFinnes = (oppskrift: Oppskrift) => `## 2. Hva som finnes

${antallCssKomponenter()} CSS-komponenter og ${antallElementer()} web components, og dette er
hele lista. Klassene er \`fs-\` + kebab-case. Varianter er alltid
\`data-*\`-attributter, aldri egne klasser: \`data-variant="secondary"\`, ikke
\`fs-button--secondary\`. Standardvarianten har ingen attributt.

### CSS-komponenter (ingen JavaScript)

${cssTabell(oppskrift.stilarkAdresse)}`

const TOKENS = `## 3. Tokens

Ett lag. En farge er en celle i en matrise av **familie**, altså hva den
betyr, og **rolle**, altså hva den gjør, og navnet er
\`--fs-color-<familie>-<rolle>\`. Hver familie har hver rolle, så
\`--fs-color-danger-border\` og \`--fs-color-success-border\` finnes begge.
Rollene er de samme uansett familie: \`surface\` er en tonet flate,
\`fill\` en fylt, \`content\` teksten oppå \`fill\`, \`border\` en
ramme, og \`text\` familiens farge som tekst. Kant og tekst har et svakere og
et sterkere trinn ved siden av.

\`\`\`
${tokenListe()}
\`\`\`

${malOgSkrift()}

\`disabled\` og \`neutral\` er ikke det samme. \`disabled\` er for kontroller
som er slått av, og er unntatt kontrastkravet i WCAG 1.4.3. \`neutral\` er for
dempet informasjon brukeren faktisk skal lese eller trykke på, og holder 4,5:1.
Bruk aldri \`disabled\`-fargene for å dempe noe som skal leses.`

/*
 * Eksempelet skrives i regelbokas eget språk.
 *
 * Én delt HTML-blokk ville lært React-agenten å skrive `class=`, og det er
 * nettopp den feilen `/react` finnes for å hindre.
 */
const temaEksempel = (oppskrift: Oppskrift) =>
  oppskrift.navn === "react"
    ? `\`\`\`tsx
<div data-theme="light">
  <button {...fs.button()}>Lagre</button>
</div>
\`\`\``
    : `\`\`\`html
<div data-theme="light">
  <button class="fs-button">Lagre</button>
</div>
\`\`\``

/*
 * Velgeren skrives i regelbokas eget språk, av samme grunn som temaEksempel.
 *
 * Klassen står på hver radioknapp og ikke på gruppa: `:has()` ser etter den
 * som er avkrysset, og det er knappen som er avkrysset.
 */
const velgerEksempel = (oppskrift: Oppskrift) => {
  const react = oppskrift.navn === "react"
  const attr = react ? "className" : "class"
  const linje = (verdi: string, tekst: string, valgt = false) =>
    `  <label ${attr}="fs-toggle-group__option">
    <input ${attr}="fs-theme-control" type="radio" name="tema"
           value="${verdi}"${valgt ? (react ? " defaultChecked" : " checked") : ""} /> ${tekst}
  </label>`

  return `\`\`\`${react ? "tsx" : "html"}
<fieldset ${attr}="fs-toggle-group">
  <legend ${attr}="fs-sr-only">Tema</legend>
${linje("auto", "Følg systemet", true)}
${linje("light", "Lyst")}
${linje("dark", "Mørkt")}
</fieldset>
\`\`\``
}

const TEMA = (oppskrift: Oppskrift) => `### Lyst og mørkt

Uten at du gjør noe, følger fargene maskinens innstilling. En side som vil
bestemme selv setter \`data-theme="light"\` eller \`data-theme="dark"\` på
\`<html>\`.

Attributtet er en **temagrense** og virker på et hvilket som helst element,
ikke bare på roten. Et tema kan ligge inne i et annet, begge veier.

Det er dette en innebygd komponent skal bruke. Legger du Fristil inn i en side
du ikke eier, setter du attributtet på komponentens eget rotelement:

${temaEksempel(oppskrift)}

Da er komponenten lys uansett hva maskinen står på, og verten røres ikke.

Fristil setter **ikke** \`color-scheme\` på \`:root\`. Egenskapen styrer
nettleserens egne flater, altså rullefelt, nedtrekkslister og kalenderpanel,
og den arves nedover. Et barn kan melde seg ut med \`color-scheme: normal\`,
men det er en motregel verten aldri ba om å måtte skrive: sto verdien på
roten, gjaldt den hele dokumentet, også der pakken bare er en gjest. Vil hele
siden følge systemet, skriver du \`color-scheme: light dark\` på \`<html>\`
selv, på samme måte som du selv setter lagrekkefølgen. Unntaket er
temavelgeren under: bruker du den, setter hvert valg \`color-scheme\` selv.

### La brukeren velge tema

\`fs-theme-control\` på en radioknapp gjør \`value\` til et temavalg. Det er
ren CSS, uten en linje JavaScript:

${velgerEksempel(oppskrift)}

Valget styrer to ting. Fristils farger kommer fra tokenene, og nettleserens
**egne** flater fra \`color-scheme\`: \`light\` gir \`light\`, \`dark\` gir \`dark\`, og
\`auto\` gir \`light dark\`. \`light dark\` er ikke et tema, men beskjeden om at
siden fungerer i begge, så nettleseren kan velge etter systemet.

«Følg systemet» har ingen temablokk, og det er med vilje: en verdi uten
blokk treffer ingenting, og da gjelder mediespørringen igjen.

Du skal ikke skrive \`color-scheme\` selv når velgeren er i bruk. En slik
regel utenfor et lag slår \`@layer fristil\` og låser nettleserens flater til
systemet mens brukeren har valgt noe annet.

\`light\` og \`dark\` vinner over \`data-theme\` på \`<html>\`, slik at serveren kan
sende det lagrede valget mens et klikk likevel slår igjennom før svaret er
tilbake. \`auto\` gjør det ikke: den betyr «ingen overstyring fra meg», så har
serveren skrevet \`data-theme\`, er det serverens verdi som står. Skal
«følg systemet» virke med én gang, må det som lagrer valget også fjerne
attributtet.

To ting den ikke gjør. Den **lagrer ingenting**: send gruppa i et skjema og
lagre valget i en cookie serveren leser, eller i \`localStorage\`. Og den må
stå i det **samme treet som \`<html>\`**, siden \`:has()\` ikke ser ut av sitt
eget tre; en kontroll inne i en skyggerot setter ikke tema på siden.`

const webComponents = (oppskrift: Oppskrift) => `## 4. Web components

Tre regler gjelder alle sammen:

1. ${oppskrift.registreringRegel} Importen har ingen bivirkning alene; det er
   \`define\`-kallet som registrerer elementet.
2. **Boolske attributter er sanne så lenge de finnes.** \`invalid="false"\`,
   \`disabled="false"\` og \`open="false"\` slår *på*. Skal noe av det bort, må
   attributtet fjernes helt.
3. **Du skriver markupen, komponenten fester oppførselen.** \`<fs-field>\`
   lager ikke ledeteksten eller kontrollen din. Den kobler sammen dem du har
   lagt inn, med \`id\`, \`for\` og \`aria-describedby\`. Et \`<fs-field>\`
   uten kontroll, eller uten ledetekst, er en feil komponenten melder fra om.

${webTabell(oppskrift.adresse, oppskrift.stilarkAdresse)}

Ingen av dem bruker shadow DOM. Innholdet står i vanlig DOM, så
\`querySelector\`, \`FormData\` og vanlig CSS virker rett inn i det.`

const fallgruver = (rader: [string, string][]) => `## Kjente fallgruver

| Symptom | Årsak |
| --- | --- |
${rader.map(([symptom, årsak]) => `| ${symptom} | ${årsak} |`).join("\n")}`

const AVSLUTNING = `## Når CSS ikke strekker til

Komponentene tilpasses med tokens og \`--fs-\`-variabler. Holder ikke det,
kopierer \`npx @fristil/designsystem overta <komponent>\` kildekoden til én
komponent inn i prosjektet, så du eier den. Et helt fargetema av merkefargene
dine lages med \`npx @fristil/designsystem tema\`.

Alt dette, med levende eksempler: https://fristil.netlify.app/`

// Fallgruvene, samlet her fordi flere miljøer deler dem.
const STILER_MANGLER: [string, string] = [
  "Stilene mangler",
  "`tokens.css` er ikke lastet, eller lastes etter komponentens eget stilark",
]
const INGEN_DEFINE: [string, string] = [
  "Elementet vises ikke, siden ser tom ut",
  "`define`-funksjonen har ikke kjørt",
]
const ALLTID_UGYLDIG: [string, string] = [
  "Feltet er alltid ugyldig",
  '`invalid="false"` er satt. Attributtet må fjernes, ikke settes til `false`',
]
const SERVERRENDERING: [string, string] = [
  "`customElements is not defined`",
  "Registreringen kjøres der det ikke finnes noen nettleser",
]
const TYPESCRIPT_I_SKRIPT: [string, string] = [
  "`SyntaxError` i nettleseren",
  'TypeScript-syntaks i en `<script type="module">` uten byggesteg',
]

const TOKENS_FØRST = `\`tokens.css\` definerer alle variablene, og alle de andre
stilarkene bygger på den. Den lastes derfor først.`

const SJEKK_I_TESTER = `Lager koden HTML-en som strenger, finnes det ingen fil å
sjekke. Kjør da den samme sjekken i testene:

\`\`\`js
import { diagnoseMarkup } from "@fristil/designsystem/diagnostics"

const funn = diagnoseMarkup(html)
// funn er tom når markupen stemmer
\`\`\``

const OPPSKRIFTER: Oppskrift[] = [
  {
    navn: "html",
    stilarkAdresse: STILARK_URL,
    tittel: "Fristil i ren HTML",
    innledning: `Regelboka for Fristil i et prosjekt uten byggesteg:
håndskrevet HTML, der nettleseren laster filene direkte. Bruker du bundles,
React, Astro eller Datastar, eller lager serveren markupen, er det en annen fil
i denne mappa som gjelder.`,
    stilarkRegel: `**Én \`<link>\` til \`fristil.css\`, før alt annet.**
   Mangler den, ser komponentene ustilte ut. Svaret er da å legge inn lenka,
   aldri å skrive egen CSS for å få dem til å se riktige ut.`,
    punktFire: `**Web components registreres én gang med \`defineFs*()\`** i en
   \`<script type="module">\`, og et boolsk attributt er sant så lenge det står
   der: \`invalid="false"\` gjør feltet ugyldig.`,
    registreringRegel: `**\`defineFs*()\` kjøres én gang** i en
   \`<script type="module">\` i sidemalen, før elementet brukes, ikke én gang
   per komponent.`,
    adresse: URL_TIL,
    sjekk: "npx @fristil/designsystem sjekk side.html",
    stilark: `## 1. Stilarket

Én fil med alt, og det enkleste og raskeste uten bundles:

\`\`\`html
<link rel="stylesheet" href="${cdnTil("fristil.css")}">
\`\`\`

Eller fra \`node_modules\`, hvis du serverer mappa:

\`\`\`html
<link rel="stylesheet" href="/node_modules/@fristil/designsystem/dist/fristil.css">
\`\`\`

\`fristil.css\` er rundt 75 kB, under 10 kB komprimert, og har alle
komponentene. Velg den. Alternativet er ett stilark per komponent, og da gjelder
at ${TOKENS_FØRST}

\`\`\`html
<link rel="stylesheet" href="${cdnTil("tokens.css")}">
<link rel="stylesheet" href="${cdnTil("button.css")}">
\`\`\`

De enkelte stilarkene henter delene sine med \`@import\`, som nettleseren først
ser når fila er lastet. \`dist/fristil.css\` har alt flatet ut, uten
\`@import\`, og er derfor raskere når du lenker.`,
    markup: `## 5. Et helt skjema

\`\`\`html
<link rel="stylesheet" href="${cdnTil("fristil.css")}">

<form id="kontaktskjema">
  <fs-field id="navn-felt" required-marker="symbol">
    <label>Fullt navn</label>
    <input class="fs-input" type="text" name="navn" required />
    <p class="fs-error-text">Fyll inn navnet ditt.</p>
  </fs-field>

  <button class="fs-button" type="submit">Send</button>
</form>

<script type="module">
  import { defineFsField } from
    "${cdnTil("field")}"

  defineFsField()
</script>
\`\`\`

Feltet slås ugyldig ved å sette attributtet, ikke ved å bytte klasse:

\`\`\`js
const felt = document.getElementById("navn-felt")
const verdi = felt.querySelector("input").value

felt.toggleAttribute("invalid", verdi.trim() === "")
\`\`\`

TypeScript hører ikke hjemme i en \`<script type="module">\`. Taggen kjøres av
nettleseren som vanlig JavaScript, og \`hendelse as CustomEvent<…>\` gir
\`SyntaxError\` som stopper hele skriptet.`,
    ekstra: `## 6. Sjekk det du har skrevet

\`\`\`bash
npx @fristil/designsystem sjekk side.html
\`\`\`

Mønsteret utvides av skallet, så det skal ikke stå i hermetegn: kommandoen
leser hvert argument som en filsti og utvider ingenting selv. Ett funn gir
feilkode, så den kan stå i CI. Den fanger et element som ikke
finnes, et attributt elementet ikke har, en verdi utenfor lista, \`fs-buton\`,
\`data-variant="secundary"\`, og \`<fs-field>\` uten kontroll eller ledetekst.

${SJEKK_I_TESTER}`,
    fallgruver: [
      STILER_MANGLER,
      INGEN_DEFINE,
      ALLTID_UGYLDIG,
      TYPESCRIPT_I_SKRIPT,
    ],
  },
  {
    navn: "maler",
    stilarkAdresse: STILARK_URL,
    tittel: "Fristil i maler og serverskrevet HTML",
    innledning: `Regelboka for Fristil der serveren lager markupen: Go-maler,
Razor, PHP, Blade, Twig, Jinja, Django, ERB, Liquid, Handlebars, Nunjucks og
Edge, og HTML bygget som strenger i Kotlin, Java, C# eller Python.

Dette er miljøet Fristil er laget for. Komponentene er CSS-klasser og web
components, altså ting nettleseren forstår direkte, så en Go-mal får de samme
komponentene som en React-app uten å ta inn noe JavaScript-rammeverk.

Det er også miljøet med minst sikkerhetsnett. Ingen kompilator ser på
attributtene i en mal, og ingen type stopper \`data-variant="outline"\`. Derfor
gjelder punkt 5 strengere her enn noe annet sted: sjekken er det eneste som
leser markupen din.`,
    stilarkRegel: `**Én \`<link>\` til \`fristil.css\` i sidemalen,** én gang
   for hele appen. Mangler den, ser komponentene ustilte ut. Svaret er da å
   legge inn lenka, aldri å skrive egen CSS for å få dem til å se riktige ut.`,
    punktFire: `**Web components registreres én gang med \`defineFs*()\`** i
   sidemalen, og et boolsk attributt er sant så lenge det står der. I en mal
   betyr det en betingelse rundt hele attributtet,
   \`{{if .Ugyldig}}invalid{{end}}\`, ikke \`invalid="{{.Ugyldig}}"\`.`,
    registreringRegel: `**\`defineFs*()\` kjøres én gang** i sidemalen, ikke én
   gang per komponent.`,
    adresse: URL_TIL,
    sjekk: "npx @fristil/designsystem sjekk maler/*.html",
    stilark: `## 1. Stilarket

Én lenke i sidemalen, med alle komponentene:

\`\`\`html
<link rel="stylesheet" href="${cdnTil("fristil.css")}">
\`\`\`

Eller fra egen server, hvis du kopierer fila inn i de statiske ressursene dine.
\`fristil.css\` er rundt 75 kB, under 10 kB komprimert, og har alt flatet ut
uten \`@import\`, og er det raskeste valget når du lenker.

Vil du bare ha stilarkene sidene faktisk bruker, gjelder at ${TOKENS_FØRST}
Deretter ett stilark per komponent, fra tabellene under. Uten bundles er det
flere rundturer, og én glemt lenke er nok til at noe ser ustilt ut. For en mal
er én fil nesten alltid riktig valg.`,
    markup: `## 5. Et felt i en mal

\`\`\`html
<fs-field {{if .Feil}}invalid{{end}} required-marker="symbol">
  <label>Fullt navn</label>
  <input class="fs-input" type="text" name="navn" value="{{.Navn}}" required />
  {{if .Feil}}<p class="fs-error-text">{{.Feil}}</p>{{end}}
</fs-field>
\`\`\`

Registreringen, én gang i sidemalen:

\`\`\`html
<script type="module">
  import { defineFsField } from
    "${cdnTil("field")}"

  defineFsField()
</script>
\`\`\``,
    ekstra: `## 6. Når serveren sender ny HTML

Patcher du siden underveis, med htmx, Turbo, Datastar eller en egen
\`innerHTML\`-oppdatering, er spørsmålet hvem som eier tilstanden. Som standard
eier komponenten den: \`<fs-tabs>\` husker fanen brukeren valgte, og setter den
tilbake når en patch river den bort. Malen trenger ingenting for det.

Skal serveren kunne flytte tilstanden, som i «gå videre til steg 2», sier du det
med \`server-controlled\`. Da bestemmer hver patch, og komponenten slutter å
sette brukerens valg tilbake:

\`\`\`html
<fs-tabs server-controlled>
  <div class="fs-tabs__list" aria-label="Deler av saken">
    <button>Søknaden</button>
    <button>Vedlegg</button>
  </div>
  <div class="fs-tabs__panel">…</div>
  <div class="fs-tabs__panel" hidden>…</div>
</fs-tabs>
\`\`\`

Attributtet finnes på \`<fs-tabs>\`, \`<fs-popover>\`, \`<fs-dialog>\` og
\`<fs-suggestion>\`. Uten det ville serveren og komponenten kjempet om samme
tilstand. Merk at tilstanden alltid står i markupen serveren sendte, altså
\`aria-selected\` på fanen, \`hidden\` på panelet, ikke i et eget attributt.

## 7. Sjekken er det eneste som leser markupen din

\`\`\`bash
npx @fristil/designsystem sjekk maler/*.html
\`\`\`

Ett funn gir feilkode, så den hører i CI ved siden av testene. Den fanger
\`fs-buton\`, \`data-variant="secundary"\`, \`<fs-modal>\` og \`<fs-field>\`
uten kontroll eller ledetekst.

Den er laget for maler. Kommentarer, \`<script>\` og \`<style>\` hoppes over, og
\`<?…?>\` og \`<%…%>\` inne i en tagg avslutter den ikke før tiden. Disse er
etterprøvde og gir ingen falske funn:

\`\`\`html
<button class="fs-button {{.Ekstra}}">Send</button>
<button class="fs-button" data-variant="{{.Variant}}">Send</button>
<span class="fs-badge" data-color="{% if x %}danger{% endif %}">1</span>
<button class="fs-button" data-variant="<?= $variant ?>">Send</button>
<button class="fs-button" data-variant="@variant">Send</button>
<button class="fs-button" data-variant="<%= variant %>">Send</button>
\`\`\`

${SJEKK_I_TESTER}

Sjekken finnes også i editoren mens du skriver. VS Code-utvidelsen «Fristil»
gir fullføring, forklaring, feilmeldinger og hurtigrettelser i seksten
malspråk, og WebStorm og IntelliJ IDEA Ultimate leser \`web-types.json\` fra
pakken uten noen utvidelse.`,
    fallgruver: [
      STILER_MANGLER,
      INGEN_DEFINE,
      ALLTID_UGYLDIG,
      SERVERRENDERING,
      TYPESCRIPT_I_SKRIPT,
    ],
  },
  {
    navn: "bundles",
    stilarkAdresse: STILARK_PAKKE,
    tittel: "Fristil med bundles",
    innledning: `Regelboka for Fristil i et prosjekt med et byggesteg, der
markupen er vanlig HTML: Vue, Svelte, Solid, Lit, og vanlig TypeScript med Vite,
Rollup, esbuild eller webpack.

Det disse har til felles er de tre tingene som betyr noe her: stilarkene
importeres i inngangsmodulen, attributtene heter det de heter i HTML, og
\`defineFs*()\` kjøres øverst i \`main.ts\`. Skriver du React, er attributtnavnene
annerledes og \`react.md\` gjelder i stedet. Skriver du Astro, importeres
stilarkene i frontmatteret og \`astro.md\` gjelder.`,
    stilarkRegel: `**Importer stilarkene i inngangsmodulen**, \`tokens.css\`
   først. Mangler de, ser komponentene ustilte ut. Svaret er da å legge inn
   importen, aldri å skrive egen CSS for å få dem til å se riktige ut.`,
    punktFire: `**\`defineFs*()\` kjøres øverst i \`main.ts\`,** ikke i en
   livsløpskrok, og et boolsk attributt er sant så lenge det står der. Sjekk at
   det som havner i DOM-en ikke er \`invalid="false"\`: attributtet må fjernes,
   ikke settes til \`false\`.`,
    registreringRegel: `**\`defineFs*()\` kjøres én gang** øverst i
   inngangsmodulen, før appen monteres.`,
    adresse: PAKKENAVN,
    sjekk: "npx @fristil/designsystem sjekk src/komponenter/*.vue",
    stilark: `## 1. Stilarkene

${TOKENS_FØRST} Deretter ett per komponent du bruker, så en side med bare knapper
ikke laster CSS for en dialog:

\`\`\`ts
// main.ts, øverst
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/field.css"
\`\`\`

Navnet på hvert stilark står i tabellene under. Pakken har ingen avhengigheter,
og ingenting registreres ved import alene, så en side som bare bruker
CSS-komponentene tar ikke med JavaScript fra pakken.

Trenger du alt i én fil, finnes \`@fristil/designsystem/fristil.css\`, men med
bundles er det sjelden riktig: da laster du CSS for komponenter siden ikke
bruker.`,
    markup: `## 5. Registrering og markup

\`\`\`ts
// main.ts, øverst, ikke i en livsløpskrok
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
import { defineFsField } from "@fristil/designsystem/field"

defineFsField()
\`\`\`

Kallet står i modulen, ikke i \`mounted\`, \`onMount\` eller en effekt. En krok
kjører etter første tegning, og elementene i markupen er da vanlige
\`HTMLElement\` i det rammeverket tegner dem, og et kall på \`show()\` eller
\`reportFailure()\` før kroken feiler med «is not a function».

Markupen er vanlig HTML, i malen rammeverket ditt bruker:

\`\`\`html
<fs-field required-marker="symbol">
  <label>Fullt navn</label>
  <input class="fs-input" type="text" name="navn" required />
  <p class="fs-error-text">Fyll inn navnet ditt.</p>
</fs-field>

<button class="fs-button" type="submit">Send</button>
\`\`\`

\`class\` og \`for\`, ikke \`className\` og \`htmlFor\`. Det er React som skriver
om attributtnavnene, og det gjelder ikke her.`,
    ekstra: `## 6. Typede byggefunksjoner

Har prosjektet TypeScript, kan klassene komme fra \`fs\` i stedet for å skrives
som strenger. Da blir en variant som ikke finnes en kompileringsfeil:

\`\`\`ts
import { fs } from "@fristil/designsystem"

fs.button({ variant: "secondary" })
// { class: "fs-button", "data-variant": "secondary" }
\`\`\`

Byggefunksjonene gir et objekt med HTML-attributtnavn, som spres inn der malspråket
støtter spredning, eller leses ut felt for felt. De ${antallByggefunksjoner()}
byggefunksjonene:

${byggefunksjoner()}

## 7. Sjekk markupen

\`\`\`bash
npx @fristil/designsystem sjekk src/komponenter/*.vue
\`\`\`

Sjekken leser filer som tekst, så den virker på \`.vue\`, \`.svelte\`, \`.html\`
og hva malen din nå ligger i. Ett funn gir feilkode, så den hører i CI. Den
fanger \`fs-buton\`, \`data-variant="secundary"\`, \`<fs-modal>\` og
\`<fs-field>\` uten kontroll eller ledetekst, altså alt det typene ikke ser, fordi
markupen din er en streng for kompilatoren.

${SJEKK_I_TESTER}`,
    fallgruver: [STILER_MANGLER, INGEN_DEFINE, ALLTID_UGYLDIG, SERVERRENDERING],
  },
  {
    navn: "react",
    stilarkAdresse: STILARK_PAKKE,
    tittel: "Fristil i React",
    innledning: `Regelboka for Fristil i en React-app.

React skiller seg fra alle de andre miljøene på én ting, og den er viktig nok
til å ha sin egen fil: React skriver om attributtnavnene. \`class\` heter
\`className\` og \`for\` heter \`htmlFor\`, og bruker du byggefunksjonene fra
hovedinngangen skriver React «Invalid DOM property» i konsollen for hvert
element. Derfor har pakken en egen React-inngang.`,
    stilarkRegel: `**Importer stilarkene i \`main.tsx\`**, \`tokens.css\`
   først. Mangler de, ser komponentene ustilte ut. Svaret er da å legge inn
   importen, aldri å skrive egen CSS for å få dem til å se riktige ut.`,
    punktFire: `**\`defineFs*()\` kjøres øverst i \`main.tsx\`,** ikke i en
   \`useEffect\`, og et boolsk attributt settes som
   \`invalid={ugyldig || undefined}\`. De to andre skrivemåtene er feil i én av
   React-versjonene hver.`,
    registreringRegel: `**\`defineFs*()\` kjøres én gang** øverst i modulen, før
   \`createRoot\`, ikke i en \`useEffect\`.`,
    adresse: PAKKENAVN,
    sjekk: "npx @fristil/designsystem sjekk src/*.tsx",
    punktFem: `**Typene er sjekken din.** Importer
   \`@fristil/designsystem/react-jsx\` én gang i en \`.d.ts\`-fil, og en variant
   som ikke finnes stopper bygget. Kjør \`tsc\`. Har prosjektet også HTML eller
   maler, sjekkes de med \`npx @fristil/designsystem sjekk <fil>\`.`,
    stilark: `## 1. Stilarkene

${TOKENS_FØRST} Deretter ett per komponent du bruker:

\`\`\`tsx
// main.tsx, øverst
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
import "@fristil/designsystem/button.css"
\`\`\`

Navnet på hvert stilark står i tabellene under.`,
    markup: `## 5. Registrering, typer og bruk

\`\`\`tsx
// main.tsx, kjøres én gang når appen starter
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
import { defineFsField } from "@fristil/designsystem/field"

defineFsField()
\`\`\`

Kallet står øverst i modulen, ikke i en \`useEffect\`. En effekt kjører etter
første tegning, så elementene er vanlige \`HTMLElement\` i det React tegner dem,
og et kall på \`show()\` eller \`reportFailure()\` før effekten feiler med «is not
a function». Funksjonen gjør ingenting på en server, så den kan stå i en
rotmodul som kjøres begge steder. Skal alt registreres, finnes \`defineFs()\` i
\`@fristil/designsystem/register\`.

\`\`\`ts
// src/fristil.d.ts, gir <fs-field> typer i JSX
import "@fristil/designsystem/react-jsx"
\`\`\`

\`\`\`tsx
// Kontaktskjema.tsx
import { fs } from "@fristil/designsystem/react"
import { useState } from "react"

export function Kontaktskjema() {
  const [navn, setNavn] = useState("")
  const [berørt, setBerørt] = useState(false)

  const ugyldig = berørt && navn.trim() === ""

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <fs-field required-marker="symbol" invalid={ugyldig || undefined}>
        <label>Fullt navn</label>
        <input
          {...fs.input({ type: "text" })}
          name="navn"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          onBlur={() => setBerørt(true)}
        />
        <p {...fs.errorText()}>Fyll inn navnet ditt.</p>
      </fs-field>

      <button {...fs.button()} type="submit">Send</button>
    </form>
  )
}
\`\`\`

\`fs\` importeres fra \`@fristil/designsystem/react\`, aldri fra hovedinngangen:
React-inngangen gir \`className\` og \`htmlFor\`, hovedinngangen gir \`class\`
og \`for\`. De ${antallByggefunksjoner()} byggefunksjonene finnes i begge:

${byggefunksjoner()}`,
    ekstra: `## 6. Bare \`invalid={ugyldig || undefined}\` virker

React behandler web components ulikt mellom versjoner, og bare dette
mønsteret er riktig i begge:

| Skrivemåte | React 18 (setter attributt) | React 19 (setter egenskap) |
| --- | --- | --- |
| \`invalid=""\` | virker | aldri ugyldig |
| \`invalid={ugyldig}\` | alltid ugyldig | virker |
| \`invalid={ugyldig \\|\\| undefined}\` | virker | virker |

React 18 stringifiserer \`false\` til attributtet \`invalid="false"\`.
Attributtet finnes da, og er dermed sant. React 19 setter egenskapen til
\`""\`, som er usann.

Importerer du \`@fristil/designsystem/react-jsx\`, blir de to andre variantene
kompileringsfeil.

## 7. Typene

Uten \`@fristil/designsystem/react-jsx\` kjenner ikke TypeScript \`<fs-field>\` i
det hele tatt, og du får \`Property 'fs-field' does not exist on type
'JSX.IntrinsicElements'\`. Med den får du autofullføring og feil på attributtene:

\`\`\`tsx
<fs-field required-marker="tekst" />     // feil: "none" | "symbol" | "text"
<fs-session-timeout warnAt={1500} />     // feil: attributtet heter warn-at
<fs-connection-status offline="Nede" />  // feil: ukjent attributt
\`\`\`

Typene virker ved at pakken utvider Reacts \`JSX.IntrinsicElements\`. Har
prosjektet to installasjoner av \`@types/react\`, noe som lett skjer i et
monorepo, utvider pakken den ene mens koden din bruker den andre, og elementene
forblir ukjente. Kjør \`npm ls @types/react\` hvis noe ser rart ut.`,
    fallgruver: [
      STILER_MANGLER,
      INGEN_DEFINE,
      ALLTID_UGYLDIG,
      SERVERRENDERING,
      [
        "«Invalid DOM property `class`»",
        "`fs` er importert fra hovedinngangen. Bruk `@fristil/designsystem/react`",
      ],
      [
        "`Property 'fs-field' does not exist`",
        "`@fristil/designsystem/react-jsx` er ikke importert i en `.d.ts`-fil",
      ],
    ],
  },
  {
    navn: "astro",
    stilarkAdresse: STILARK_PAKKE,
    tittel: "Fristil i Astro",
    innledning: `Regelboka for Fristil i et Astro-prosjekt.

En \`.astro\`-fil er HTML med frontmatter over. Stilarkene importeres der, og
byggefunksjonene brukes rett i malen, siden Astro støtter spredning som JSX. Det
særegne er at alt dette kjøres ved bygging: ut kommer ren HTML, og \`fs\` er
borte når siden er bygd. Null JavaScript sendt til nettleseren.`,
    stilarkRegel: `**Importer stilarkene i frontmatteret**, \`tokens.css\`
   først. Mangler de, ser komponentene ustilte ut. Svaret er da å legge inn
   importen, aldri å skrive egen CSS for å få dem til å se riktige ut.`,
    punktFire: `**\`defineFs*()\` hører i en \`<script>\` i malen, aldri i
   frontmatteret:** frontmatteret kjøres på serveren, der
   \`customElements\` ikke finnes. Og et boolsk attributt er sant så lenge det
   står der.`,
    registreringRegel: `**\`defineFs*()\` kjøres én gang** i en \`<script>\` i
   malen. Astro pakker \`<script>\`-tagger og kjører dem på klienten.`,
    adresse: PAKKENAVN,
    sjekk: "npx @fristil/designsystem sjekk src/pages/*.astro",
    stilark: `## 1. Stilarkene

${TOKENS_FØRST} Importene står i frontmatteret:

\`\`\`astro
---
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/badge.css"
---
\`\`\`

Navnet på hvert stilark står i tabellene under. Har du et layoutkomponent, hører
\`tokens.css\` der, én gang for hele siden.`,
    markup: `## 5. Byggefunksjonene i malen

\`\`\`astro
---
import { fs } from "@fristil/designsystem"
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/badge.css"
---

<button {...fs.button({ variant: "secondary" })}>Lagre utkast</button>
<span {...fs.badge({ color: "success" })}>Innvilget</span>
\`\`\`

Kjøres ved bygging. Ut kommer ren HTML:

\`\`\`html
<button class="fs-button" data-variant="secondary">Lagre utkast</button>
<span class="fs-badge" data-color="success">Innvilget</span>
\`\`\`

\`fs\` importeres fra hovedinngangen, som gir \`class\` og \`for\`. De
${antallByggefunksjoner()} byggefunksjonene:

${byggefunksjoner()}`,
    ekstra: `## 6. Felt uten JavaScript

\`fs.field()\` regner ut koblingen mellom ledetekst, kontroll, hjelpetekst og
feilmelding i frontmatteret, så også den blir statisk HTML:

\`\`\`astro
---
import { fs } from "@fristil/designsystem"
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"

const epost = fs.field({ id: "epost", required: "symbol", help: true, error: true })
---

<label {...epost.label}>E-postadresse</label>
<input {...fs.input({ type: "email" })} {...epost.control} name="epost" required />
<p {...fs.helpText()} {...epost.help}>Vi sender kvittering hit.</p>
<p {...fs.errorText()} {...epost.error}>Skriv en gyldig adresse.</p>
\`\`\`

Ingen \`<fs-field>\`, ingen kjøretid.

## 7. Web components i Astro

Skal feltet kunne bli ugyldig mens brukeren står i det, må komponenten
registreres:

\`\`\`astro
---
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/field.css"
---

<fs-field required-marker="symbol">
  <label>Fullt navn</label>
  <input class="fs-input" type="text" name="navn" required />
  <p class="fs-error-text">Fyll inn navnet ditt.</p>
</fs-field>

<script>
  import { defineFsField } from "@fristil/designsystem/field"
  defineFsField()
</script>
\`\`\`

\`customElements\` finnes bare i nettleseren, så registreringen kan ikke stå i
frontmatteret. En \`<script>\` i malen er alt som skal til: komponentene er
vanlige web components, og trenger verken en Astro-integrasjon eller et
\`client:\`-direktiv.`,
    fallgruver: [
      STILER_MANGLER,
      INGEN_DEFINE,
      ALLTID_UGYLDIG,
      [
        "`customElements is not defined`",
        "Registreringen står i frontmatteret. Den hører i en `<script>` i malen",
      ],
    ],
  },
  {
    navn: "datastar",
    stilarkAdresse: STILARK_URL,
    tittel: "Fristil med Datastar",
    innledning: `Regelboka for Fristil sammen med
[Datastar](https://data-star.dev), som legger reaktivitet på vanlig HTML med
\`data-*\`-attributter. Ett skript, ingen byggesteg, altså samme premiss som Fristil.

Det betyr to ting for denne fila: adressene er URL-er, siden en nettleser uten
bundles ikke slår opp et pakkenavn, og tilstanden styres med attributter, som er
nøyaktig det \`ramme\`-komponentene forventer.`,
    stilarkRegel: `**Én \`<link>\` til \`fristil.css\`, før alt annet.** Mangler
   den, ser komponentene ustilte ut. Svaret er da å legge inn lenka, aldri å
   skrive egen CSS for å få dem til å se riktige ut.`,
    punktFire: `**\`defineFs*()\` kjøres én gang i en \`<script type="module">\`
   med hele URL-en,** og tilstanden settes med \`data-attr:\`, som legger på og
   fjerner attributtet. \`invalid="false"\` ville gjort feltet ugyldig.`,
    registreringRegel: `**\`defineFs*()\` kjøres én gang** i en
   \`<script type="module">\` i sidemalen.`,
    adresse: URL_TIL,
    sjekk: "npx @fristil/designsystem sjekk side.html",
    stilark: `## 1. Stilarket og Datastar

\`\`\`html
<link rel="stylesheet" href="${cdnTil("fristil.css")}">
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.3/bundles/datastar.js"
></script>
\`\`\`

\`fristil.css\` er rundt 75 kB, under 10 kB komprimert, og har alle
komponentene. Vil du bare ha det du bruker, gjelder at ${TOKENS_FØRST}`,
    markup: `## 5. Et skjema med Datastar

\`\`\`html
<form
  data-signals="{navn: '', beroert: false}"
  data-computed:ugyldig="$beroert && $navn.trim() === ''"
>
  <fs-field required-marker="symbol" data-attr:invalid="$ugyldig">
    <label>Fullt navn</label>
    <input
      class="fs-input"
      type="text"
      name="navn"
      data-bind:navn
      data-on:blur="$beroert = true"
    />
    <p class="fs-error-text">Fyll inn navnet ditt.</p>
  </fs-field>

  <button class="fs-button" type="submit">Send</button>
</form>

<script type="module">
  import { defineFsField } from
    "${cdnTil("field")}"

  defineFsField()
</script>
\`\`\`

\`data-signals\` oppretter tilstanden, \`data-computed:ugyldig\` utleder
valideringen av den, \`data-bind:navn\` binder feltet begge veier, og
\`data-on:blur\` markerer at brukeren har forlatt det.

\`data-attr:invalid\` er koblingen til komponenten: den setter attributtet når
uttrykket er sant og fjerner det når det er usant, nøyaktig slik \`<fs-field>\`
forventer. Ingen av React-fellene finnes her. Datastar jobber direkte på
attributtene.`,
    ekstra: `## 6. HTML fra serveren

Datastar kan la serveren sende HTML underveis, over Server-Sent Events. En web
component oppgraderer seg selv når den settes inn i dokumentet, så
lenge \`defineFsField()\` har kjørt én gang. Serveren kan derfor sende dette som
ren HTML:

\`\`\`html
<fs-field required-marker="text" invalid>
  <label>E-postadresse</label>
  <input class="fs-input" type="email" value="ola@" />
  <p class="fs-help-text">Vi sender kvittering hit.</p>
  <p class="fs-error-text">Skriv en gyldig adresse.</p>
</fs-field>
\`\`\`

Komponenten kobler da \`for\` og \`id\`, setter \`fs-label\`, legger på
\`aria-invalid\` og bygger \`aria-describedby\`, uten at det sendes JavaScript
med for akkurat dette feltet. Det er poenget med at \`ramme\`-komponentene bor i
vanlig DOM: markupen er dataen, og tilgjengeligheten kobles der den lander.

Patcher serveren en komponent som holder tilstand, er spørsmålet hvem som eier
den. Som standard eier komponenten den: \`<fs-tabs>\` husker fanen brukeren
valgte, og setter den tilbake når en patch river den bort. Skal serveren kunne
flytte den, sier du det med \`server-controlled\`:

\`\`\`html
<fs-tabs server-controlled data-on:tab-select="$fane = evt.detail.index">
  <div class="fs-tabs__list" aria-label="Deler av saken">
    <button>Søknaden</button>
    <button>Vedlegg</button>
  </div>
  <div class="fs-tabs__panel">…</div>
  <div class="fs-tabs__panel" hidden>…</div>
</fs-tabs>
\`\`\`

Attributtet finnes på \`<fs-tabs>\`, \`<fs-popover>\`, \`<fs-dialog>\` og
\`<fs-suggestion>\`. Uten det ville serveren og komponenten kjempet om samme
tilstand.

\`fs\` kan brukes på serveren eller i et byggesteg. Datastar trenger den ikke i
nettleseren.`,
    fallgruver: [
      STILER_MANGLER,
      INGEN_DEFINE,
      ALLTID_UGYLDIG,
      TYPESCRIPT_I_SKRIPT,
    ],
  },
]

/** Filene generatoren skriver, med innholdet de skal ha. */
export function filer(): Record<string, string> {
  const ut: Record<string, string> = {}

  for (const oppskrift of OPPSKRIFTER) {
    ut[`agent/${oppskrift.navn}.md`] = sammensett(oppskrift)
  }

  return ut
}

function sammensett(oppskrift: Oppskrift): string {
  return ombrekk(
    `${[
      `# ${oppskrift.tittel}`,
      oppskrift.innledning,
      `Dette er @fristil/designsystem ${VERSJON}. Fila er generert av pakken og følger versjonen, så den kan aldri stå og si noe annet enn koden ved siden av.`,
      kortversjon(oppskrift),
      oppskrift.stilark,
      hvaSomFinnes(oppskrift),
      TOKENS,
      TEMA(oppskrift),
      webComponents(oppskrift),
      oppskrift.markup,
      ...(oppskrift.ekstra ? [oppskrift.ekstra] : []),
      fallgruver(oppskrift.fallgruver),
      AVSLUTNING,
    ].join("\n\n")}\n`,
  )
}

/** Navnene kommandoen kjenner, lest av oppskriftene. */
export const NAVN = OPPSKRIFTER.map((oppskrift) => oppskrift.navn)

if (import.meta.main) {
  const skrevet = filer()
  for (const [sti, innhold] of Object.entries(skrevet)) {
    writeFileSync(join(PAKKE, sti), innhold)
  }
  console.log(
    `✓ ${Object.keys(skrevet).length} regelbøker: ${NAVN.join(", ")} (${antallCssKomponenter()} CSS-komponenter, ${antallElementer()} elementer, ${byggefunksjoner().split(", ").length} byggefunksjoner)`,
  )
}
