# Presentasjon om designsystemarkitektur

Lysbildene som forklarer hvorfor Fristil er satt sammen som det er: hvem som
eier markupen, hvem som eier oppførselen, og hva det koster.

Hele presentasjonen er ett dokument. Ingen avhengigheter, intet byggesteg,
ingen server. Åpne fila i en nettleser, eller legg mappa på et statisk
vertskap.

```bash
open presentasjon/designsystemarkitektur.html
```

## Én fil, og git som historikk

Mappa hadde lenge én fil per utgave, fra `v3` til `v9`. Det var en
versjonskontroll ved siden av den vi allerede har: git vet hvordan
presentasjonen så ut i går, og hvorfor hver setning ble som den ble.

Nå finnes bare `designsystemarkitektur.html`. Skal du se en eldre utgave, er
den i historikken:

```bash
git log --oneline -- presentasjon/
git show <commit>:presentasjon/designsystemarkitektur.html > /tmp/gammel.html
```

## Hva den sier

Trettien lysbilder om hva systemet er og hvorfor, ikke om hvordan vi kom dit.
Et publikum trenger ikke vite hva vi prøvde først, bare hva som gjelder og hva
det er godt for.

De er delt i syv kapitler, ett per arkitektonisk beslutning. Hvert kapittel
åpner med en forside som sier beslutningen i én setning, og som bærer et ikon
tegnet i Windows 3.1-stil. Ikonene ligger på en grå plate med tidens hevede
kant, fordi den svarte strektegningen i dem ellers ville forsvunnet mot den mørke flaten.

Kodepaneler står der koden **er** poenget, og ingen andre steder. De to
linjene fra Datastar som fjerner et attributt serveren ikke sendte er hele
begrunnelsen for kontrakten, og de sier mer enn et avsnitt om dem. Der et
panel bare ville vist at det finnes kode, er det ikke med.

Ingen webfont. Skriften er `Helvetica, Arial, sans-serif`, som er den stakken
Skatteetaten selv oppgir for skjerm, og en presentasjon skal ikke kunne feile
på grunn av nettet i et møterom.

Paletten er Fristils egne tokens, skrevet av med de samme verdiene. Flaten,
teksten og kanten er valgt for et mørkt lysbilde og hører bare til
presentasjonen.

## To lysbilder som viser i stedet for å påstå

Avhengighetsgrafen og morfingen er de to lysbildene med eget skript. Regelen
for begge er at det som vises skal være sant fordi det er regnet ut, ikke
fordi det er skrevet inn. Grafen tegnes fra et datasett lest ut av
`package-lock.json`, med dato, og kan tegnes på nytt fra en ny lesning.
Morfingen kjører Datastars egne to linjer på to virkelige elementer og
tegner brikkene fra `r.attributes` etter hvert steg, og linja med hva
skjermleseren sier regnes ut fra det samme elementet. Fjern
`!o.includes(l)` fra løkka, og utgangen med `data-preserve-attr` slutter å
virke, i animasjonen som i Datastar.

Begge bærer sin egen stil og sitt eget skript inne i lysbildet, med prefiks
`avh-` og `morf-`, så de kan løftes ut eller kastes uten å røre resten. På
smal skjerm viser grafen tabellen sin og morfingen koden, siden ingen av
dem sier noe på 375 piksler.

## Slik blar du

Piltaster, mellomrom eller Enter. `Home` og `End` går til første og siste.
Adressen får `#lysbilde-6`, så en lenke peker på ett bestemt lysbilde. Det
finnes også to knapper som dukker opp når musa er over.

## På liten skjerm

Fra og med 860 piksler og nedover forsvinner kortet helt: ingen ramme, ingen
skygge, ingen skalering. Lysbildet blir vanlig tekst rett på bakgrunnen, med
full skriftstørrelse, og siden ruller som en vanlig side. Knappene for å bla
ligger fast nederst, siden det ikke finnes piltaster på en telefon.

Testet i Chromium på 1440, 1280, 820 og 375 piksler: ingen av de trettien
lysbildene kan dras sidelengs, og på 1440 får alle plass uten å rulle. På 1280
ruller avhengighetsgrafen 73 piksler, resten får plass. Høydesjekken må se på lysbildets **egen** boks og ikke bare på om siden
ruller: et lysbilde kan vokse forbi kortet uten at siden merker det. To ting måtte til, og begge er lette å gjøre feil igjen: et
rutenettfelt trenger `min-inline-size: 0`, ellers blir det like bredt som den
lengste kodelinja, og selve dekket må være en vanlig blokk og ikke et
rutenett, ellers blir kolonnen like bred som innholdet sitt.
