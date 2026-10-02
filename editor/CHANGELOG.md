# Endringer i Fristil for VS Code

Utvidelsen har sitt eget versjonsnummer. Den følger ikke pakken, siden den
bare endrer seg når et element eller et attributt gjør det.

## 0.5.1

- Hover-teksten for fire klasser sa «én klasse» om en komponent med to.
  Beskrivelsene leses fra komponentsidenes frontmatter, og de fire var gale der.

## 0.5.0

- `fs-theme-control` finnes. Klassen kom i pakkens 0.26.0 og lar brukeren velge
  tema uten JavaScript. Den bor i `tokens.css` og ikke i en komponentmappe, og
  klasselista leste bare komponentmappene: en gul strek sa at klassen ikke
  fantes, på markup som var riktig.

## 0.4.0

Klassene og forklaringene er i takt med pakken igjen.

- `fs-dialog__header` og `fs-dialog__subtitle` finnes. De kom med den fargede
  toppen i dialogen, og 0.3.0 kjente dem ikke: en gul strek sa at klassen ikke
  fantes, på markup som var riktig.
- `<fs-session-timeout>` sender fire hendelser, og hover-teksten nevnte to.
  `session-warn` kommer når dialogen åpner og `session-logout` når brukeren
  logger ut, ved siden av `session-extend` og `session-expired`.
- Forklaringene på `<fs-tabs>`, `<fs-popover>`, `<fs-suggestion>` og
  `<fs-dialog>` sier nå at komponenten kobler fra bar struktur. Fanene trenger
  ikke `role="tablist"` skrevet i malen, sprettoppvinduet klarer seg med en
  knapp og et panel med klassen, og dialogen tar navnet sitt fra den første
  overskriften.
- Diagnostikken kommer fra `@fristil/designsystem/diagnostics` framfor fra to
  JSON-filer i utvidelsens egen mappe. Samme regler, og `fristil sjekk` i
  kommandolinjen kjører dem nå på de samme filene.

## 0.3.0

Klassene, hurtigrettelser og malspråkene.

- `fs-`-klassene fullføres inne i `class="…"`, med komponenten og lenken i
  forklaringen, og musa over en klasse gir det samme. En klasse som ikke
  finnes, som `fs-buton`, får en gul strek med den nærmeste kjente som
  forslag.
- Det en klasse tar sjekkes og fullføres: `data-variant` på `fs-button`,
  `data-size` på `fs-heading`, `data-state` på `fs-input`, `data-required`
  på `fs-label`, og de andre. `type` er HTML sitt eget og sjekkes ikke. Listene leses ved å kalle byggefunksjonene i
  `fs`, så de er det pakken faktisk gir, med standardverdien nevnt.
- Hurtigrettelser som lyspære: bytt et navn til det som var ment, ta bort et
  boolsk attributt med `="false"`, sett inn en ledetekst i et felt uten.
- Utvidelsen virker i malspråkene, ikke bare i HTML: PHP, Razor, Astro,
  Svelte, Vue, Twig, Blade, Jinja, Django, Handlebars, ERB, Go-maler, EJS,
  Liquid, Nunjucks og Edge, styrt av innstillingen `fristil.languages`.
  Utenfor HTML fullføres også elementene og attributtene deres av
  utvidelsen selv, og snippetene er med i alle.

## 0.2.0

Utvidelsen sier fra. Til nå kunne du skrive `<fs-dialog-header>` uten at
noen sa at det ikke finnes, for VS Codes fullføring validerer ingenting.

- Feilmeldinger for et element som ikke finnes, et attributt elementet ikke
  har, en verdi utenfor lista, et tall som ikke er et tall, og et boolsk
  attributt med `="false"`. Komponentsiden er lenke i meldingen.
- `<fs-field>` uten kontroll eller uten ledetekst får samme beskjed som i
  nettleseren, med de samme unntakene: `<label for>` utenfor, `aria-label`
  på kontrollen, og et tomt felt som serveren ikke har fylt.
- Snippets ligger øverst i forslagslista i HTML-filer. Før lå Emmets
  forkortelse over dem, og Tab ga `<fs-field></fs-field>` i stedet for
  markupen fra komponentsiden.
- Der det står malsyntaks, Go, Jinja, PHP, ASP, JS-maler eller Razor, holder
  diagnostikken
  seg unna: en mal er ikke hel, og kontrollen kan stå i en partial. HTMX,
  Alpine, Vue, Svelte og Angular sine attributter slipper gjennom.
- Lista diagnostikken sjekker mot, `elements.json`, genereres fra samme
  `metadata.ts` som fullføringen.

## 0.1.0

Første utgave, generert fra `@fristil/designsystem` 0.14.0.

- Fullføring og forklaring for de ni `<fs-*>`-elementene og attributtene
  deres, med lenke til komponentsiden.
- Én snippet per element, med markupen fra «Ren HTML»-fanen på
  komponentsiden.
