# Endringer i @fristil/designsystem

Versjonsnumrene følger [semantisk versjonering](https://semver.org/lang/no/).
Det offentlige API-et er større enn funksjonene pakken eksporterer, så disse
regnes som brytende endringer og krever et nytt hovedtall:

- et klassenavn, et `data-*`-attributt eller en lovlig verdi som forsvinner
  eller endrer betydning,
- et `part`-navn i en komponent med shadow DOM,
- et tokennavn eller en `--fs-*`-variabel,
- en funksjon eller en type i `fs`,
- en oppføring i `exports` i `package.json`.

Nye komponenter, nye valgfrie attributter og rettelser som ikke endrer markup
kommer i et nytt undertall.

## Ikke utgitt

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
  en del av bygget. Den leser `exports` slik nettlesere, buntere og TypeScript
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
