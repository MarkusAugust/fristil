# LO-TEK for VS Code

Fullføring, forklaringer, snippets, feilmeldinger og hurtigrettelser for
[LO-TEK](https://lo-tek.sobernetics.no/): `<lt-*>`-elementene, `lt-`-klassene
og variantene deres, i HTML og i malspråkene.

Skriver du JSX, trenger du ikke utvidelsen: der kommer det samme fra typene
i `@lo-tek/interfaces/react-jsx`. Utvidelsen finnes for markup som blir
til uten JavaScript, som en Go-mal, en Razor-visning eller håndskrevet HTML,
der ingen kompilator ser på attributtene.

## Slik kommer du i gang

1. **Installer utvidelsen.** Søk etter «LO-TEK» under Extensions i VS Code,
   eller kjør `code --install-extension lo-tek.interfaces`.
2. **Installer LO-TEK i appen.** Pakken har ingen avhengigheter:

   ```bash
   npm install @lo-tek/interfaces
   ```

   Ta med tokens og stilarket til det du bruker, og registrer
   web-komponentene du bruker, én gang for hele appen:

   ```js
   import "@lo-tek/interfaces/tokens.css"
   import "@lo-tek/interfaces/field.css"
   import { defineLtField } from "@lo-tek/interfaces/field"

   defineLtField()
   ```

   Uten byggverktøy hentes de samme filene fra en CDN. Det, og resten, står
   i [kom i gang](https://lo-tek.sobernetics.no/getting-started/).
3. **Skriv markupen.** Åpne en HTML-fil, skriv `<lt-` og velg fra lista, eller
   skriv `lt-field` og trykk Tab for markupen fra komponentsiden. Hold musa
   over et element for forklaringen, og se etter røde og gule streker.

## Det du får

- **Fullføring** av `<lt-field>`, `<lt-popover>` og de andre elementene, med
  attributtene deres og de lovlige verdiene. Inne i `class="…"` fullføres
  `lt-`-klassene, og inne i et attributt en klasse tar, som `data-variant`
  på `lt-button`, fullføres verdiene byggefunksjonen kjenner.
- **Forklaring** når du holder musa over en `lt-`-klasse, og i HTML-filer
  også over et element eller et attributt, med lenke til komponentsiden.
- **Snippets**: skriv `lt-popover`, velg snippeten øverst i lista, og
  markupen fra komponentsiden står der. Id-en er et tabbestopp: skriv den
  én gang, så følger `for` på ledeteksten og `href` på fanene med.
  Utvidelsen setter snippets øverst i HTML-filer, for ellers ligger Emmet
  der: `lt-popover` er også en Emmet-forkortelse, og Tab tar det som ligger
  øverst.
- **Feilmeldinger**, som røde og gule streker med komponentsiden som lenke: et
  `<lt-…>`-element som ikke finnes, et attributt elementet ikke har, en verdi
  utenfor lista, et tall som ikke er et tall, `invalid="false"`, som betyr
  på, en klasse som `lt-buton`, og `data-variant="ghots"` på en knapp. `<lt-field>` uten kontroll eller uten ledetekst får den samme beskjeden
  som komponenten gir i nettleseren, med de samme unntakene, med én grense: en
  `<label for>` utenfor feltet må stå i samme fil, for utvidelsen ser én fil
  om gangen. Kommentarer, skript og stilark leses ikke, og der det står
  malsyntaks, Go, Jinja, PHP, ASP, JS-maler eller Razor, holder den seg unna:
  en mal er ikke hel, og kontrollen kan stå i en partial. Den sjekker også
  det malen må skrive selv for at komponentene skal virke uten JavaScript
  og overleve en oppdatering fra serveren: en ledetekst som verken har
  `for` mot feltet eller står rundt det, et panel i `<lt-popover>` uten id,
  en fane som peker på et panel som ikke finnes, en fanerad uten navn,
  `role="tab"` på noe som ikke er en lenke, hjelpetekst inni `<label>`,
  `data-value` uten `.lt-suggestion__value`, en skjult feilmelding ved siden
  av `aria-invalid="true"`, de utgåtte attributtene på `<lt-field>`, og en
  id komponenten lagde selv, kopiert inn fra DevTools. Der id-en er bundet,
  som `:id`, `th:id` eller `asp-for`, tier den.

- **Hurtigrettelser** der det finnes ett riktig svar: lyspæra bytter
  `lt-buton` til `lt-button` og `onlinetext` til `online-text`, tar bort
  `invalid="false"` og de utgåtte attributtene, setter inn en ledetekst i et
  felt som mangler en, gir raden et navn, og gir feltet id og ledeteksten
  `for` i ett grep, fra feltets `name`.

Det utvidelsen ikke gjør, er å validere HTML. En `</body>` for mye er en
jobb for en HTML-linter, og LO-TEK sier bare fra om LO-TEK.

## Malspråkene

Feilmeldingene, hurtigrettelsene, klassene og hover virker i PHP, Razor,
Astro, Svelte, Vue, Twig, Blade, Jinja, Django, Handlebars, ERB, Go-maler,
EJS, Liquid, Nunjucks og Edge, og i HTML. Lista er innstillingen
`lotek.languages`, med VS Code sine språk-id-er, og kan endres. Utenfor
HTML fullføres også `<lt-…>`-elementene og attributtene deres av utvidelsen
selv, siden VS Codes egen HTML-tjeneste bare er med i HTML-filer.

Filer med en annen endelse enn språket ventet kan knyttes til det i
innstillingene, for eksempel `"files.associations": { "*.gohtml": "html" }`.

## JetBrains

Bruker du IntelliJ IDEA Ultimate eller WebStorm, trenger du ingen utvidelse:
fra 0.15.0 har npm-pakken med `web-types.json`, JetBrains sitt format, og
IDE-en tar den i bruk så snart `@lo-tek/interfaces` står i
`package.json`. Etterprøvd i IntelliJ IDEA Ultimate 2026.2, med fullføring av elementene, attributtene
og verdiene, og forklaring med lenke. Feilmeldingene og hurtigrettelsene
kommer med pluginen «LO-TEK» fra JetBrains Marketplace, som også gir
fullføring i HTML i en streng merket med `@Language("HTML")`. Se `../editor-intellij`. Neovim, Helix
og andre editorer med LSP kan bruke `lotek lsp`.

## Slik lages den

Fullføringen, snippetene og listene diagnostikken sjekker mot genereres fra
komponentene og komponentsidene i
[repoet](https://github.com/MarkusAugust/lo-tek). Elementene kommer fra
`designsystem/scripts/metadata.ts`, klassene fra pakkens CSS, og hva hver klasse tar leses ved å
kalle byggefunksjonene i `lt`, så `data-variant="ghost"` er lovlig fordi
`lt.button({ variant: "ghost" })` gir det. `bun run build` i pakken skriver
filene på nytt før noen sjekk leser dem, og CI feller en endring der det bygget skrev
ikke er committet. Diagnostikken er
en ren funksjon uten VS Code i seg, og `core/scripts/check-diagnostics.ts` kjører
den over hver feiltype den skal fange. Se `CONTRIBUTING.md` i repoet.
