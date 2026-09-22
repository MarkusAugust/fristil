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
  Bunten din er upåvirket: ingenting registreres ved import alene, så Lit
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
