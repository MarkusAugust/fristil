# Endringer i @fristil/designsystem

Versjonsnumrene følger [semantisk versjonering](https://semver.org/lang/no/).
Det offentlige API-et er større enn funksjonene pakken eksporterer, så disse
regnes som brytende endringer og krever en ny hovedversjon:

- et klassenavn, et `data-*`-attributt eller en lovlig verdi som forsvinner
  eller endrer betydning,
- et hvilket som helst annet attributt en byggefunksjon skriver ut, `aria-*`
  medregnet, som forsvinner eller endrer betydning. Det byggefunksjonene
  sender ut står i konsumentens markup, og kan styles og testes mot. Det en
  web component setter i nettleseren er ikke API på samme måte: det er
  oppførsel, og rettes som oppførsel,
- et `part`-navn i en komponent med shadow DOM,
- et tokennavn eller en `--fs-*`-variabel,
- en funksjon eller en type i `fs`,
- en oppføring i `exports` i `package.json`.

Nye komponenter, nye valgfrie attributter, nye attributter en byggefunksjon
legger til, og rettelser som ikke endrer markup kommer i et nytt undertall.
Før 1.0 kan et undertall også ha brytende endringer, og da står de under en
egen overskrift «Brytende».

## Ikke utgitt

### Rettet

- **Regelbøkene for kodeagenter og dokumentasjonen sa ulike ord om det samme.**
  Regelbøkene under `agent/` skrev «byggerne» og «egendefinert element» der
  dokumentasjonen skrev «byggefunksjon» og «web component». En agent som får
  begge i konteksten møtte to navn på én ting. `sjekk-ordbruk.ts` vokter nå
  begge ordene, og leser også `README.md` i pakken, som den ikke gjorde før.

## 0.22.0 (2026-09-29)

### Brytende

- **Fargene er en matrise, ikke to lag.** En farge er et punkt i en matrise av
  **familie** (`accent`, `visited`, `brand1-3`, `neutral`, `danger`, `warning`,
  `success`) og **rolle** (`surface`, `border-subtle`, `border`,
  `border-strong`, `fill`, `content`, `text-subtle`, `text`, `text-strong`).
  Navnet er `--fs-color-<familie>-<rolle>`.

  `--palette-*` og `--semantic-*` er borte. Det samme er `--size-*`, som nå
  heter `--fs-spacing-*`. Hvert fargenavn, hver avstand, hver linjeavstand,
  hvert ikon, skyggen og fokusringen heter nå `--fs-<slag>-<navn>`, som hos
  Tailwind, daisyUI og Digdir, og slaget i navnet er det som lar Tailwind-temaet
  bli generert framfor skrevet av for hånd. De tretten `--font-size-*` og
  `--font-weight-*` beholder navnene sine, siden de alt følger CSS-egenskapen
  de setter.

- **Kontrasten er garantert av konstruksjonen.** Kuløren er konsumentens,
  lysheten er rollens. Lyshetene er regnet fram mot et sveip rundt hele
  fargesirkelen på den høyeste metningen sRGB kan vise, så løftene holder
  uansett merkefarge. Justeringspasset som flyttet fargen din etterpå er borte,
  og det samme er metningstaket `maxChroma`: uten et pass å mate finnes det
  ingenting å dempe for.

- **Generatoren er 352 linjer mot 744.** `buildScale`, `buildNeutralScale`,
  `adjustForContrast`, `SCALE_STEPS`, `NEUTRAL_STEPS`, `MAX_CHROMA`,
  `CHROMA_FLOOR`, `CHROMA_CEILING` og typen `AdjustResult` er fjernet fra
  `@fristil/designsystem/farge`, som nå bare har fargeregningen. Fra
  `@fristil/designsystem/tema` er typen `ThemeAdjustment` og feltet
  `Theme.adjustments` borte.
  En familie du utelater arver Fristils egen framfor å felle kjøringen, så
  `fristil tema --aksent=#7c3aed` er nok. Flagget het `--interaktiv`, og heter
  nå `--aksent`, som familien. To navn på den samme fargen var nettopp det
  matrisen skulle bli kvitt.

- **To nye roller og ett nytt lag kom av migreringen.** `border-strong`, fordi koden brukte
  tre kantnivåer og matrisen hadde to: en feltramme som endrer seg ved hover,
  og en tabellstrek som er tydeligere enn en radskiller. `text-strong`, fordi
  brødtekst satt til `text` ble `#4a4d51` der den før var `#1a1a1a`, altså
  8,5:1 mot hvitt der den hadde 17,4:1. Kravet holdt, lesbarheten ikke.
  Brødteksten står nå på `text-strong`, `#27292b`, som er 14,6:1. Og `raised`,
  som er et lag den nøytrale familien har ved siden av rollene, siden tekst må
  holde mot et kort som ligger over et kort.

### Lagt til

- **`fristil sjekk-tema <fil…>`** kontrollerer et tema noen har skrevet selv,
  og sier hvilken celle som ryker og hvorfor. Den teller verdiene konsumenten
  selv skrev: både filtallet og løftetallet er de samme for én linje som for et
  helt tema, siden standardverdiene fyller hullene.

- **Tre nye inngangspunkter:** `./kontrakt` med rollene og løftene, `./matrise`
  som bygger et tokensett av merkefarger, og `./tema-sjekk`.

### Rettet

- **Gjeldende side i pagineringen forsvant under musa.**
  `.fs-pagination a:hover` slo `[aria-current="page"]` på spesifisitet, så
  sidetallet brukeren sto på fikk en lys flate mens teksten ble stående i
  `accent-content`: 1,09:1 i lyst tema og 1,25:1 i mørkt. Gjeldende side er nå
  unntatt fra regelen og har sin egen hover. Feilen har vært der siden
  pagineringen kom, og ingen test så den, fordi `:hover` ikke kan leses av
  `getComputedStyle`.

  `hover.browser.test.ts` fører nå musa over tolv av de fjorten hover-reglene
  som bytter bakgrunn, i begge temaer, og krever 4,5:1. De to siste ligger bak
  et pseudoelement og bak en `@supports` Firefox ikke har, og kontrolleres på
  tokenparet. Lista er bundet til stilarkene, så en ny slik regel uten et
  tilfelle feller testen, og hvert tilfelle påstår at flaten under musa er en
  annen enn flaten uten.

- **Siste steg i brødsmulestien ble blått under musa.** Samme årsak:
  `:hover` slo `[aria-current="page"]`. Gjeldende steg er ikke et sted å gå,
  og står nå urørt.

- **Tre steder i dokumentasjonen sto «byggefunksjon» der ordet var et verb,**
  som «generatoren byggefunksjon skalaene». Setningene ga ingen mening.

- **«Tilpasning» sa «fire veier» over en tabell med tre rader.**

- **«Eget tema» sa at skriften settes i `@layer fristil`.** Den står i
  `fristil-tema`.

## 0.21.0 (2026-09-28)

### Lagt til

- **Folketelling over attributter bare morferen leser.** `fs.browser.test.ts`
  kaller hver byggefunksjon og krever at `data-ignore-morph` kommer ut fra
  nøyaktig `connectionStatus`, `sessionTimeout`, `suggestion` og `toast`, og at
  `data-preserve-attr` ikke kommer ut fra noen. Vakten feller både et nytt
  sted attributtet dukker opp og et sted det forsvinner fra, siden begge
  endrer hva malen må skrive. Hjelperen i `morfing.browser.test.ts` hopper
  over attributter som står i en fredningsliste, slik den ekte løkka gjør. Står
  et navn der, fjerner løkka ingenting for nettopp det attributtet, og testen
  etterprøver ingenting. Noen av fixturene bygges av byggefunksjonene, og der
  feller folketellingen. Andre er skrevet for hånd, som en Go-mal ville gjort,
  og der feller en ny påstand i hjelperen om at lista er tom.

### Rettet

- **`<fs-field>` leter ikke lenger etter `data-role` på hjelpetekst og
  feilmelding.** Komponenten leste `[data-role='help']` og
  `[data-role='error']` ved siden av klassene `fs-help-text` og
  `fs-error-text`. Kroken sto bare i en `querySelector` i kilden, uten tester
  og uten omtale noe sted, så ingen kunne bygge på den med vilje. `data-role`
  er uprefikset og eies i praksis av andre, og en app som brukte det til noe
  annet inne i et felt fikk sitt eget avsnitt adoptert som feilmelding, uten at
  noe sa fra. Komponentsiden sier nå hva komponenten faktisk krever, og en test
  holder fjerningen på plass.

  Fjerningen er ingen brytende endring etter reglene øverst. Ingen
  byggefunksjon skrev attributtet og ingen komponent satte det, så ingenting i
  konsumentens markup endrer betydning: den virker som før, den blir bare ikke
  koblet.

- **Dokumentasjonen påsto mer enn den kunne vise.** «Holder markupen der,
  holder den overalt» var en påstand om alle morfere, mens vi kjører løkka til
  én. Kravet står nå slik det er: det en komponent har satt, skal overleve at
  attributter blir fjernet fra et element som består. Og `data-preserve-attr`
  og `data-ignore-morph` er beskrevet som morferens egne attributtnavn, siden
  et `data-*`-attributt bare betyr noe for koden som leser det.

- **«To komponenter eier sitt eget innhold» var tre.** `<fs-toast>` sto ikke i
  lista i «Markup og oppførsel», og at `fs.suggestion()` setter
  `data-ignore-morph` på statusområdet sto bare på komponentsiden, ikke der
  regelen forklares.

- **`overta` sa ingenting om tilgjengelighetsansvaret.** Siden om tilpasning
  sier nå at en overtatt og endret komponent ikke dekkes av en
  tilgjengelighetserklæring som viser til designsystemet.

## 0.20.0 (2026-09-28)

### Lagt til

- **`fristil agent` og regelbøkene i `agent/`.** Seks regelbøker skrevet for
  kodeagenter som Claude Code og GitHub Copilot, én per miljø: `html`, `maler`,
  `bundles`, `react`, `astro` og `datastar`. Hver er komplett for sitt miljø og
  nevner ingen andre, siden en agent som leser om `className` i et prosjekt med
  Go-maler er en agent som skriver `className` i en Go-mal. Vue, Svelte, Solid
  og Lit deler `bundles`, og `--rammeverk=svelte` peker dit.

  Hver fil har de fire feilene en agent gjør oftest øverst: glemt stilark,
  oppfunne komponenter og varianter, hardkodede farger og bommet registrering.
  Så følger alle komponentene med klasse, element, attributter og lovlige
  verdier, tokenlagene, de tre reglene for web components, og sjekken som
  retteløkke. Kommandoen leser miljøet av `package.json`, og `--rammeverk=<navn>`
  overstyrer.

  Kommandoen skriver aldri en fil. `AGENTS.md`, `CLAUDE.md` og
  `.github/copilot-instructions.md` er konsumentens egne, og et verktøy som
  skriver i dem må gjette stier, flette med innhold det ikke har skrevet, og
  holde en kopi i takt med pakken. Regelboka blir derfor stående i pakken, på
  `node_modules/@fristil/designsystem/agent/<navn>.md`, og følger versjonen.
  Mappa er med i tarballen.

  De samme filene ligger også på dokumentasjonssiden, på `/llms.txt` og
  `/agent/<navn>.md`. Den viktigste agenten har ingen `node_modules`: blir noen
  bedt om å lage et skjema med Fristil i en tom mappe, skrives markupen før
  `npm install` har kjørt.

  Filene genereres av `scripts/generate-agent.ts`, og `scripts/sjekk-agent.ts`
  feller hvis de er utdaterte, hvis en komponent mangler i en av dem, hvis et
  markupeksempel ikke tåler `diagnoseMarkup`, hvis en importsti ikke finnes i
  `exports`, hvis et tokennavn ikke finnes, eller hvis en `html`-blokk
  importerer et pakkenavn der nettleseren trenger en URL.

### Rettet

- **Versjonen i dokumentasjonens CDN-adresser kom fra 74 hardkodede steder.**
  `prepare-version` skrev dem om ved hver utgivelse, men et omskrivingssteg må
  finne den gamle versjonen for å bytte den, så en adresse som hadde glidd ble
  stående og pekte på en eldre pakke enn teksten rundt beskrev. Kilden har nå
  plassholderen `@fristil/designsystem@VERSJON`, og `remark-versjon.mjs` setter
  inn versjonen fra `package.json` når siden bygges. Omskrivingssteget er
  fjernet, og fire vaktposter passer på: tre på at kilden bruker plassholderen,
  og `sjekk-bygget-versjon.ts` på at den faktisk ble byttet ut i det bygde
  resultatet.

- **To kodeeksempler i dokumentasjonen importerte et pakkenavn i nettleseren.**
  Datastar-sporet på [Rammeverk](https://fristil.netlify.app/rammeverk/) og
  dialogen på
  [Bekreft en handling](https://fristil.netlify.app/monster/bekreftelse/) hadde
  `import … from "@fristil/designsystem/field"` i en `<script type="module">`.
  Ingen av sidene har et byggesteg, og en nettleser slår ikke opp et pakkenavn
  uten byggesteg eller importmap, så koden feilet stille for den som limte den
  inn. Begge bruker nå hele URL-en.

  Regelen fantes i `sjekk-oppskrifter.ts`, men den leser bare komponentsidene
  og velger regel ut fra navnet på fanen, så de to sto med feilen i flere
  runder. `sjekk-nettleserimport.ts` dekker nå alle sidene uavhengig av fane:
  en `html`-blokk er markup for nettleseren uansett hvor den står.

## 0.19.0 (2026-09-28)

### Lagt til

- **`maxChroma` i temageneratoren, og `--maks-metning` på kommandolinja.**
  Taket på metningen i de kulørte skalaene har stått fast på 0,16 i OKLCH. De
  fleste merkefarger ligger under det, men neon gjør ikke: `#39ff14` ligger på
  0,286 og mistet 44 prosent mot taket, `#ff2d6f` på 0,240 og mistet 33. Taket
  kan nå settes, i `buildTheme({ maxChroma })`, med `--maks-metning` på
  kommandolinja, eller som `maksMetning` i en oppskriftsfil. Standarden er den
  samme som før, så et tema som ikke oppgir noe kommer ut likt.

  Kontrastkravet berøres ikke. Taket styrer metning, mens kontrasten kommer av
  de faste lyshetene i skalaen og av passet som måler hvert par etterpå og
  flytter lysheten. Mer metning gir flere slike justeringer, ikke en svakere
  garanti, og et merke med hevet tak kjøres nå gjennom hele listen av par i
  `theme.browser.test.ts`. Den nøytrale skalaen har sitt eget, mye lavere tak,
  og er uendret.

  Oppskriftsfila sier nå fra om en ukjent toppnøkkel, slik dokumentasjonen
  alltid har lovet. En fil som har stått med en skrivefeil og virket, stopper
  derfor nå. `$schema` er fortsatt lovlig: editorer skriver den inn av seg selv,
  og den sier ingenting om temaet. En fil som er gyldig JSON, men ikke et
  objekt, får også en forklaring framfor et stakkspor fra Node.

  `buildTheme` avviser et tak utenfor 0,01 til 0,33. Et negativt tak speilet
  fargen og gjorde knallgrønt til magenta, `NaN` ga en feilmelding om en
  heksadesimal farge som aldri var oppgitt, og 0 ga et helt grått tema, alle
  tre i stillhet.

## 0.18.0 (2026-09-27)

### Lagt til

- **`fristil sjekk <fil…>` og `@fristil/designsystem/diagnostics`.** Sjekken
  editorutvidelsen kjører mens du skriver, elementer som ikke finnes,
  attributter elementet ikke har, verdier utenfor lista, klasser som
  `fs-buton` og `<fs-field>` uten kontroll, ligger nå i pakken.
  Kommandolinjen leser filer eller standard inn og skriver hvert funn som
  `fil:linje:kolonne: melding`, med feilkode ved funn. `diagnoseMarkup(html)`
  er den samme sjekken som funksjon, for en test i appen som kjører den over
  HTML-en serveren faktisk sender, der det ikke finnes noen malfil å sjekke.
  Editorutvidelsen importerer nå diagnostikken fra pakken, og listene den
  sjekker mot genereres inn i pakken som `elements.ts` og `classes.ts`.
- **`<fs-popover>`, `<fs-suggestion>` og `<fs-dialog>` kobler fra bar
  struktur,** som fanene og feiloppsummeringen. En knapp og et panel med
  klassen `fs-popover` er nok: komponenten setter `popover="manual"`, lager
  id-en og skriver `aria-controls` på knappen, ellers den første knappen
  utenfor panelet som ikke peker på noe annet. En `<label>`, et `<input>`,
  en `.fs-suggestion__list` med `<li>` og et statuselement er nok for
  forslagsfeltet: komponenten setter rollene, lager id-ene, skriver `for`
  og `aria-controls`, og holder lista lukket til brukeren rører feltet.
  Dialogen får klassen, og navnet sitt fra den første overskriften når den
  ikke alt har et fra `aria-labelledby` eller `aria-label`, med en id
  komponenten lager om den mangler; peker `aria-labelledby` på en overskrift,
  er det den som får tittelklassen. Bare det som mangler skrives,
  `suggestion.css` holder en bar liste skjult til komponenten er
  registrert, og advarslene sier hva som faktisk mangler.
  `derivedParts` og `uniqueId` i `/host-element` er hjelperne bak.
- **`<fs-tabs>` og `<fs-error-summary>` kobler fra bar struktur.** En
  `.fs-tabs__list` med knapper og ett `.fs-tabs__panel` per knapp er nok:
  komponenten setter rollene, lager id-ene, kobler `aria-controls` og
  `aria-labelledby`, og skjuler panelene som ikke er valgt. Valget leses fra
  `aria-selected`, ellers fra hvilket panel som ikke er `hidden`.
  Feiloppsummeringen får klassen, `role="alert"` og `tabindex="-1"`, og
  overskriften klassen sin. Det serveren har skrevet står, og det
  komponenten fylte inn settes tilbake etter en patch, med de samme id-ene.
  `tabs.css` viser bare det første synlige panelet til komponenten er
  registrert, så innholdet ikke hopper. Kotlin-malen i spilldemoen skrev sju
  attributter per fane for hånd. `fs.tabs()` og `fs.errorSummary()` er som
  før, for markup som lages med JavaScript.

  To ting endrer seg for markup som alt fantes. Under `server-controlled`
  setter fanene fortsatt ikke brukerens valg tilbake, men skriver nå ut det
  markupen sier: `aria-selected`, tabbestoppet og `hidden` i takt, så en
  patch som bare rørte panelene flytter også markeringen. Det komponenten
  selv skrev teller ikke som markupens svar. Og advarselen om manglende
  `tabindex` på feiloppsummeringen er borte, siden komponenten setter den.
- **`@fristil/designsystem/register`: `defineFs()` registrerer alle ni
  web-komponentene i ett kall,** også fra `dist/register.js` på en CDN.
  Spilldemoen sto med sju `defineFs*`-kall i en `useEffect`, altså etter
  første tegning, og den første meldingen fra hendelsesstrømmen kom i gapet:
  «reportSuccess is not a function». Dokumentasjonen sier nå: registrer ved
  import, aldri i en effekt.
- **De frittstående komponentene har funksjoner som venter på
  registreringen:** `showToast(element, tekst, valg)`,
  `reportFailure(element)`, `reportSuccess(element)`,
  `extendSession(element)` og `resetSession(element)`. De venter på
  `customElements.whenDefined` for elementets tagnavn og kaller så metoden,
  så et kall som kommer for tidlig blir gjort i stedet for å feile. Et
  element ingen registrerer gir en advarsel i konsollen etter tre sekunder.
  `whenUpgraded(element)` i `/host-element` er hjelperen bak dem.
- **`@fristil/designsystem/fristil.css`: alle stilarkene i én fil.** For den
  som lenker fra CDN eller `node_modules` uten byggesteg. De enkelte stilarkene
  henter delene sine med `@import`, som nettleseren først ser når fila er
  lastet, og på mobilnett sto feltene uten ramme til den andre runden kom;
  spilldemoen forhåndslastet fem filer for hånd for å komme rundt det. Fila
  bygges av CSS-oppføringene i `exports`, med `tokens.css` først, uten
  `@import` og uten kommentarer. Et byggesteg bruker de enkelte stilarkene som
  før. Tailwind-temaet er ikke med, siden det ikke er et stilark for en side.
- **Dialogen kan ha en farget topp.** `fs.dialog({ color })` gir `data-color`
  på dialogen og en ny `header`-del som pakker overskriften, med en valgfri
  `subtitle` under. Fargene er varslerens, `info`, `success`, `warning` og
  `danger`, og `brand` for merkefargen. Med toppen i markupen flyttes luften
  fra dialogen til delene, så båndet går helt ut i kantene; uten den står
  dialogen som før. To dialoger i spilldemoen skrev om padding på tre
  klasser for å få til dette, og det brakk ved en oppgradering.
  `fs.dialog.colors` og `fs.dialog.isColor` lister og sjekker verdiene.

## 0.17.0 (2026-09-27)

### Brytende

- **`idEllerReserve` heter `idOrFallback`.** Hjelperen i `@fristil/designsystem/shared`
  var den siste eksporterte identifikatoren på norsk, og identifikatorer i
  pakken skal være engelske. Ingen alias: pakken har ingen konsumenter ennå,
  og en brytende endring gjøres én gang. Parameteren `oppgittId` i
  byggefunksjonene heter `givenId`; den er intern.

## 0.16.0 (2026-09-27)

### Lagt til

- **`reset()` på `<fs-session-timeout>`** nullstiller klokka uten å sende
  `session-extend`, for en app som alt har forlenget økten selv, som når en
  autolagring gikk gjennom.
- **`--fs-toast-layer`** styrer `z-index` på varselregionen, med `60` som
  reserve.
- **`isToastColor`** eksporteres ved siden av `toastColors`.
- **`fs.popover()` tar `placement`.** `fs.popover.isPlacement` sjekker en
  verdi, også i `/react`, og `popoverPlacements` fra hovedinngangen lister
  dem, med typen `PopoverPlacement`. Før måtte attributtet skrives for hånd
  uten typesjekk.
- **`--fs-suggestion-layer`** styrer `z-index` på forslagslista, med `30`
  som reserve.

### Rettet

- **Escape i `<fs-session-timeout>` forlenger, og dialogen kommer ikke
  tilbake.** Komponenten lyttet ikke på `close`, så neste tikk så en lukket
  dialog etter varselgrensen og åpnet den igjen, ett sekund etter Escape,
  hver gang, med en ny `session-warn`. Escape regnes nå som «jeg er her» og
  gjør det samme som knappen.
- **Skjermleseren får vite hvor lenge det er igjen i det varselet åpnes.**
  Tallet i avsnittet er `aria-hidden`, og live-området ble fylt først ved
  neste terskel, så med standardverdiene hørte skjermleseren «Vi logger deg
  ut om  for å beskytte opplysningene dine», og første tall kom tre minutter
  senere.
- **`<fs-session-timeout>` står stille etter utløpet og etter «Logg ut nå»**
  til `extend()` eller `reset()` kalles. Før startet syklusen på nytt av seg
  selv, med ny dialog og ny `session-expired` hvert `expires-at`-sekund, og
  en app som brukte mer enn ett sekund på utloggingen fikk dialogen tilbake.
- **`warn-at` og `expires-at` sjekkes.** Et tall som ikke er et tall, eller
  et varsel som ikke kommer før utløpet, gir beskjed i konsollen framfor
  stillhet. `warnAt` og `expiresAt` har fått settere, rulling i en boks
  teller som aktivitet, og hver forekomst har sin egen overskrift-id.
- **Pausen i `<fs-toast>` holder til både musa og fokus har forlatt
  meldingen.** Den var to uavhengige par, og musa som gikk ut startet klokka
  igjen mens fokus sto i meldingen, som så forsvant under brukeren.
- **`dismiss()` flytter fokus til meldingen ved siden av** når meldingen som
  lukkes hadde fokus. Før falt fokus til `body`, og neste Tab startet øverst
  på siden.
- **Varselregionen er `aria-atomic="false"`**, både fra `fs.toast()` og fra
  komponenten. `status` er atomisk som standard, og hele stabelen ble lest
  opp på nytt for hver ny melding.
- **Regionen heter «Varsler» begge steder.** Komponenten sa «Meldinger» når
  attributtet manglet, `fs.toast()` sa «Varsler». Et tomt `duration` gir
  standardverdien framfor null, og en ukjent `color` gir ingen kant.
- **`<fs-connection-status>` melder `connection-lost` én gang per utfall.**
  Nettlesere fyrer gjerne flere `offline` på rad, og hver ga en ny hendelse
  og en ny opplesning av den samme linja. Linja settes nå inn tom og fylles
  i neste tegning, slik at live-området finnes før innholdet kommer.
  `offlineText` og `onlineText` har fått settere.
- **`<fs-suggestion>` lukker lista når fokus forlater komponenten.** Tab
  gikk videre til neste felt, og lista ble stående over det med
  `aria-expanded="true"` på et felt som ikke lenger hadde fokus. Lytteren på
  `document` er borte: et trykk i lista holder fokus i feltet, fokus på noe
  inne i komponenten lar lista stå, og alt utenfor lukker den. Dermed virker
  feltet også inne i en skyggerot, der klikket i
  feltet før ble regnet som et klikk utenfor og lukket lista i samme klikk
  som åpnet den.
- **«Ingen treff» følger lista.** Meldingen er søsken til lista og ble
  stående synlig under et lukket felt etter Escape. `fs.suggestion()` skriver
  den også skjult på et lukket felt uten alternativer, som er det anbefalte
  oppsettet for asynkront søk; før sto meldingen der alt ved sidelasting.
- **Markeringen ryddes i det alternativet filtreres bort**, også med
  `server-controlled`. Før pekte `aria-activedescendant` på et skjult
  alternativ, og skjermleseren leste det opp.
- **Alternativene kjennes igjen på `role="option"`**, ikke på klassen. En mal
  med egen styling fikk verken filtrering eller piltaster, uten et ord.
- **`<fs-suggestion>` sier fra når `[role="status"]` mangler.** Antall treff
  leses opp der, og uten elementet sto komponenten stille.
- **`fs.suggestion()` skriver `aria-selected` og `aria-activedescendant`
  under samme vilkår**, altså bare når lista er åpen. Før fikk en lukket
  liste det ene uten det andre.
- **Det markerte alternativet vises i høykontrastmodus**, med systemfargene.
- **`<fs-popover>` står på riktig side i `dir="rtl"`.** Posisjonen er
  fysisk, men stilarket brukte den som `inset-inline-start`, som er høyre
  kant i en side som leses fra høyre. `start` og `end` i `placement` følger
  nå leseretningen.
- **`top-start` og `top-end` klemmes inn i vinduet.** Et panel ved toppen av
  siden lå helt utenfor skjermen, uten å kunne rulles fram. Er det ikke
  plass på den siden plasseringen ber om, legges panelet på den andre.
- **Verten følger med når nettleseren selv lukker et `popover="auto"`.**
  Håndskrevet markup med bare `popover` er `auto`, og etter en lett
  avvisning sto verten med `open` og knappen med `aria-expanded="true"`
  over et lukket panel. Komponenten lytter nå på `toggle`.
- **Klikk utenfor et sprettoppvindu i en skyggerot** leser
  `composedPath()`, så et klikk i panelet ikke regnes som utenfor.
- **`<fs-dialog server-controlled>` lukker når patchen tar `open` fra en
  modal dialog.** Reparasjonen var slått av, men ingen kalte `close()`, og
  dialogen sto igjen i topplaget med `display: none` mens resten av siden
  var inert.
- **`<fs-tabs>` hopper over deaktiverte faner.** Piltastene, Home og End
  valgte en fane med `disabled`, `focus()` på en deaktivert knapp gjør
  ingenting, og raden sto uten en eneste fane som kunne få fokus.
  Tastaturbrukeren var låst ute. `select()` avviser dem også.
- **Faner i faner er hver sin rad.** Komponenten fant faner og paneler i hele
  undertreet, så et klikk på en indre fane skjulte det ytre panelet den sto i.
- **Panelet finnes gjennom `aria-controls`.** Koblingen står i markupen og
  leses derfra, med rekkefølgen som reserve bare for markup uten
  `aria-controls`. Panelene kan dermed stå i en annen rekkefølge enn fanene,
  og utenfor verten. Peker `aria-controls` på en id som ikke finnes, sier
  komponenten fra i konsollen. Peker to faner på det samme panelet, vises
  det når en av dem er valgt.
- **Tabbestoppet flyttes når en patch deaktiverer fanen brukeren valgte**,
  til den neste fanen som kan få fokus. Valget står. Har brukeren ikke valgt
  noe, er markupen serverens, og komponenten rører den ikke.
- **Venstre og høyre pil bytter retning i `dir="rtl"`.**
- **`selected` på `<fs-tabs>` kan settes.** Getteren sto uten setter, og
  `faner.selected = 1`, som dokumentasjonen viste, kastet.
- **`fs.tabs()` med negativt `count` gir en tom rad** framfor å kaste.
- **`<fs-error-summary>` prøver igjen når fokus ikke landet.** Sto boksen i et
  skjult panel eller en lukket dialog i det den kom, feilet `focus()` i
  stillhet mens flagget «har flyttet fokus» ble satt, og boksen fikk aldri
  fokus da forelderen ble synlig og lista byttet ut. Gjenforsøket skjer bare
  når ingen står i et felt, så live-validering som patcher lista ikke river
  fokus ut av feltet brukeren retter i.
- **En lenke til en `<label>` uten kontroll følger `for`** dit den peker,
  som til en gruppe.
- **`<fs-error-summary>` sier fra når `tabindex` mangler.** Uten det gjør
  `focus()` ingenting, og hele grunnen til komponenten forsvant i stillhet.
- **En lenke til en `<label>` som omslutter kontrollen** sender fokus til
  kontrollen, ikke til ledeteksten.
- **Rullingen til feltet følger sidens `scroll-behavior`** framfor å tvinge
  `smooth`, så `prefers-reduced-motion` gjelder av seg selv.
- **`<fs-field>` eier bare det den selv skrev.** Komponenten leser
  `aria-invalid`, `aria-describedby` og `disabled` fra kontrollen, fordi
  serveren kan ha skrevet feltet med `fs.field()`. Skillet mellom serverens
  ord og komponentens eget ekko fantes bare for `aria-invalid`, og de to
  andre hadde samme feil: `aria-describedby` pekte fortsatt på feilmeldingen
  etter at feltet var gyldig, og på en hjelpetekst en patch hadde fjernet, og
  `felt.disabled = false` slo ikke av et `disabled` komponenten selv hadde
  satt. Minnet er nå nøklet på kontrollen og overlever at feltet flyttes,
  slik React gjør ved en omstrukturering, og at kontrollen forsvinner og
  kommer tilbake i en patch. Id-er serveren selv la i `aria-describedby` blir
  med videre.
- **Ingen `aria-disabled` på kontrollen.** Komponenten skrev det ved siden av
  `disabled`, og strøk samtidig et `aria-disabled` konsumenten selv hadde
  skrevet. `computeFieldAttributes` er kontrakten, og den skriver det bare på
  ledeteksten; et ekte `disabled` er alt synlig for hjelpemidlene.
- **Serverens `aria-invalid` står ordrett når det er serveren som sier feltet
  er ugyldig.** `false` er gyldig og vanlig i håndskrevet HTML, og ble strøket
  ved hver patch. `grammar` og `spelling` betyr ugyldig, men ble lest som
  «ikke true» og strøket på samme måte. Tom streng leses som `false`, slik
  ARIA sier.
- **`requiredMarker` som egenskap betyr det samme som attributtet.** Setteren
  skriver `"none"` bokstavelig, siden `required-marker="none"` overstyrer en
  `data-required` serveren skrev på ledeteksten. Før fjernet setteren
  attributtet, og markeringen kom tilbake fra ledeteksten. Getteren leser nå
  markupen, ledeteksten medregnet, framfor bare sitt eget attributt.

## 0.15.0 (2026-09-26)

- **`web-types.json` følger med pakken.** Det er JetBrains sitt format for
  fullføring og forklaring i HTML, med de ni `<fs-*>`-elementene og
  attributtene deres. IDE-en finner den selv fra `node_modules`, gjennom
  feltet `web-types` i `package.json`. Etterprøvd i IntelliJ IDEA Ultimate 2026.2:
  fullføring av elementene, attributtene og verdiene, og forklaring med
  lenke. Fila genereres fra `editor/metadata.ts` i repoet, der
  VS Code-utvidelsen også lages.
- `observedAttributes` på komponentklassene er nå skrivebeskyttede tupler
  (`as const`) i stedet for `string[]`. Verdiene er de samme. En klasse som
  arver fra en komponent og skriver over `observedAttributes` med `string[]`
  får en typefeil, og må bruke `as const` den også.

## 0.14.0 (2026-09-24)

### Brytende

- **Verten heter `host` i alle byggefunksjonene.** Den delen serveren skriver,
  og komponenten fester seg på, het tre ting: `host` i `fs.dialog()` og
  `fs.popover()`, `region` i `fs.toast()` og `container` i `fs.errorSummary()`.
  Tre ord for den samme tingen, og to av dem sa ikke hva den var. De heter nå
  `host`, som er ordet arkitekturen bruker om den ellers.

  `fs.connectionStatus()` og `fs.sessionTimeout()` er urørt. De har bare én
  del, og returnerer attributtene flatt, slik `fs.button()` gjør. Nøkkelen
  finnes der verten selv bærer attributter. `fs.field()`, `fs.tabs()` og
  `fs.suggestion()` har mange deler og ingen `host`, fordi verten deres
  ikke har noe å bære.

  ```diff
  - <fs-toast {...varsler.region} />
  + <fs-toast {...varsler.host} />
  - <fs-error-summary {...feil.container}>
  + <fs-error-summary {...feil.host}>
  ```

### Lagt til

- **`setAttributes` tar `null`.** `document.querySelector()` gir
  `Element | null`, så hvert eneste kallsted i en `strict`-app måtte skrive en
  vakt eller et utropstegn rundt et oppslag som nesten alltid treffer. Den gjør
  nå ingenting på `null`, som `element?.classList`. Parameteren er utvidet, så
  ingen kallsteder brytes.

### Rettet

- **Panelet i `<fs-popover>` nullstiller lista.** Panelet er ofte en `<ul>`
  med handlinger, og `.fs-popover` hadde ingen `list-style`. Markupen i
  dokumentasjonen skrev `data-variant="plain"` for å bøte på det, men det
  attributtet finnes bare på `.fs-list` og traff ingen regel, så panelet sto
  med nettleserens kuler. Nullstillingen hører i pakken og ikke
  hos konsumenten.

- **`ref` virker på de egendefinerte elementene i JSX.** Typene bygget på
  `HTMLAttributes`, som ikke har `ref`; den ligger i `RefAttributes`. Derfor
  var `<fs-toast ref={kø} />` en typefeil, altså nøyaktig mønsteret
  dokumentasjonen anbefaler for å kalle `.show()` og `.hide()` fra React. Alle
  vertene bygger nå på en felles `Host`-type som har begge.

- **`warn-at` og `expires-at` godtar det byggefunksjonen sender.** De sto som
  `number` i JSX-typene, mens `fs.sessionTimeout()` sender strenger, slik
  HTML-attributter er. Det er den samme feilen som `tabIndex: "0"`, motsatt
  vei, og den viste seg bare i en ekte React-app.

- **`fs.connectionStatus()` og `fs.sessionTimeout()` reklamerte med en død
  klasse.** Begge sender ut `fs-connection-status` og `fs-session-timeout`,
  men stilarkene stylet bare elementnavnet, så klassen gjorde ingenting. Nå
  treffer regelen begge, og en konsument som setter klassen på noe annet enn
  elementet får den samme oppførselen.

## 0.13.0 (2026-09-24)

### Brytende

- **`.fs-dialog` er en kolonne når `.fs-dialog__body` er et direkte barn.**
  Det er rettelsen under, men den endrer hvordan innholdet legger seg for
  markup som alt finnes, og det er den strukturen dokumentasjonen viser. Marger
  mellom avsnitt slutter å falle sammen, og tekst og knapper som står rett i
  dialogen ved siden av kroppen blir egne rader i full bredde. En dialog uten
  `.fs-dialog__body` er urørt.

- **`display` kan ikke lenger settes alene på `.fs-dialog`.** En `<dialog>`
  uten `open` skjules av nettleserens eget stilark, og lagene sorterer bare
  innenfor ett opphav, så en hvilken som helst forfatterregel med `display`
  slår den skjulingen. Setter du din egen, må du ta med
  `dialog.fs-dialog:not([open]):not(:is(:popover-open)) { display: none }`,
  minst like spesifikk som din egen regel. Det står på komponentsiden og på
  siden om tilpasning. Dette er det eneste unntaket fra løftet om at en enkel
  selektor slår hva som helst i pakken.

### Rettet

- **Dialogen hopper heller ikke sidelengs.** 0.12.1 ga den plassen til en
  modal før den var det, og det loddrette hoppet var borte. Et vannrett kom i
  stedet: nettleserens eget stilark setter `max-width: calc(100% - 6px - 2em)`
  på `dialog:modal`, og det hadde vi ikke. På en skjerm som er 390 piksler
  bred gikk dialogen derfor fra 358 til 352 piksler i det `showModal()` kjørte,
  og flyttet seg tre piksler mot høyre.

  `.fs-dialog[open]:not(:modal)` inne i `<fs-dialog>` bruker nå `inset: 0` med
  `margin: auto`, det samme maksmålet på bredden og `overflow: auto`, altså de
  samme verdiene spesifikasjonen gir en modal, i logisk form. Maksmålet på
  høyden står med vilje bare på `.fs-dialog`, siden det er det strengeste av
  de to og dermed gjelder i begge tilstandene. Testen leser boksen før og
  etter `showModal()`, med to slags innhold, og krever at den står stille.

- **`.fs-dialog__body` ruller nå faktisk.** Klassen har hatt `overflow-y: auto`
  siden komponenten kom, uten at den kunne gjøre noe: dialogen var en blokk, så
  kroppens høyde var innholdsbestemt og ble aldri klippet. Det som rullet var
  dialogen selv, og bare når den var modal, så overskriften og knapperaden
  forsvant ut av syne sammen med teksten. `.fs-dialog:has(> .fs-dialog__body)`
  er nå en kolonne, og da krymper kroppen og ruller mens tittelen og knappene
  blir stående. Det er også det dokumentasjonen har sagt hele tiden.

  Regelen tar samtidig tilbake det den tok: en `<dialog>` uten `open` er skjult
  av nettleserens eget stilark, og en forfatterregel med `display` slår den
  uansett lag og spesifisitet. `dialog.fs-dialog:not([open]):not(:popover-open)`
  setter `display: none` igjen, ellers ville en lukket dialog stått som et kort
  oppå innholdet rundt, fra sidelasting og etter hver lukking. Unntaket for
  popover står der spesifikasjonens eget stilark har det, siden en popover
  aldri setter `open`.

  **Det gjør `display` til den ene egenskapen en konsument ikke kan sette fritt
  på `.fs-dialog`.** Gjør du det, må du ta den skjulte tilstanden tilbake selv.
  Det står nå på komponentsiden.

  Vilkåret i selektoren er en del av oppførselen, og står nå i tabellen over
  klassene. Kolonnen virker bare når kroppen er et direkte barn, og den endrer
  samtidig hvordan alt annet legger seg: marger mellom avsnitt slutter å falle
  sammen, og tekst og knapper som står rett i dialogen blir egne rader i full
  bredde. En dialog uten kropp er derfor urørt.

## 0.12.1 (2026-09-24)

### Rettet

- **Dialogen hopper ikke lenger på plass.** En dialog serveren vil vise sendes
  med `open`, ellers finnes ikke innholdet uten JavaScript, og nettleseren
  legger den da i den vanlige flyten. Først når komponenten kaller
  `showModal()` flyttes den til topplaget og midtstilles, og mellom de to
  øyeblikkene hopper den. På en treg forbindelse er hoppet godt synlig:
  testet i Chromium sto dialogen på topp 0 og landet på topp 128, og det ble
  meldt fra en telefon.

  `.fs-dialog[open]:not(:modal)` inne i `<fs-dialog>` plasseres nå som en
  modal allerede før den er det, med flaten bak malt av en skygge, siden
  `::backdrop` bare finnes i topplaget. Laget kan settes med
  `--fs-dialog-layer`, som er 40 i utgangspunktet.

  Regelen gjelder bare inne i verten. En `.fs-dialog` som brukes uten
  komponenten, og med vilje ikke er modal, står der den står.

## 0.12.0 (2026-09-24)

### Brytende

- **`ThemeInput` er en union.** Merkefargene kan utelates, men da skal ingen av
  dem stå: enten alle fire, eller ingen. Vilkåret står i typen og ikke bare som
  en feilmelding i kjøretid, så `buildTheme({ interactive, danger })` er en
  typefeil. En konsument som leste `input.interactive` fra en variabel av typen
  `ThemeInput`, må nå skille de to tilfellene. Meldingen i kjøretid står ved
  siden av, for oppskriften kan komme fra en JSON-fil eller et skript uten
  typer.

### Lagt til

- **Temageneratoren kan også sette skrift og form.** Den bygget fargene, og
  bare dem, og to systemer med den samme paletten ser fortsatt ulike ut når
  skriften og hjørnene er ulike. `buildTheme()` tar nå to valgfrie blokker,
  `typography` og `shape`. Seks av verdiene finnes også som flagg: `--skrift`,
  `--knapp-hjorner`, `--felt-hjorner`, `--flate-hjorner`, `--knapp-ramme` og
  `--knapp-vekt`. Vektene og linjeavstandene settes fra fil. Utelates begge
  blokkene, er temaet nøyaktig det det var før.

  Hjørnene er delt i tre framfor ett felles tall, fordi ett tall er feil:
  et annet norsk designsystem har helt runde knapper mens feltene har nesten
  rette hjørner, og med én verdi blir feltene kapsler. `buttonRadius` treffer knapp,
  paginering og hopplenke, `fieldRadius` felt, tekstområde og nedtrekksliste,
  og `surfaceRadius` de elleve flatene, meldingen og hjelpeboblen medregnet.
  Avkryssingsboksen, merket, etiketten, valggruppa, avataren og skjelettet
  står utenfor, fordi hjørnet der ikke er et stilvalg, men selve formen.

  Skriften skrives som en ekte regel på `:root` og ikke bare som et token.
  Fristil arver skrift med vilje, så et token alene ville ikke endret én
  eneste bokstav.

- **Den genererte fila ligger i sitt eget lag,** `fristil-tema`, erklært etter
  `fristil` med `@layer fristil, fristil-tema;`. Den lå i `@layer fristil`
  først, og da avgjorde rekkefølgen stilarkene ble lastet i. Den rekkefølgen
  har konsumenten ikke alltid i hånda: både Astro og TanStack Start legger sin
  bundlede CSS inn rett før `</head>`, altså etter en `<link>` appen selv har
  skrevet, og temaet tapte da mot pakkens egne verdier. Begge lagene ligger
  fortsatt foran usortert CSS, så konsumentens egne regler vinner som før.

- **Et tema kan la fargene stå.** Merkefargene er nå valgfrie, og utelates
  alle fire, lages et tema som bare setter skrift og form. Det er ikke en
  kuriositet: bruker organisasjonen allerede Fristils palett, er det nettopp
  skriften og hjørnene som skiller, og å kjøre fargene gjennom generatoren
  ville flyttet dem bort fra der de skal være. `#1362ae` kommer ut som
  `#1e6ab7`, siden skalaene regnes om i OKLCH fra merkefargen. Enten alle fire
  fargene, eller ingen: to farger kaster, siden resten av temaet da ville blitt
  bygget av standardfarger uten at noen ba om det. Se «Brytende» over for hva
  det gjorde med typen.

- **Verdier i et tema kan ikke bryte ut av regelen de skrives inn i.**
  Oppskriften er en JSON-fil som kan komme fra et annet repo eller fra et
  byggesteg, og `«4px; } html { display: none } :root { --x: 1` lukket både
  erklæringen og `:root`-blokka, og fikk en vilkårlig regel inn i
  `@layer fristil`. Tre veier til var åpne, og alle er etterprøvd i nettleser:
  `1px (` åpnet en parentes som slukte resten av stilarket, `Arial\` lot
  baksnabelen spise semikolonet, og `Arial</style><script>…` kjørte et skript i
  en side der CSS-en står inline. Verdier med `;`, `{`, `}`, `<`, `>`, `\`,
  `/*` eller styretegn avvises nå, parenteser og anførselstegn må gå opp, og
  meldingen navngir nøkkelen i oppskriften framfor variabelen vi skriver.

- **Et ukjent flagg eller en ukjent nøkkel stopper kjøringen** framfor å bli
  ignorert. `--knapp-hjørner` med ø er den naturlige norske stavemåten, mens
  flagget heter `hjorner`, og temaet kom før ut uten hjørnet og uten et ord.
  Det samme gjaldt en skrivefeil inne i oppskriftsfila, altså den som kan
  komme fra et annet repo.

- **Vekt og linjeavstand er tokens.** `--font-weight-regular`,
  `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold`,
  `--semantic-line-height-default`, `--semantic-line-height-heading`,
  `--semantic-line-height-article` og `--semantic-line-height-compact`.
  Verdiene er nøyaktig dem komponentene hadde skrevet ut fra før, så
  ingenting ser annerledes ut.

- **Trettisju stilark leser nå vekt og linjeavstand fra tokenene** framfor å
  skrive tallet. Verdiene er de samme, så ingenting ser annerledes ut, men uten
  dette ville `typography.weights` og `typography.lineHeights` i et tema truffet
  tre komponenter og ikke resten. Knappen, overskriften og avsnittet leser dem
  gjennom sin egen komponentvariabel, de andre leser tokenet direkte: en egen
  variabel per komponent er verdt det der man vil kunne skille dem, og støy der
  man ikke vil.

- **Seks nye komponentvariabler** der form sto skrevet ut i stilarket:
  `--fs-button-border-width`, `--fs-button-font-weight`,
  `--fs-button-line-height`, `--fs-heading-font-weight`,
  `--fs-heading-line-height` og `--fs-paragraph-line-height`. Regelen er at
  form og størrelse leses fra en komponentvariabel med tokenverdien som
  reserve, og disse tre komponentene brøt den.

## 0.11.0 (2026-09-23)

### Brytende

- **`server-filtered` heter `prefiltered`.** Navnet var misvisende på to
  måter. Det handler ikke om servere: en React-app som rendrer bare treffene
  har filtrert like fullt, uten at noen server er involvert. Og det handler
  ikke om hvem som filtrerte, men om hva de filtrerte på. Ingen konsumenter
  ennå, så navnet er byttet framfor å dokumenteres rundt.

- **`id` er påkrevd i `fs.field()`, og i de andre byggerne som tar en.** Den var valgfri, og funksjonen laget en
  når den manglet. Det var en felle: id-en er tilfeldig, så to kjøringer gir
  to ulike, og rendres det samme feltet på en server og så i nettleseren,
  peker `for` og `aria-describedby` på noe annet enn det som står der. React
  melder avvik ved hydreringen, og advarselen sier selv at avviket ikke blir
  rettet opp. Det er sett i en ekte app.

  Å kaste når `document` ikke finnes ble vurdert og forkastet: det er å slutte
  fra miljøet til hva utvikleren mente. `document === undefined` betyr bare
  «dette er ikke en nettleser», og en Astro-side rendres på serveren og
  hydrerer ingenting, så der er en laget id helt i orden.

  Typen alene er heller ikke nok, for en konsument uten TypeScript ser ingen
  type, og ren HTML med `<script type="module">` er en førsteklasses måte å
  bruke Fristil på. Utelates id-en likevel, lager byggeren en og sier fra i
  konsollen, én gang, med navnet på byggeren i meldingen. Uten den reserven
  fikk en JavaScript-konsument `aria-describedby="undefined-help"` og verken
  `for` eller `id`, altså verre enn den ustabile id-en kravet skulle bli
  kvitt.

  Reserven gjelder `fs.field()`, `fs.suggestion()`, `fs.tabs()`,
  `fs.popover()` og `fs.dialog()`. Forslagsfeltet er grunnen til at den ikke
  kunne bo i feltet alene: uten id ble `list.id` og `options[n].id` til
  `undefined-list` og `undefined-option-0`, mens meldingen sa «fs.field()» og
  sendte utvikleren til feil sted.

  Den tomme strengen teller som ingen id. `fs.field({ id: "" })` ga `for=""`
  og `help.id="-help"`, altså det samme problemet uten at noe sa fra.

  I React kommer id-en fra `useId()`. Ellers er feltets eget navn som regel
  det opplagte valget. Vet du sikkert at markupen rendres én gang, kall
  `createFieldId()` selv. Den er nå også eksportert fra
  `@fristil/designsystem/react`, siden det er inngangen React-dokumentasjonen
  ber deg bruke.

  `<fs-field>` er upåvirket når komponenten er det eneste som kobler feltet:
  den lager id-er i nettleseren, etter at HTML-en står der. Bruker du React
  med server-rendring, skal du bruke `fs.field()`, så koblingen står ferdig i
  markupen serveren sendte.

- **`createFieldId` eksporteres også fra `@fristil/designsystem/react`.** Den
  lå bare i hovedinngangen og i `./field-core`, mens dokumentasjonen peker på
  den i en seksjon som ber leseren importere fra `/react`.

### Rettet

- **Forslagsfeltet sluttet å melde antall treff når noen andre filtrerte.**
  `filter()` returnerte med en gang, så en app med attributtet mistet
  opplesningen i `[role="status"]`. Det sto ikke noe sted, og den som ikke
  ser skjermen merket det.

  Beskjeden kommer nå av at lista har endret seg, og ikke av tastetrykket.
  Med `prefiltered` rendrer appen lista, og mellom tastetrykket og det nye
  svaret kan det gå et halvt sekund over nettverket. Bare en endring i
  antallet leses opp; det første antallet er utgangspunktet og ikke en nyhet.

  Tommeldingen er derimot en del av det lista viser, og den eier du med
  `prefiltered`. `fs.suggestion({ count })` skriver `hidden` på den når du
  har treff, så rendrer du feltet for hvert søk, er det gjort. Komponenten
  kan ikke se forskjell på «søket ga ingenting» og «svaret er ikke kommet
  ennå», og meldte derfor «Ingen treff» ved fokus på et tomt felt og i hvert
  opphold i et asynkront søk.

- **`prefiltered` kunne ikke settes fra React.** Getteren hadde ingen setter,
  og React 19 skriver egenskapen framfor attributtet når et egendefinert
  element har en med det navnet. Skrivingen kastet «Cannot set property»,
  attributtet landet aldri, og komponenten skjulte det React nettopp hadde
  rendret. Det gamle navnet `server-filtered` kunne ikke være et
  egenskapsnavn, så feilen kom med omdøpingen.

- **`prefiltered` gjorde ingenting før neste tastetrykk.** Attributtet sto i
  `observedAttributes`, men tilbakekallet svarte bare på `server-controlled`.
  Slås det av mens siden lever, filtrerer komponenten nå med en gang.

### Lagt til

- **`sjekk-dokumentasjon.ts` avviser et eksempel som kaller `fs.field()` uten
  `id`.** Ingenting annet i rekka leser kodeblokkene i dokumentasjonen, så et
  utdatert eksempel kunne stått grønt gjennom hele `bun run sjekk`. Den leser
  koden: i mdx kodegjerdene, i Astro frontmatteret og skriptene. I brødtekst
  teller bare et kall som har en argumentliste, siden `fs.field()` uten
  argumenter er navnet på en funksjon og står slik i dusinvis av setninger.
  Det skillet måtte til: `fs.suggestion({ count: treff.length })` sto i en
  setning under et eksempel og slapp gjennom.

## 0.10.0 (2026-09-23)

### Brytende

- **`data-preserve-attr` er borte fra hele pakken.** `fs.tabs()`,
  `fs.popover()`, `fs.suggestion()` og `fs.dialog()` skriver det ikke lenger,
  og typene deres har ikke feltet. Skriver du markupen for hånd, kan du slette
  attributtet.

  Lista krevde at malen skrev av navnene på hvert attributt komponenten kom
  til å røre, ni strenger fordelt på fire komponenter, uten at noen
  kompilator så på dem. Endret Fristil hva en komponent satte, gikk malen
  stille i stykker. Komponentene setter nå tilbake det brukeren gjorde, og
  ingen mal trenger å kjenne attributtene.

### Lagt til

- **`server-controlled` på verten gir serveren tilstanden tilbake.** Det
  fredningen ga, og som reparasjonen måtte erstatte, er at den som skrev
  markupen kunne bestemme hvem som eier tilstanden. «Gå videre til steg 2» er
  en ekte ting en server vil kunne gjøre. Står attributtet der, reparerer
  komponenten ingenting, og hver patch bestemmer. Ett attributt å huske i
  stedet for ni, og standardvalget er det som er riktig nesten alltid. Gjelder
  `<fs-tabs>`, `<fs-popover>`, `<fs-suggestion>` og `<fs-dialog>`, og er
  deklarert for JSX på alle fire.

- **`setAttr`, `setFlag`, `setText`, `addClass`, `SERVER_CONTROLLED` og
  `isServerControlled` er nye eksporter** fra
  `@fristil/designsystem/host-element`. De fire første skriver bare når noe
  faktisk endrer seg, og er de eneste lovlige veiene til et attributt, et
  boolsk flagg, tekst og en klasse i en komponent som observerer sine egne. En
  overtatt komponent bruker dem.

- **`scripts/sjekk-skriving.ts` håndhever den regelen.** Den kjører som del av
  `build`, både i pakken og i rota, og leser kilden, fordi regelen ikke lar seg
  etterprøve ved å kjøre noe: bryter en komponent den, kaller observatøren seg
  selv, mikrooppgavekøen tømmes aldri, og en testkjøring **henger** framfor å
  feile. Ingen stakksporing, ingen påstand, bare en kjøring som må drepes for
  hånd.

  Den ser etter seks skrivemåter, ikke bare `setAttribute`: `el.hidden = x`,
  `el.tabIndex = n`, `el.htmlFor = s`, `el.textContent = s`,
  `classList.add()` og `el.style.cssText = s`. Alle gir en mutasjonspost når
  ingenting endrer seg, og fem av dem var i bruk. Verten er ikke et unntak:
  komponentene observerer seg selv, så `this.classList.add()` henger en
  kjøring like godt som en skriving på et barn.

- **`sjekk:server` kjøres nå også fra rota.** Den sto bare i pakkens egen
  `build`, så den kjørte ved publisering og ikke i CI, mens `CLAUDE.md` sa at
  den var en vaktpost.

- **`stabilitet.browser.test.ts`** teller mutasjoner i hver av de fem
  komponentene etter at brukeren har gjort noe, og krever null. Den fanger en
  komponent som skriver litt for mye.

### Endret

- **Komponentene setter tilbake det brukeren gjorde.** `<fs-tabs>` setter
  fanevalget tilbake, `<fs-popover>` at vinduet er åpent og hvor det står,
  `<fs-suggestion>` om lista er utvidet og hva som er markert, og
  `<fs-dialog>` `open` på selve `<dialog>` når den fortsatt står i topplaget.
  Alle fire observerer nå de attributtene de selv setter, og hver skriving
  sammenligner først.

  Sprettoppvinduet reparerer én vei: har noen bedt om at vinduet er åpent,
  blir det stående, men sender serveren `open`, åpnes det, for det er noe
  serveren faktisk sa. En app lukker det med egenskapen, altså
  `meny.open = false`, `hide()` eller `toggle()`; et attributt fjernet utenfra
  er ikke til å skille fra en morfing, og der er `server-controlled` svaret.
  Dialogen skiller på samme måte mellom `open` på verten, som er serverens
  beskjed, og `open` på `<dialog>`, som nettleseren setter.

  Komponentene husker identiteter og ikke posisjoner. `<fs-tabs>` husker selve
  knappen brukeren valgte: en indeks er ingen identitet, og en id virker ikke
  i håndskrevet markup, som ofte ikke har noen. En attributtmorfing beholder
  nodene, så referansen overlever den. `<fs-suggestion>` husker både id-en og
  teksten på det markerte alternativet, siden id-ene fra `fs.suggestion()` er
  posisjonelle og en ny liste gjenbruker dem. Er det borte, glemmer
  komponenten det framfor å gjette, og fanene rydder opp etter seg slik at
  raden fortsatt svarer.

## 0.9.0 (2026-09-23)

### Brytende

- **`FIELD_PRESERVED_ATTRIBUTES` er fjernet.** Lista fantes for at en mal
  skulle kunne skrive av navnene på alt `<fs-field>` setter, inn i
  `data-preserve-attr`, slik at en morfing lot dem stå. Den er ikke lenger
  nødvendig: komponenten ser at attributtene er borte, og setter dem
  tilbake. Bruker du den i dag, kan du ta bort både lista og
  `data-preserve-attr` på feltet.

### Rettet

- **Sprettoppvinduet åpnet seg igjen når en patch både fjernet `open` og
  overlot tilstanden.** En morfing setter ett attributt om gangen, og `open`
  kommer før `server-controlled` i dokumentrekkefølgen, så komponenten
  reparerte mens serveren var midt i å si at den overtar. Reparasjonen venter
  nå til hele patchen har landet, og sjekker vilkåret på nytt der.

- **Forslagsfeltet satte ikke tilbake `aria-activedescendant` alene.** Rev en
  patch bare pekeren, mens markeringen sto igjen, så ingenting galt ut i
  markupen, men skjermleseren hadde mistet lesepunktet sitt. Begge sidene av
  koblingen sjekkes nå.

- **En fanerad sluttet å svare når en patch fjernet den valgte fanen.**
  `<fs-tabs>` glemte valget, men lot markupen stå i utakt: ingen fane markert,
  alle paneler skjult, og et klikk gjorde ingenting, fordi `select(0)`
  sammenlignet mot en `selected` som svarer 0 også når ingenting er markert.
  Komponenten velger nå den første fanen i det tilfellet, og melder fra med
  `tab-select`, siden det er komponentens eget valg og ikke brukerens. Sendte
  serveren med vilje en rad uten markering, blir den overkjørt, men bare når
  brukeren hadde valgt noe fra før.

- **Et felt kunne ikke bli gyldig igjen.** `<fs-field>` leser `aria-invalid`
  fra kontrollen, fordi serveren kan ha skrevet feltet med `fs.field()` og da
  står svaret allerede der. Uten et skille mellom serverens attributt og
  komponentens eget leste den tilbake sitt eget svar fra forrige runde, så
  `felt.invalid = false` fjernet flagget på verten mens den røde rammen og
  feilmeldingen ble stående.

  Komponenten noterer nå verdien den selv skrev, og hvilken kontroll den ble
  skrevet på. Står det noe annet der neste gang, har noen andre rørt
  attributtet, og det er serverens ord som gjelder. Avlesningen er dermed
  alltid utledet av en endring som faktisk har skjedd, så det samme
  dokumentet gir alltid det samme svaret. Skrev serveren `aria-invalid` selv,
  står det derfor: `felt.invalid = false` fjerner flagget på verten, men
  stryker ikke det serveren sa. Bruk den ene av de to kildene, ikke begge.

### Endret

- **`<fs-field>` kobler også en ledetekst som står utenfor elementet.** En
  `<label for>` som peker på kontrollen navngir feltet like godt som en inni,
  og komponenten skriver nå `fs-label`, `data-required` og `aria-disabled` på
  den. Bytter en patch ut kontrollen med en uten id, husker komponenten
  id-en, så ledetekstens `for` fortsetter å peke på et element som finnes.
  Én forskjell er verdt å vite: en ledetekst utenfor ligger ikke i det
  komponenten observerer, så river en patch klassen av den, kommer den ikke
  tilbake før neste gang feltet synkroniserer.

- **`<fs-field>` reparerer sin egen kobling.** Bevaringslista var en kontrakt
  vi ikke kunne kontrollere: en Go- eller Kotlin-mal måtte skrive av ni
  attributtnavn fra dokumentasjonen, og endret Fristil hva komponenten satte,
  gikk malen stille i stykker. Komponenten observerer nå de attributtene den
  selv utleder, og setter dem tilbake i det en patch river dem bort. Id-ene
  den har laget huskes, så en skjermleser midt i en opplesning ikke følger en
  peker som skifter under den.

  Skillet er mellom det komponenten har **regnet ut** og det brukeren har
  **gjort**. Det første kan regnes ut på nytt, og repareres. Det andre, som
  `open` på et sprettoppvindu eller hvilken fane som er valgt, finnes det
  ingen kilde til, og en reparasjon ville dessuten kjempet mot en server som
  med vilje endret noe. Det fredes fortsatt med `data-preserve-attr`, skrevet
  av byggefunksjonen.

### Lagt til

- **Komponentene sier fra når markupen de fikk ikke henger sammen.** Alle
  disse ga før stillhet, og feilen viste seg først når noen leste siden med
  skjermleser:

  - `<fs-field>` uten en kontroll, og uten en ledetekst. Feltet regnes som
    navngitt av en `<label>` inni, en `<label for>` utenfor, eller
    `aria-label` og `aria-labelledby` på kontrollen, som i et søkefelt med
    bare et ikon;
  - `<fs-tabs>` uten noe med `role="tab"`, og med færre paneler enn faner;
  - `<fs-dialog>` uten en `<dialog>` som direkte barn;
  - `<fs-suggestion>` uten en combobox, og uten en listboks;
  - `<fs-popover>` uten et panel, uten en id på panelet, og uten en knapp som
    peker på det;
  - `<fs-error-summary>` med punkter som ikke lenker til feltene, og med en
    lenke som peker på en id som ikke finnes. Den siste meldes når boksen
    synkroniserer, ikke først når noen klikker: en lenke som ikke fører noe
    sted er like ødelagt om ingen prøver den.

  Advarselen kommer én gang per element og melding, og først når siden har
  falt til ro. Det siste er grunnen til at den kan stoles på: HTML som
  strømmer fra en server leveres i pakker, og et brudd mellom ledeteksten og
  feltet er helt vanlig, så komponenten ser ofte halvferdig markup i det den
  kobles til.

- **`warnAboutMarkup` er en ny eksport** fra `@fristil/designsystem/host-element`.
  En overtatt komponent bruker den, så den må være tilgjengelig.

- **En vaktpost på at hver komponent kan overtas.** `sjekk-cli.ts` kjører
  `overta` på hver komponent verktøyet selv lister opp, og krever at ingen
  fil i kopien peker ut av mappa, og at hver `@fristil/…`-henvisning står i
  `exports`. Faren har stått skrevet ned lenge: en komponent som henter noe
  fra en ny mappe uten et inngangspunkt gir en kopi som peker i løse lufta,
  og feilen viser seg først når konsumenten bygger. Nå sier den fra her.

## 0.8.3 (2026-09-23)

### Rettet

- **`<fs-dialog>` åpnet igjen en dialog brukeren nettopp hadde lukket.**
  Serveren skriver `open` begge steder, så innholdet finnes uten JavaScript,
  og `<form method="dialog">` lukker boksen uten JavaScript også. Skjer det
  før komponenten har fått kjøre, finnes det ingen lytter, og første
  synkronisering så en vert som sa «åpen» og en lukket dialog. Da spratt
  dialogen opp igjen. På mobil skjedde det hver gang, fordi vinduet der er
  langt nok til å rekke et trykk.

  `returnValue` skiller de to tilfellene: nettleseren setter den til verdien
  på knappen som lukket dialogen, så en dialog som aldri har vært åpnet har
  den tom. En mal som bare skriver `open` på verten åpnes derfor som før.
  Funnet i spilldemoen, på 375 piksler.

  Det holder bare når knappen har en `value`. Lukkes dialogen med en knapp
  uten verdi, etterlater nettleseren ingenting å se etter. Det står nå på
  dialogsiden, og eksemplene der har alltid hatt en.

## 0.8.2 (2026-09-23)

### Rettet

- **`<fs-field>` mistet koblingen mellom ledetekst og felt ved første
  patch.** Bytter en morfing ut selve kontrollen, finnes det ingen node å
  frede, og den nye kommer uten id. Ledeteksten står igjen med sin `for`.
  Komponenten fant da ingen id, fant opp en ny, skrev den bare på
  kontrollen, og `for` pekte etter det på et element som ikke fantes. Feltet
  var altså uten ledetekst for en skjermleser, og det holdt seg til siden
  ble lastet på nytt.

  Id-en leses nå også fra ledetekstens `for`, og `for` skrives hver gang, ikke
  bare når den mangler: de to er den samme opplysningen og kan ikke få si
  hver sin ting. Funnet i spilldemoen, i appen som sender HTML-biter fra en
  Kotlin-server.

## 0.8.1 (2026-09-23)

### Endret

- **`fs.dialog({ open: true })` skriver `open` på `<dialog>` også.** Det sto
  bare på verten, og da var innholdet borte for den som ikke har
  JavaScript: en `<dialog>` uten `open` er skjult. Nå vises det, plassert
  over innholdet under seg slik nettleserens egen stil gjør det, og
  komponenten gjør den om til en ekte modal med `showModal()` når den får
  kjøre. I React var det dessuten det eneste som stemte: komponenten setter
  `open` før React hydrerer, og sto det ikke i serverens HTML, meldte React
  avvik ved hvert eneste oppslag. Funnet i demoappen i TanStack Start.

  `<fs-dialog>` tar attributtet bort med `removeAttribute` framfor `close()`
  før den kaller `showModal()`. `close()` sender en ekte `close`-hendelse, og
  den ville nå kommet ved hver eneste lasting av en åpen dialog. En app som
  lytter på `close` rett på `<dialog>` fikk altså en lukking før brukeren
  hadde sett dialogen. `dialog-toggle` så den ikke, siden komponenten
  stopper på `:modal`.

  Komponenten ser nå på `:modal` og ikke på `open` når den lukker.
  Byggefunksjonen sender `open` på `<dialog>`, så i React er det React som
  eier attributtet, og React oppdaterer barn før forelder: lukker appen
  dialogen, er attributtet borte før komponenten får vite det. `close()` gjør
  ingenting uten attributtet, så dialogen ble stående i topplaget, usynlig,
  med resten av siden inert.

  Styrer du dialogen selv fra nettleseren, skal du ikke sende `open` inn i
  `fs.dialog()`. `showModal()` kaster `InvalidStateError` på en dialog som alt
  står åpen, så en app som gjorde begge deler virket før og kaster nå. Det
  står i typen, i JSDoc-en og på siden.

  Har du JavaScript, ser du dessuten dialogen et øyeblikk som en boks der den
  står i flyten, før komponenten flytter den til midten som en modal. Før var
  det ingenting å se før modalen kom.

### Rettet

- **`fs.field()` sa ikke fra om at en id som lages av seg selv er
  tilfeldig.** Rendres feltet både på serveren og i nettleseren, blir det to
  ulike, og `for` og `aria-describedby` peker på noe annet enn det som står
  der. React melder avvik ved hydreringen. Det står nå i typen, på feltsiden
  og i React-fanen, med `useId()` som svaret.

## 0.8.0 (2026-09-23)

### Brytende

- **Boolske attributter på en vert er `true`, ikke `""`.** `fs.dialog().host`
  og `fs.popover().host` sendte ut `open: ""`. React 19 setter egenskaper
  framfor attributter på egendefinerte elementer, og `el.open = ""` er usant,
  så setteren i komponenten fjernet attributtet igjen: dialogen og panelet
  åpnet seg ikke, og om det skjedde kom an på om elementet var oppgradert
  ennå. `data-*` er noe annet og beholder den tomme strengen, for dem sender
  React videre som attributter i begge versjoner. `Flag` i `jsx/react.ts` er
  dermed `true | undefined` igjen, slik dokumentasjonen har sagt hele tiden.

- **Avslaget på fokus i feiloppsummeringen heter `data-autofocus="false"`.**
  Det het `autofocus="false"`. `autofocus` er en boolsk egenskap på
  `HTMLElement`, så React 19 satte `el.autofocus = "false"`, som er sant,
  mens attributtet aldri kom i markupen. Avslaget virket altså ikke i React
  19, og feilen var taus. Samme feilklasse som `open` over.

- **`ReactAttributes<T>` gir `number` for `tabIndex`.** Typen er eksportert,
  altså offentlig API, og den sa før `string`. Rettelsen under er grunnen:
  verdien var feil, og typen beskrev feilen. Kode som tok imot den gamle
  typen som en streng, for eksempel `const t: string = fs.tabs(...).tabs[0]
  .tabIndex`, kompilerer ikke lenger. Selve attributtet i DOM-en er uendret.

### Rettet

- **`tabIndex` kom ut som en streng fra React-inngangen.** `NAVN` døpte om
  `tabindex`, men lot verdien stå. I HTML er den en streng, i React er
  `tabIndex` et tall, så `fs.tabs()` ga `tabIndex: "0"` og TypeScript avviste
  den i enhver React-app. Den virket i nettleseren, siden React gjør om
  verdien selv, så feilen viste seg bare som en typefeil hos konsumenten.
  Funnet i en ekte React-app, ikke her.

- **`fs.fieldset` lovet en tilstand som ikke fantes.** `states` har alltid
  oppgitt `success`, men `fieldset.css` hadde bare en regel for `invalid`.
  Attributtet ble skrevet, og ingenting skjedde.

- **JSX-deklarasjonene godtok ikke det byggerne sender ut.** Et boolsk
  attributt er `""` fra byggeren, mens `Flag` i `jsx/react.ts` bare tillot
  `true` og `undefined`. `<fs-popover {...fs.popover({ open: true }).host}>`
  type-sjekket derfor ikke, altså to deler av det samme API-et som var
  uenige om det samme attributtet.

### Lagt til

- **En vaktpost på at hver lovlig verdi finnes i CSS-en.** `pakke-css.browser.test.ts`
  går gjennom listene byggerne reklamerer med, `variants`, `colors`, `sizes`,
  `states`, `pickers`, `markers` og `types`, kaller byggeren med hver av dem,
  og rendrer elementet to ganger, med og uten attributtet. Noe i den beregnede
  stilen må være forskjellig, pseudoelementene medregnet. Et tekstsøk ville
  passert på en tom regel og på en som blir overstyrt lenger nede.
  Farger regelen et barn framfor elementet selv, som feltsettet gjør med
  `.fs-legend`, kreves det i stedet at en regel som gjelder her erklærer noe.
  Uten det ville en tom blokk passert, og det var nettopp en tom blokk som
  slapp gjennom første utgave av prøven.

  Verdier som ikke sender ut noe attributt hoppes over: standardverdien, og
  verdier som ikke er ment å se annerledes ut. To egne prøver passer på at
  hoppelista ikke blir en bakdør. Den ene krever at opsjonsnavnet er et
  byggefunksjonen kjenner, siden feil navn ellers tar en hel liste ut av
  prøven i stillhet. Den andre krever at hver liste en byggefunksjon har,
  står i tabellen.

  Hvilke regler som gjelder hentes fra CSSOM, ikke fra teksten: en regel i en
  `@supports` motoren ikke har, eller i en `@media` som ikke slår til, gjør
  ingenting. Den stylede nedtrekkslista står i begge, og skal ikke endre noe
  i Firefox.

  `dom.browser.test.ts` sjekket at en verdi kan settes og fjernes, ikke at
  den betyr noe. Fieldset-feilen over hadde ligget der siden komponenten kom.

- **En vaktpost på at ingen byggefunksjon sender ut et navn React staver
  annerledes.** `react.browser.test.ts` kalte før ti byggefunksjoner for hånd
  og så bare etter `class` og `for`. Den går nå gjennom hver byggefunksjon i
  `/react`, med hver lovlige verdi funksjonen selv oppgir, og avviser hvert
  navn i Reacts egen tabell, også `readonly`, `maxlength` og `colspan`, som
  ingen byggefunksjon sender ut ennå. Den krever også at hver byggefunksjon i
  `fs` finnes i `/react`.

- **En vaktpost på at byggerne passer i JSX-deklarasjonene.**
  `src/jsx/typer.browser.test.ts` tilordner det byggerne sender ut til
  `JSX.IntrinsicElements`, og det er `typecheck:tests` som er prøven. Begge
  deler er offentlig API, og de kan gå fra hverandre uten at noe sier fra.

## 0.7.0 (2026-09-22)

### Brytende

- **`fs.dialog()` tar nå et valgobjekt og gir ett attributtsett per element.**
  Den ga før `{ class: "fs-dialog" }` til selve `<dialog>`. Nå heter kallet
  `fs.dialog({ titleId, open })` og gir `host`, `dialog`, `title`, `body` og
  `footer`, på samme form som `fs.popover()`. Klassenavnene ligger fortsatt på
  funksjonen: `fs.dialog.title` og de andre.

- **Dialogen har flyttet fra `css/` til `ramme/`,** siden den nå har en
  komponent. `@fristil/designsystem/dialog` peker derfor på `<fs-dialog>` og
  ikke lenger på byggefunksjonen; den hentes fra hovedinngangen, som for de
  andre sammensatte komponentene. `@fristil/designsystem/dialog.css` er
  uendret.

### Lagt til

- **`<fs-dialog>` lar en server åpne en dialog.** Å åpne en `<dialog>` er et
  kall og ikke et attributt: bare `showModal()` flytter fokus inn, holder
  fokus inne i dialogen, lukker på Escape og gjør resten av siden
  utilgjengelig. `<dialog open>` er bare en boks på siden. En app som skriver
  HTML på serveren, i Datastar, htmx, en Go-mal eller en Razor-visning, kunne
  derfor ikke åpne en dialog i det hele tatt uten å skrive sitt eget skript
  ved siden av. Nå sier serveren `open` på `<fs-dialog>`, og komponenten gjør
  kallet.

  Lukker brukeren dialogen, fjernes `open` fra verten igjen, så markupen sier
  det samme som skjermen. De to `open`-ene er ikke det samme: det på verten er
  serverens beskjed og er ikke fredet, for ellers kunne serveren aldri åpnet
  dialogen igjen etter første lukking. Det nettleseren setter på selve
  `<dialog>` når `showModal()` kalles, er derimot fredet, ellers river
  morfingen det bort og lukker dialogen i samme øyeblikk som den åpnet den.
  `morfing.browser.test.ts` kjører hele runden.

  Komponenten melder fra med hendelsen `dialog-toggle`, som bærer `open` og
  `returnValue`, altså hvilken knapp som lukket dialogen. Den er `composed`,
  så den kommer ut av en skyggerot.

  Komponenten gjør ingenting når den står løsrevet fra siden. En morfer
  bygger serverens utgave i et løsrevet tre før den sammenlignes, og et
  egendefinert element tas i bruk der også; uten den sperren kastet
  `showModal()` ved hver patch som rørte dialogen.

### Rettet

- **`color-scheme` i `tokens.css`.** Uten den tegner nettleseren sine egne
  flater lyst uansett hva tokenene sier: nedtrekkslista til en `<select>`,
  rullefelt og kalenderpanelet i et datofelt. En side i mørkt tema fikk da en
  hvit liste midt i seg. `:root` sier nå `light dark`, så systemvalget
  avgjør, og `data-theme` setter den til `light` eller `dark` slik at
  nettleserens flater følger med når appen tvinger fram et tema.

  Dette ble funnet i en demoapp, ikke i enhetstestene. Det er bare
  nettleserens eget utseende som røper det.

- **`<fs-field>` sier selv at det er en blokk.** Et egendefinert element er
  `display: inline` til noen sier noe annet, og feltet var det eneste som
  pakker inn andre elementer uten å si det. Barna er blokker, så det så
  riktig ut helt til noen ga elementet en avstand eller la det i et rutenett.
  `<fs-suggestion>` har alltid sagt det samme om seg selv.

## 0.6.1 (2026-09-22)

### Lagt til

- **`--semantic-focus-ring` samler fokusringen på ett sted.** Den sto skrevet
  ut med bredde og farge i tjue regler fordelt på atten stilark. Selektorene
  er forskjellige i hver komponent, og `outline-offset` skal være ulik, så det
  som faktisk gjentok seg var verdien. Nå skriver hver komponent
  `outline: var(--semantic-focus-ring)`, og en konsument som vil ha en annen
  fokusring endrer ett token framfor atten filer.

  De tre stedene som med vilje har en annen farge, feiloppsummeringen og
  hopplenken, skriver `outline-color` etter kortformen og arver bredden. Da
  følger også de med hvis bredden endres.

  En ny vaktpost i `pakke-css.browser.test.ts` avviser en `outline` med
  `solid` skrevet ut i et komponentstilark.

## 0.6.0 (2026-09-22)

### Brytende

- **`fs.popover()` sender ikke lenger ut `slot="trigger"`.** Attributtet var
  et levn fra den gangen komponenten hadde shadow DOM. Uten en skyggerot gjør
  `slot` ingenting i HTML, så det var en merkelapp som så ut som noe annet enn
  det var, og dokumentasjonen ba leseren skrive noe nettleseren ignorerte.

  `<fs-popover>` kjenner nå igjen delene på koblingen som må være der uansett:
  panelet er det som har `popover`, og knappen er den som peker på panelet med
  `aria-controls`. Begge deler skriver `fs.popover()` fra før, så markup laget
  med byggefunksjonen virker uendret, og et `slot`-attributt som blir stående
  fra en server som ikke er oppdatert, gjør ingen skade.

  Skriver du markupen for hånd, må knappen ha `aria-controls` med panelets
  `id`, og panelet må ha `popover`. Det er de samme to tingene
  tilgjengeligheten krever.

  Typen `PopoverAttributes` har mistet `slot` fra `trigger`.

## 0.5.3 (2026-09-22)

### Rettet

- **Pakken lar seg importere på en server.** `class X extends HTMLElement`
  blir evaluert i det modulen lastes, og `HTMLElement` finnes bare i
  nettleseren. Ni av inngangspunktene stoppet derfor med «HTMLElement is not
  defined» på en server uten DOM, hovedinngangen `@fristil/designsystem`
  inkludert. Det gjorde `import { fs } from "@fristil/designsystem"` umulig i
  en Node- eller Bun-server, altså nøyaktig den linja «Kom i gang» ber leseren
  skrive, i nettopp den situasjonen systemet er bygd for.

  Web-komponentene arver nå fra `HostElement` i det nye inngangspunktet
  `@fristil/designsystem/host-element`, som faller tilbake på en tom klasse
  når `HTMLElement` ikke finnes. `defineFs*` gjør ingenting når det ikke
  finnes noen `customElements` å registrere i, så et kall fra en modul som
  kjøres begge steder er trygt.

  Ingen nettlesertest kunne se dette, for der finnes `HTMLElement`. En ny
  vaktpost, `scripts/sjekk-server-import.ts`, kjører i Bun uten DOM og
  importerer hver JavaScript-oppføring i `exports` fra `dist`.

## 0.5.2 (2026-09-22)

### Lagt til

- **`<select>` kan tegne nedtrekkslista inne i siden.** `fs.select({ picker:
  "styled" })` gir `data-picker="styled"`, og da bruker feltet
  `appearance: base-select`: lista blir et vanlig element i siden i stedet for
  et vindu fra operativsystemet, og får Fristils farger, avstander og skygge.
  Elementet er fortsatt en helt vanlig `<select>`, så innsending, tastatur og
  skjermleser er uendret.

  Det må slås på, og det er med vilje. Chromium 148 og WebKit 26.4 har
  `appearance: base-select`; Firefox 150 har det ikke og viser nettleserens
  egen liste som før. Begge deler er testet i hver sin motor. I
  høykontrastmodus faller alle tre tilbake til nettleserens egen liste, siden
  systemfargene er de eneste som er garantert lesbare der.

  Nye variabler: `--fs-select-option-padding` og
  `--fs-select-viewport-margin`. `--fs-select-radius` gjelder nå også lista.

### Rettet

- **`FIELD_PRESERVED_ATTRIBUTES` dekker nå hjelpeteksten og feilmeldingen.**
  Skriver malen ingen id-er, lager `<fs-field>` dem selv, og
  `aria-describedby` på kontrollen peker på dem. `id` sto ikke i noen liste,
  så en morfing fjernet den, og koblingen pekte på noe som ikke fantes: verken
  hjelpeteksten eller feilmeldingen ble lest opp. Lista har nå en `help`-nøkkel,
  `error` har fått `id` og ledeteksten har fått `for`.

- **`<fs-error-summary>` tar fokus hver gang boksen vises på nytt.** Den tok
  det bare første gang. Mønsteret i en Datastar-app er at serveren sender
  boksen skjult og bare slår `hidden` av og på, mens lista står med de samme
  lenkene, og da nullstilte ingenting flagget. Andre gang det samme skjemaet
  feilet, ble brukeren stående i feltet uten å få vite hvorfor innsendingen
  ikke gikk gjennom. Flagget nullstilles nå når boksen skjules.

- **`<fs-suggestion>` leser hvilket alternativ som er markert fra markupen.**
  Komponenten holdt en egen teller ved siden av `aria-selected`. Satte
  serveren markeringen selv med `fs.suggestion({ activeIndex })`, hoppet
  første piltast til toppen av lista i stedet for til alternativet etter, og
  markeringen serveren nettopp sendte var borte.

- **Pil opp åpner lista, og går til det siste alternativet.** Den markerte før
  et alternativ uten å åpne lista, så `aria-activedescendant` pekte inn i noe
  feltet samtidig meldte som lukket, og skjermleseren leste opp et alternativ
  som ikke sto på skjermen. Uten noe markert fra før gikk den dessuten til det
  nest siste, ikke det siste.

- **`fs.suggestion().empty` bevarer `hidden` gjennom en oppdatering.**
  Komponenten skjuler «Ingen treff» når noe passer, men elementet hadde ingen
  `data-preserve-attr`, så teksten dukket opp igjen ved hver patch, også midt
  i en liste med treff. Byggefunksjonen sender nå `hidden` når serveren har
  noe å velge mellom, og navnet står i lista.

  Begge ble funnet av en ny vaktpost, `morfing.browser.test.ts`, som kjører
  Datastars egen attributtsynkronisering mot ekte markup etter at komponenten
  har gjort jobben sin. Den dekker felt, forslagsfelt, faner og
  sprettoppvindu.

- **`.fs-select` snur riktig i språk som skrives fra høyre mot venstre.**
  Feltet holdt av plass til pila si med en `padding` på fire verdier, altså
  over, høyre, under og venstre. De to fysiske sidene snur ikke med språket,
  så i RTL lå plassen på feil side og teksten la seg oppå pila. Plassen settes
  nå logisk, og pila, som er to gradienter og derfor ikke har noen logisk
  variant, speilvendes med `:dir(rtl)`. Nedtrekkslista var ikke dekket av
  retningstesten i det hele tatt, og er det nå. En ny vaktpost i
  `pakke-css.browser.test.ts` avviser fysiske kortformer med fire verdier i
  alle stilark.

- **`fs.setAttributes` fjerner nå `data-size` og `data-picker` igjen.** Den
  rydder bare i en lukket liste av attributtnavn, og de to sto utenfor. En
  avatar eller en overskrift som gikk tilbake til standardstørrelsen beholdt
  altså `data-size` fra forrige kall, og fikk aldri standardutseendet sitt
  igjen. En ny vaktpost kaller hver byggefunksjon med hver lovlige verdi den
  selv oppgir, regner et attributt som valgfritt når det ikke er med i kallet
  uten argumenter, og krever at hvert av dem lar seg fjerne.

## 0.5.1 (2026-09-21)

### Rettet

- **React-inngangen døper nå også om `autocomplete` til `autoComplete`.**
  `fs.suggestion()` sender det ut på kontrollen, og React advarte «Invalid DOM
  property `autocomplete`» i konsollen for hvert forslagsfelt. En ny vaktpost
  kaller hver byggefunksjon, teller opp hvert attributtnavn de sender ut, og
  krever at ingen av dem er et navn React staver annerledes uten at
  `react.ts` døper det om.

- **`<fs-session-timeout>` bygger dialogen sin først når den skal vises.** Den
  lagde den i `connectedCallback`, altså før React rakk å hydrere, og
  hydreringen feilet med «server rendered HTML didn't match the client». Nå
  gjør den det samme som `<fs-toast>` og `<fs-connection-status>`: ingenting
  står i DOM-en før det trengs.

### Endret

- **`fs.toast()` er dokumentert.** Byggefunksjonen fantes, men sto ikke på
  komponentsiden. Den gir tre attributtsett, og det er `region` du sprer på
  `<fs-toast>`, ikke hele objektet.


## 0.5.0 (2026-09-21)

### Brytende

- **Serveren skriver markupen, komponentene fester bare oppførsel.** Seks
  komponenter satte tidligere klasser, roller og tilgjengelighetskoblinger på
  elementer serveren hadde sendt. Det virker ikke i en app med server-rendret
  HTML: Datastars morfing fjerner hvert attributt som ikke står i HTML-en
  serveren nettopp sendte, og React kan kaste bort noder et egendefinert
  element har lagt inn i et tre React eier. Testet med ekte Datastar mistet et
  `<fs-field>` både `aria-describedby`, klassen på ledeteksten og den skjulte
  feilmeldingen etter én patch, og fikk dem ikke tilbake.

  Markupen skrives nå av nye byggere i `fs`: `fs.errorSummary()`,
  `fs.popover()`, `fs.tabs()`, `fs.suggestion()` og `fs.toast()`. Byggerne
  setter også `data-preserve-attr` for de attributtene komponenten endrer
  underveis, så du slipper å vite om det. Se «Server først» i dokumentasjonen.

- **`<fs-calendar>` og `<fs-date-field>` er fjernet.** Nettleserens eget panel
  i `<input type="date">` gjør jobben, og `fs.field()` sammen med
  `fs.input({ type: "date" })` gir et komplett datofelt. Mønstersiden «Dato i
  et skjema» viser oppsettet, med de to forskjellene vi har testet mellom nettleserne.
  `exports`-oppføringene `./calendar`, `./date-field` og `./date-field.css` er
  borte, og det samme er `--fs-calendar-*`- og `--fs-date-field-*`-variablene
  og alle `part`-navnene i kalenderen.

- **`<fs-suggestion>` er flyttet fra `frittstående` til `ramme`.** Den lagde
  tidligere hele feltet selv, så det fantes verken ledetekst eller
  inndatafelt før skriptet hadde kjørt, og ingenting ble med i innsendingen.
  Nå skriver serveren feltet og lista med `fs.suggestion()`.

- **`<fs-tabs>` har ingen `selected`- eller `label`-attributter lenger.**
  Hvilken fane som er valgt står i markupen serveren sendte. `<fs-error-summary>`
  har ikke lenger `heading`: overskriften skrives av serveren.

- **Ingen komponent bruker shadow DOM.** `::part()` er dermed ikke lenger en
  del av det offentlige API-et.

- **`<fs-field>` leser tilstanden fra markupen, ikke fra egne attributter.**
  Skrev serveren feltet med `fs.field()`, står `aria-invalid` og
  `data-required` allerede på elementene. Komponenten regnet tidligere ut sitt
  eget svar fra attributtene på verten, fant ingenting der, og fjernet det
  serveren nettopp hadde skrevet. De to halvdelene av API-et kranglet altså
  med hverandre når de ble brukt sammen. Den setter heller ikke lenger
  `aria-hidden` på feilmeldingen: `hidden` tar den allerede ut av
  tilgjengelighetstreet, og attributtet ga hydreringsfeil i React.

### Lagt til

- **`<fs-session-timeout>`** varsler før en innlogget økt går ut, med en
  nedtelling som leses opp ved terskler i stedet for hvert sekund, og fokus
  som går tilbake dit brukeren var.

- **`<fs-connection-status>`** sier fra når forbindelsen til serveren er
  borte. `navigator.onLine` sier bare at maskinen har et nettverk, så
  `reportFailure()` og `reportSuccess()` lar appen melde fra selv.

- **Siden «Server først»** forklarer hvorfor markupen kommer fra serveren, med
  testene bak, og hva det betyr i TanStack Start, React Server Components og
  Datastar.

- **Mønstersiden «Dato i et skjema»** viser hvordan du ber om en dato uten en
  datovelger fra oss, med de to forskjellene vi har testet mellom nettleserne:
  WebKit krever skilletegnene, og Chromium tar imot feil rekkefølge som
  gyldig.

- **`FIELD_PRESERVED_ATTRIBUTES`** er lista serveren skal skrive som
  `data-preserve-attr` når den ikke kan kalle `fs.field()` selv.

### Rettet

- **`<fs-toast duration="0">` lot ikke meldingene bli stående.** Attributtet
  ble lest som «ugyldig» og falt tilbake til seks sekunder, så bare
  `show(…, { duration: 0 })` virket.

- **`<fs-error-summary>` fikk ikke fokus når serveren bare tok bort `hidden`.**
  Komponenten så etter endringer i barna, ikke i attributtene, så en
  oppsummering som nettopp ble synlig ble stående uten fokus.

- **`<fs-error-summary>` finner nå feltet i sin egen rot.** Oppslaget gikk mot
  `document`, som ikke ser inn i en skyggerot, så lenken ble en vanlig
  ankerlenke uten fokusflytting når skjemaet lå inne i en annen komponent.

- **`FIELD_PRESERVED_ATTRIBUTES` dekker alle tre elementene.** Den dekket bare
  kontrollen, men komponenten legger også `fs-label` og markeringene på
  ledeteksten og skjuler feilmeldingen. Serveren må derfor skrive én liste per
  element, og konstanten har nå `label`, `control` og `error`.

- **`<fs-popover>` lot seg ikke åpne etter at den var flyttet i DOM-en.**
  Referansen til knappen ble stående, så lytteren ble aldri festet på nytt.

- **`fs.popover({ open: true })` sier det nå på verten.** Før satte den bare
  `aria-expanded` på knappen, så markupen meldte at panelet var åpent mens
  komponenten mente det var lukket.

- **`<fs-suggestion>` mistet musevalg etter at serveren sendte en ny liste.**
  Alternativene fikk bare lytteren sin når selve feltet var nytt.

### Endret

- **React-inngangen døper også om `tabindex` til `tabIndex`,** og dekker de nye
  sammensatte byggerne. `fs.errorSummary()`, `fs.popover()`, `fs.tabs()`,
  `fs.suggestion()` og `fs.toast()` finnes nå også i
  `@fristil/designsystem/react`, der hvert attributtsett er døpt om for seg.
  Pakken har fortsatt ingen avhengighet til React: dette er ren omdøping av
  tre objektnøkler.

- **`lit` er ikke lenger en avhengighet.** Etter omleggingen rendrer ingen
  komponent sitt eget innhold, så Lit ble brukt til nesten ingenting.
  Komponentene er vanlige `HTMLElement`-klasser, og pakken har nå ingen
  avhengigheter i det hele tatt.

## 0.4.0 (2026-09-21)

### Endret

- `lit` er en vanlig avhengighet, ikke en valgfri `peerDependency`. Du trenger
  bare `npm install @fristil/designsystem`, og ikke lenger vite at Lit finnes.
  Bygget ditt er upåvirket: ingenting registreres ved import alene, så Lit
  kommer først med når du kaller en `defineFs*`.

## 0.3.0 (2026-09-21)

### Rettet

- `sjekk-eksport.ts` leser svaret fra `npm pack --json` i begge formene npm
  bruker. npm 11 svarer med en liste, npm 12 med et objekt der pakkenavnet er
  nøkkelen, og arbeidsflyten som publiserer henter alltid nyeste npm. Utgivelsen
  stoppet derfor på «{} is not iterable», med en feil som pekte på vår egen kode
  framfor på npm. Skriptet sier nå fra med npm sin egen feilmelding når
  pakkingen feiler.

- `bin` peker på `dist/cli.js` uten `./` foran. npm rettet det selv ved
  publisering og advarte om at navnet var «invalid and removed», som leste som
  om kommandolinja forsvant. Den var med hele tiden.

## 0.2.0 (2026-09-21)

### Lagt til

- `fristil overta <komponent>` kopierer kildekoden til én komponent inn i
  prosjektet ditt, og skriver om henvisningene ut av mappa. Til bruk når
  tilpasning gjennom CSS ikke strekker til. Kopien er din, og oppdateringer av
  pakken rører den ikke.

- `fristil --hjelp` (og `--help`, `-h`, `help`) skriver ut hva kommandoen kan.
  Uten argumenter gjorde den før et forsøk på å lage et tema, og klaget over
  manglende farger uten å nevne at `overta` fantes.

- Pakken kan publiseres på npm. Den har lisens (MIT), en README som blir
  forsiden på npm, og feltene `repository`, `homepage`, `bugs` og `keywords`.
  `publishConfig` sier `public`, siden en pakke med navnerom ellers blir
  privat, og `prepublishOnly` bygger, så en publisering fra et rent klon ikke
  kan komme ut uten `dist`.

- `bun run sjekk:pakke` kjører [publint](https://publint.dev) mot pakken, som
  en del av bygget. Den leser `exports` slik nettlesere, byggverktøy og TypeScript
  faktisk gjør det.

### Rettet

- `types` står først i hver oppføring i `exports`. Betingelsene leses i
  rekkefølge, og `import` sto først, så TypeScript fant typene bare fordi
  `.d.ts`-fila lå ved siden av `.js`-fila. Stiene er de samme som før.

- Kommandolinja svarer med en forklaring i stedet for et stakkspor fra Node
  når kommandoen er ukjent, eller når temafila mangler eller ikke er JSON.

- Lista over valgte filer i `file-upload` brekker nå til flere linjer på smal
  skjerm. Raden var bredere enn en telefon når filnavnet var langt, og knappen
  «Fjern <filnavn>» ble klippet av.
- `<fs-error-summary>` oppdaterer overskriften når `heading` endrer seg. Den
  ble bare skrevet første gang, så en oppsummering som talte ned fra to feil
  til én ble stående på to.

## 0.1.0 (2026-09-21)

Første versjon.

### Lagt til

- **Tokens** for farge, størrelse, typografi, radius og skygge, med semantiske
  navn (`--semantic-*`) over en råskala. Lyst og mørkt tema, og en egen fil for
  Tailwind 4.
- **34 CSS-komponenter** som bare trenger en klasse og `data-*`-attributter:
  accordion, alert, avatar, badge, breadcrumbs, button, card, checkbox, dialog,
  divider, error-text, fieldset, file-upload, heading, help-text, input, label,
  link, list, pagination, paragraph, radio, search, select, skeleton,
  skip-link, spinner, sr-only, switch, table, tag, textarea, toggle-group og
  tooltip.
- **Fire rammekomponenter** som kobler sammen markupen du selv skriver:
  `<fs-field>`, `<fs-error-summary>`, `<fs-popover>` og `<fs-tabs>`.
- **Fire frittstående komponenter** som eier markupen og interaksjonen:
  `<fs-calendar>`, `<fs-date-field>`, `<fs-suggestion>` og `<fs-toast>`.
- **`fs`-API-et**: én funksjon per komponent som tar et valgobjekt og gir
  attributter tilbake, med lovlige verdier og vakt hengt på funksjonen. En egen
  inngang for React (`@fristil/designsystem/react`) med `className` og
  `htmlFor`, og JSX-deklarasjoner for de egendefinerte elementene.
- **`fristil`-kommandoen** som bygger et tema fra egne farger, sjekker
  kontrasten mot WCAG og skriver ut CSS-en.
- **Tilpasning utenfra**: all CSS ligger i `@layer fristil`, form og størrelse
  leses fra `--fs-*`-variabler med tokenverdien som reserve, og komponenten med
  shadow DOM eksponerer delene sine med `::part()`.
