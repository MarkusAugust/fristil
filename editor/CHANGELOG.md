# Endringer i Fristil for VS Code

Utvidelsen har sitt eget versjonsnummer. Den følger ikke pakken, siden den
bare endrer seg når et element eller et attributt gjør det.

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
