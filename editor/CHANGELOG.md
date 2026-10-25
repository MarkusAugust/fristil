# Endringer i LO-TEK for VS Code

Utvidelsen har sitt eget versjonsnummer. Den følger ikke pakken, siden den
bare endrer seg når et element eller et attributt gjør det.

## 0.9.0

I takt med pakkens 0.36.0.

- Ti nye feilmeldinger fra kjernen, om det malen må skrive selv for at
  komponentene skal virke uten JavaScript og overleve en oppdatering fra
  serveren: en ledetekst som ikke er koblet til feltet, et panel uten id, en
  fane uten panel, en fanerad uten navn, en fane som ikke er en lenke,
  hjelpetekst inni `<label>`, `data-value` uten verdifelt, en skjult
  feilmelding ved siden av `aria-invalid`, de utgåtte attributtene på
  `<lt-field>`, og en id kopiert inn fra DevTools.
- En hurtigrettelse kan gjøre flere endringer under ett: «Gi feltet id
  «epost»» skriver `id` på feltet og `for` på ledeteksten.
- Snippetene har id-en som tabbestopp: skriv den én gang, så følger `for`
  og `href` med.

## 0.8.0

I takt med pakkens 0.32.0.

- Nytt ikon: det nye LO-TEK-merket, en F i to lag.
- Feilmeldingene og hurtigrettelsene kommer fra språkserveren, `lotek lsp`,
  den samme som Neovim og Helix bruker, skrevet i Rust. Den ligger i
  utvidelsen, så den trenger fortsatt ingenting installert, og sjekker mot
  LO-TEK-versjonen prosjektet har installert (`node_modules`) eller det
  Gradle-pluginen har skrevet (`build/lotek/manifest.json`), med
  komponenter tatt over med `lotek overta`. Uten noen av dem sjekker den
  mot versjonen den er bygget fra.
- Fullføring og sjekk av `data-color` på `lt-dialog`, med fargene
  `lt.dialog({ color })` gir. Før sa en ukjent farge ingenting.
- Markup i en kommentar i malspråket, som `{{-- --}}` i Blade og `@* *@` i
  Razor, gir ikke lenger funn.
- Hver feilmelding viser regelnavnet, som `ukjent-klasse`, med lenke til
  komponentsiden. Navnet er det `<!-- lotek-ignore-next ukjent-klasse -->`
  tar for å undertrykke ett funn.

## 0.7.0

I takt med pakkens 0.28.0.

- `lt-toast__message` finnes, og `lt-toast` er klassen på regionen. 0.6.0
  kjente ikke meldingsklassen: en gul strek sa at den ikke fantes, på markup
  som var riktig.
- Varianten `strong` på `lt-help-text` finnes, og `default` meldes som
  ukjent. Den het `default` før, uten å være standardverdien.
- Snippetene for feltet og feiloppsummeringen følger oppskriftene på
  komponentsidene: skjemaet har `novalidate`, og feiloppsummeringen viser
  feilene når skjemaet sendes.
- Lenkene i hover-teksten peker på `lo-tek.sobernetics.no`.

## 0.6.0

- `lt-progress` finnes. Framdriftsstolpen kom i pakkens 0.27.0.

## 0.5.1

- Hover-teksten for fire klasser sa «én klasse» om en komponent med to.
  Beskrivelsene leses fra komponentsidenes frontmatter, og de fire var gale der.

## 0.5.0

- `lt-theme-control` finnes. Klassen kom i pakkens 0.26.0 og lar brukeren velge
  tema uten JavaScript. Den bor i `tokens.css` og ikke i en komponentmappe, og
  klasselista leste bare komponentmappene: en gul strek sa at klassen ikke
  fantes, på markup som var riktig.

## 0.4.0

Klassene og forklaringene er i takt med pakken igjen.

- `lt-dialog__header` og `lt-dialog__subtitle` finnes. De kom med den fargede
  toppen i dialogen, og 0.3.0 kjente dem ikke: en gul strek sa at klassen ikke
  fantes, på markup som var riktig.
