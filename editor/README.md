# Fristil for VS Code

Fullføring, forklaringer og snippets for `<fs-*>`-elementene i
[Fristil](https://fristil.netlify.app/), i HTML-filer.

Skriver du TypeScript eller JSX, trenger du ikke utvidelsen: der kommer det
samme fra typene i `@fristil/designsystem`. Utvidelsen finnes for markup som
blir til uten JavaScript, som en Go-mal, en Razor-visning eller håndskrevet
HTML, der ingen kompilator ser på attributtene.

## Det du får

- **Fullføring** av `<fs-field>`, `<fs-popover>` og de andre elementene, med
  attributtene deres og de lovlige verdiene.
- **Forklaring** når du holder musa over et element eller et attributt, med
  lenke til komponentsiden.
- **Snippets**: skriv `fs-popover` og trykk tab, og markupen fra
  komponentsiden står der.

Filer som ikke heter `.html` får det samme hvis de er knyttet til HTML i
innstillingene, for eksempel `"files.associations": { "*.gohtml": "html" }`.

## Slik lages den

Ingenting her er skrevet for hånd. `metadata.ts` har én setning per element,
attributt og verdi, og TypeScript krever at den dekker nøyaktig attributtene
komponenten observerer. `scripts/generate.ts` skriver `fristil.html-data.json`
og `snippets.json` fra den og fra komponentsidene i dokumentasjonen, og
`scripts/sjekk.ts` feiler bygget hvis filene er utdaterte.

Den samme generatoren skriver `web-types.json` inn i npm-pakken, som er
JetBrains sitt format. WebStorm leser den selv fra `node_modules`. Den delen
er skrevet etter beskrivelsen av formatet, og er ikke etterprøvd i en
JetBrains-IDE ennå.

```bash
bun --filter fristil-vscode generate   # skriv filene på nytt
bun --filter fristil-vscode sjekk      # sjekk at de er ferske, og pakk .vsix
```
