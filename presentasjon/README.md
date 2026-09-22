# Presentasjon om designsystemarkitektur

Lysbildene som forklarer hvorfor Fristil er satt sammen som det er: hvem som
eier markupen, hvem som eier oppførselen, og hva det koster.

Hver fil er en hel presentasjon i ett dokument. Ingen avhengigheter, intet
byggesteg, ingen server. Åpne fila i en nettleser, eller legg mappa på et
statisk vertskap.

```bash
open presentasjon/designsystemarkitektur-v7.html
```

## Versjonene

De ligger her alle sammen, siden de viser hvordan forklaringen har endret seg.
Skal du vise fram noe, bruk den nyeste.

| Fil | Hva som er nytt |
| --- | --- |
| `designsystemarkitektur-v7.html` | Lesbar på telefon. Se under. |
| `designsystemarkitektur-v6.html` | Presisert språk, og en kortere avslutning |
| `designsystemarkitektur-v5.html` | Arkitekturen etter at Lit ble fjernet |
| `designsystemarkitektur-v4.html` | Skrevet om så også en leder kan følge med |
| `designsystemarkitektur-v3.html` | Den første med de tre kategoriene |

## Slik blar du

Piltaster, mellomrom eller Enter. `Home` og `End` går til første og siste.
Adressen får `#lysbilde-6`, så en lenke peker på ett bestemt lysbilde. Det
finnes også to knapper som dukker opp når musa er over.

## Hvordan v7 blir lesbar på en liten skjerm

Lysbildet er en scene med fast størrelse, 1520 x 855, og hele scenen skaleres
ned til den passer i vinduet. Da er forholdet mellom overskrift, brødtekst og
avstander det samme på en telefon som på en projektor, og layouten er den
samme.

V6 lot hver skriftstørrelse følge vindusbredden med `clamp`. På en liten
skjerm falt hvert ledd ned på minsteverdien sin, mens rammen fortsatte å
krympe, så teksten ble forholdsvis større og større til den rant ut av kanten.

Å skalere 16:9 ned til bredden på en telefon gir en brødtekst på fem piksler,
og et lysbilde ingen kan lese er ikke det samme lysbildet. Derfor er scenen
selv stående på en telefon, 560 piksler bred og så høy som skjermen tilsier.
Reglene, komponentene og rekkefølgen er de samme; rader som sto side om side
legger seg under hverandre, for 560 piksler er ikke to spalter. Scenen måler
seg selv og vokser til det høyeste lysbildet får plass, så lenge brødteksten
holder seg over tolv piksler.

Testet i Chromium fra 1920 x 1080 til 375 x 667: ingenting blir klippet, verken
i høyden eller sidelengs. På de aller minste telefonene kan de to tetteste
lysbildene rulles litt, og det er et bevisst valg framfor å krympe teksten
under det lesbare.