- `<lt-session-timeout>` sender fire hendelser, og hover-teksten nevnte to.
  `session-warn` kommer når dialogen åpner og `session-logout` når brukeren
  logger ut, ved siden av `session-extend` og `session-expired`.
- Forklaringene på `<lt-tabs>`, `<lt-popover>`, `<lt-suggestion>` og
  `<lt-dialog>` sier nå at komponenten kobler fra bar struktur. Fanene trenger
  ikke `role="tablist"` skrevet i malen, sprettoppvinduet klarer seg med en
  knapp og et panel med klassen, og dialogen tar navnet sitt fra den første
  overskriften.
- Diagnostikken kommer fra `@lo-tek/interfaces/diagnostics` framfor fra to
  JSON-filer i utvidelsens egen mappe. Samme regler, og `lotek sjekk` i
  kommandolinjen kjører dem nå på de samme filene.

## 0.3.0

Klassene, hurtigrettelser og malspråkene.

- `lt-`-klassene fullføres inne i `class="…"`, med komponenten og lenken i
  forklaringen, og musa over en klasse gir det samme. En klasse som ikke
  finnes, som `lt-buton`, får en gul strek med den nærmeste kjente som
  forslag.
- Det en klasse tar sjekkes og fullføres: `data-variant` på `lt-button`,
  `data-size` på `lt-heading`, `data-state` på `lt-input`, `data-required`
  på `lt-label`, og de andre. `type` er HTML sitt eget og sjekkes ikke. Listene leses ved å kalle byggefunksjonene i
  `lt`, så de er det pakken faktisk gir, med standardverdien nevnt.
- Hurtigrettelser som lyspære: bytt et navn til det som var ment, ta bort et
  boolsk attributt med `="false"`, sett inn en ledetekst i et felt uten.
- Utvidelsen virker i malspråkene, ikke bare i HTML: PHP, Razor, Astro,
  Svelte, Vue, Twig, Blade, Jinja, Django, Handlebars, ERB, Go-maler, EJS,
  Liquid, Nunjucks og Edge, styrt av innstillingen `lotek.languages`.
  Utenfor HTML fullføres også elementene og attributtene deres av
  utvidelsen selv, og snippetene er med i alle.

## 0.2.0

Utvidelsen sier fra. Til nå kunne du skrive `<lt-dialog-header>` uten at
noen sa at det ikke finnes, for VS Codes fullføring validerer ingenting.

- Feilmeldinger for et element som ikke finnes, et attributt elementet ikke
  har, en verdi utenfor lista, et tall som ikke er et tall, og et boolsk
  attributt med `="false"`. Komponentsiden er lenke i meldingen.
- `<lt-field>` uten kontroll eller uten ledetekst får samme beskjed som i
  nettleseren, med de samme unntakene: `<label for>` utenfor, `aria-label`
  på kontrollen, og et tomt felt som serveren ikke har fylt.
- Snippets ligger øverst i forslagslista i HTML-filer. Før lå Emmets
  forkortelse over dem, og Tab ga `<lt-field></lt-field>` i stedet for
  markupen fra komponentsiden.
- Der det står malsyntaks, Go, Jinja, PHP, ASP, JS-maler eller Razor, holder
  diagnostikken
  seg unna: en mal er ikke hel, og kontrollen kan stå i en partial. HTMX,
  Alpine, Vue, Svelte og Angular sine attributter slipper gjennom.
- Lista diagnostikken sjekker mot, `elements.json`, genereres fra samme
  `metadata.ts` som fullføringen.

## 0.1.0

Første utgave, generert fra `@lo-tek/interfaces` 0.14.0.

- Fullføring og forklaring for de ni `<lt-*>`-elementene og attributtene
  deres, med lenke til komponentsiden.
- Én snippet per element, med markupen fra «Ren HTML»-fanen på
  komponentsiden.
