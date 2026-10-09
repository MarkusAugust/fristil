# Presentasjon om designsystemarkitektur

Presentasjonen handler om arkitekturen et designsystem uten rammeverk trenger: hvor
markupen kommer fra, hva web componenten legger til, og hva det koster. Fristil er
eksempelet som viser at det virker, ikke temaet.

Lysbildene er ett dokument. Ingen avhengigheter, ikke noe byggesteg,
ingen server. Flyturen gjennom de samme lysbildene ligger ved siden av, i
`flytur.html` og `flytur/`. Åpne fila i en nettleser, eller se den på
[designsystemarkitektur.sobernetics.no](https://designsystemarkitektur.sobernetics.no/),
som bygger fra master ved hver push. Netlify-prosjektet bak heter
`designsystemarkitetktur`, med skrivefeilen, og
`designsystemarkitetktur.netlify.app` gir den samme siden. `netlify.toml` her sier hvordan:
flyturen kopieres til `index.html`, og lysbildene ligger på
`/designsystemarkitektur.html`, der flyturen også henter teksten sin.

```bash
open presentasjon/designsystemarkitektur.html
```

## Flyturen

`flytur.html` er den samme presentasjonen som en flytur gjennom en digital by,
i tradisjonen fra *Ghost in the Shell*: mørke tårn med lysende kanter,
kretsbaner som pulserer langs bakken, kolonner av tegn som faller og skilt som
henger i lufta. Det er ingen lysbilder i den. Teksten står i byen, og kameraet
flyr fra tekst til tekst.

Flyturen har ingen egen kopi av innholdet. Den henter
`designsystemarkitektur.html`, leser lysbildene med `DOMParser` og tar ut
teksten: overskrifter, avsnitt, punkter, kode, tabeller og linjene om hva
kravet koster. Teksten deles i stoppesteder som er korte nok til å leses mens
kameraet står stille, rundt to hundre i alt. Endres et lysbilde, endres
flyturen.

Når kameraet kommer fram, dekodes teksten fra tilfeldige tegn, og når det
flyr videre, løser den seg opp og kameraet flyr gjennom den. Hvert kapittel er
et eget distrikt med sin farge og sitt landemerke, hentet fra ikonet på
kapittelforsiden. Avhengighetsgrafen er bygget i tre dimensjoner fra det samme
datasettet som lysbildet tegner sin graf fra, ett designsystem per stoppested.

Musikken lages i nettleseren mens den spilles, med Web Audio og ingen
lydfiler: varme flater i dur, arpeggio-kaskader, en svingende breakbeat og en
stemme som sveller opp baklengs. Harmonikken vandrer i en Markov-kjede, hver
frase får nye eller muterte mønstre, og et nytt kapittel gir et brudd, en
oppbygging og et fall, og en ny toneart. Ingenting er skrevet på forhånd, så
den gjentar seg ikke.

| Fil | Hva den gjør |
| --- | --- |
| `flytur/innhold.js` | Tar teksten ut av lysbildene og deler den i stoppesteder |
| `flytur/tekst.js` | Tegner hvert stoppested, med dekodingen |
| `flytur/verden.js` | Byen, kamerakurven, grafene og etterbehandlingen, med three.js |
| `flytur/lyd.js` | Den generative musikken |
| `flytur/flytur.js` | Limet: autopilot, taster, lyd og instrumentpanel |
| `flytur/vendor/` | three.js 0.186.1 med bloom-passene, og Datastar 1.0.4 |

Instrumentpanelet og startskjermen er Datastar-signaler, og `flytur.js`
oppdaterer dem med den samme sammenslåingen en `patch-signals` fra serveren
ville brukt. Bibliotekene ligger i mappa og ikke på et CDN, av samme grunn som
skriften: presentasjonen skal ikke feile på nettet i møterommet.

Autopiloten flyr videre når teksten har stått lenge nok til å bli lest, regnet
ut fra antall ord, og en strek nederst viser hvor lenge det er igjen.
Piltastene tar over når som helst. `PageDown` og `PageUp` hopper et helt
lysbilde, mellomrom slår autopiloten av og på, og `M` lyden. Adressen får
`#punkt-12`, og `#lysbilde-6` fra dekket virker også. Lenken «Lysbildet» øverst
åpner lysbildet stoppestedet er hentet fra.

Modulene og `fetch` virker ikke når fila åpnes rett fra disk, så flyturen må
serveres, for eksempel med `bunx serve presentasjon`. Ber nettleseren om
mindre bevegelse, kutter kameraet rett til neste stoppested.

## Én fil, og git som historikk

Mappa hadde lenge én fil per utgave, fra `v3` til `v8`. Nå finnes bare
`designsystemarkitektur.html`, og de eldre utgavene ligger i git-historikken
til mappa.

## Hva den sier

Trettiseks lysbilder om hva som kreves og hvorfor, ikke om hvordan vi kom
dit. Et publikum trenger ikke vite hva vi prøvde først, bare hva som gjelder
og hva det er godt for.

De er delt inn i syv kapitler, ett per krav, og et åttende om fellene det er
lett å gå i. Hvert kapittel åpner med en forside som sier kravet i én setning.
Forsiden har et ikon tegnet med presentasjonens egen fargepalett: en
glassflate med lys kant og et glanslys på toppen. Motivet er plattformnært og
ikke en skrivebordsmetafor, for eksempel et nettleservindu, et DOM-tre eller
en pakke med vei ut. Et eget lysbilde før kapitlene viser alle åtte med hvert sitt ikon. Til
slutt kommer Fristil i bruk, med et skjemafelt og demospillet, og en
sjekkliste publikum kan bruke på sitt eget system.

Kravet og Fristils løsning står hver for seg. Nederst på et lysbilde står
inntil tre linjer: hva kravet betyr for produktteamene, hva det koster
designsystemteamet, og «I Fristil», som sier hvordan Fristil har løst det.
Kode som er Fristils eget API, har et grønt Fristil-merke over seg. Kravet
skal gi mening uten eksempelet, og eksempelet skal være lett å skille fra
kravet.

Kodepaneler står der koden **er** poenget, og ingen andre steder. De to
linjene fra Datastar som fjerner et attributt serveren ikke sendte, er hele
begrunnelsen for kontrakten, og de sier mer enn et avsnitt om dem. Der et
panel bare ville vist at det finnes kode, er det ikke med.

Ingen webfont. Skriften er `Helvetica, Arial, sans-serif`, som er den stakken
et annet norsk designsystem oppgir for skjerm. En presentasjon skal ikke kunne
feile på grunn av nettilgangen i møterommet.

Paletten er Fristils egne tokens, skrevet av med de samme verdiene. Fargene på
flaten, teksten og kantene er valgt for et mørkt lysbilde og hører bare til
presentasjonen.

## To lysbilder som viser i stedet for å påstå

Avhengighetsgrafen og morfingen er de to lysbildene med eget skript, og i
begge er innholdet regnet ut, ikke skrevet inn.
Grafen tegnes fra et datasett lest ut av `package-lock.json`, med dato.
Morfingen kjører Datastars egen løkke på to virkelige elementer, og linja
med hva skjermleseren sier, regnes ut fra elementet i siden. På smal skjerm
viser grafen tabellen sin og morfingen koden, siden ingen av dem sier noe på
375 piksler.

## Slik blar du

Piltaster, `PageUp` og `PageDown`, mellomrom eller Enter. `Home` og `End` går
til første og siste.
Adressen får et anker, for eksempel `#lysbilde-6`, så en lenke peker på ett bestemt lysbilde. Det
finnes også to knapper som dukker opp når musepekeren er over lysbildet.

## På liten skjerm

Fra og med 860 piksler og nedover forsvinner kortet helt: ingen ramme, ingen
skygge, ingen skalering. Lysbildet blir vanlig tekst rett på bakgrunnen, med
full skriftstørrelse, og siden ruller som en vanlig side. Knappene for å bla
ligger fast nederst, siden det ikke finnes piltaster på en telefon.

Testet i Chromium på 1440×900, 1280×800, 820 og 375 piksler bredt: ingen av de
trettiseks lysbildene kan dras sidelengs, og ingen av dem ruller inne i kortet.

Grafen er det strammeste lysbildet og tåler ikke en linje til. En egen blokk
med datoen for målingen fikk det til å rulle 15 piksler på 1280, og datoen ble
derfor stående inne i avsnittet under grafen i stedet for over den.
