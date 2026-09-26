# Fristil for VS Code

Fullføring, forklaringer, snippets og feilmeldinger for `<fs-*>`-elementene
i [Fristil](https://fristil.netlify.app/), i HTML-filer.

Skriver du JSX, trenger du ikke utvidelsen: der kommer det samme fra typene
i `@fristil/designsystem/react-jsx`. Utvidelsen finnes for markup som blir
til uten JavaScript, som en Go-mal, en Razor-visning eller håndskrevet HTML,
der ingen kompilator ser på attributtene.

## Slik kommer du i gang

1. **Installer utvidelsen.** Søk etter «Fristil» under Extensions i VS Code,
   eller kjør `code --install-extension Fristil.fristil-vscode`.
2. **Installer Fristil i appen.** Pakken har ingen avhengigheter:

   ```bash
   npm install @fristil/designsystem
   ```

   Ta med tokens og stilarket til det du bruker, og registrer
   web-komponentene du bruker, én gang for hele appen:

   ```js
   import "@fristil/designsystem/tokens.css"
   import "@fristil/designsystem/field.css"
   import { defineFsField } from "@fristil/designsystem/field"

   defineFsField()
   ```

   Uten byggverktøy hentes de samme filene fra en CDN. Det, og resten, står
   i [kom i gang](https://fristil.netlify.app/kom-i-gang/).
3. **Skriv markupen.** Åpne en HTML-fil, skriv `<fs-` og velg fra lista, eller
   skriv `fs-field` og trykk Tab for markupen fra komponentsiden. Hold musa
   over et element for forklaringen, og se etter røde og gule streker.

## Det du får

- **Fullføring** av `<fs-field>`, `<fs-popover>` og de andre elementene, med
  attributtene deres og de lovlige verdiene.
- **Forklaring** når du holder musa over et element eller et attributt, med
  lenke til komponentsiden.
- **Snippets**: skriv `fs-popover`, velg snippeten øverst i lista, og
  markupen fra komponentsiden står der. Utvidelsen setter snippets øverst i
  HTML-filer, for ellers ligger Emmet der: `fs-popover` er også en
  Emmet-forkortelse, og Tab tar det som ligger øverst.
- **Feilmeldinger**, som røde og gule streker med komponentsiden som lenke: et
  `<fs-…>`-element som ikke finnes, et attributt elementet ikke har, en verdi
  utenfor lista, et tall som ikke er et tall, og `invalid="false"`, som betyr
  på. `<fs-field>` uten kontroll eller uten ledetekst får den samme beskjeden
  som komponenten gir i nettleseren, med de samme unntakene, med én grense: en
  `<label for>` utenfor feltet må stå i samme fil, for utvidelsen ser én fil
  om gangen. Kommentarer, skript og stilark leses ikke, og der det står
  malsyntaks, Go, Jinja, PHP, ASP, JS-maler eller Razor, holder den seg unna:
  en mal er ikke hel, og kontrollen kan stå i en partial.

Det utvidelsen ikke gjør, er å validere HTML. En `</body>` for mye er en
jobb for en HTML-linter, og Fristil sier bare fra om Fristil.

Filer som ikke heter `.html` får det samme hvis de er knyttet til HTML i
innstillingene, for eksempel `"files.associations": { "*.gohtml": "html" }`.

## Slik lages den

Fullføringen, snippetene og lista diagnostikken sjekker mot genereres fra
komponentene og komponentsidene i
[repoet](https://github.com/MarkusAugust/fristil), fra én og samme
`metadata.ts`, og bygget der stopper hvis de er utdaterte. Diagnostikken er
en ren funksjon uten VS Code i seg, og `scripts/sjekk-diagnostikk.ts` kjører
den over hver feiltype den skal fange. Se `CONTRIBUTING.md` i repoet.
