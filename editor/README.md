# Fristil for VS Code

Fullføring, forklaringer og snippets for `<fs-*>`-elementene i
[Fristil](https://fristil.netlify.app/), i HTML-filer.

Skriver du JSX, trenger du ikke utvidelsen: der kommer det samme fra typene
i `@fristil/designsystem/react-jsx`. Utvidelsen finnes for markup som blir
til uten JavaScript, som en Go-mal, en Razor-visning eller håndskrevet HTML,
der ingen kompilator ser på attributtene.

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

Ingenting her er skrevet for hånd. Filene genereres fra komponentene og
komponentsidene i [repoet](https://github.com/MarkusAugust/fristil), og
bygget der stopper hvis de er utdaterte. Se `CONTRIBUTING.md` i repoet.
