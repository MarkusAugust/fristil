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

### Brytende

- **`id` er påkrevd i `fs.field()`.** Den var valgfri, og funksjonen laget en
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
  bruke Fristil på. Utelates id-en likevel, lager funksjonen en og sier fra i
  konsollen, én gang. Uten den reserven ville en JavaScript-konsument fått
  `aria-describedby="undefined-help"` og verken `for` eller `id`, altså verre
  enn den ustabile id-en kravet skulle bli kvitt.

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

### Lagt til

- **`sjekk-dokumentasjon.ts` avviser et eksempel som kaller `fs.field()` uten
  `id`.** Ingenting annet i rekka leser kodeblokkene i dokumentasjonen, så et
  utdatert eksempel kunne stått grønt gjennom hele `bun run sjekk`. Den leser
  bare koden: i mdx det som står i kodegjerdene, i Astro frontmatteret og
  skriptene, siden `fs.field()` også nevnes i brødtekst.

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
