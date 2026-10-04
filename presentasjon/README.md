# Presentasjon om designsystemarkitektur

Presentasjonen handler om arkitekturen et designsystem uten rammeverk trenger: hvem som
eier markupen, hvem som eier oppførselen, og hva det koster. Fristil er
eksempelet som viser at det virker, ikke temaet.

Hele presentasjonen er ett dokument. Ingen avhengigheter, ikke noe byggesteg,
ingen server. Åpne fila i en nettleser, eller se den på
[fristil-arkitektur.sobernetics.no](https://fristil-arkitektur.sobernetics.no/),
som bygger fra master ved hver push. Netlify-prosjektet bak heter
`designsystemarkitetktur`, med skrivefeilen, og
`designsystemarkitetktur.netlify.app` gir den samme siden. `netlify.toml` her sier hvordan: fila
kopieres til `index.html`, og det er alt.

```bash
open presentasjon/designsystemarkitektur.html
```

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
