# Endringer i @fristil/designsystem

Versjonsnumrene følger [semantisk versjonering](https://semver.org/lang/no/).
Det offentlige API-et er større enn funksjonene pakken eksporterer, så disse
regnes som brytende endringer og krever et nytt hovedtall:

- et klassenavn, et `data-*`-attributt eller en lovlig verdi som forsvinner
  eller endrer betydning,
- et `part`-navn i en komponent med shadow DOM,
- et tokennavn eller en `--fs-*`-variabel,
- en funksjon eller en type i `fs`,
- en oppføring i `exports` i `package.json`.

Nye komponenter, nye valgfrie attributter og rettelser som ikke endrer markup
kommer i et nytt undertall.

## Ikke utgitt

### Rettet

- Lista over valgte filer i `file-upload` brekker nå til flere linjer på smal
  skjerm. Raden var bredere enn en telefon når filnavnet var langt, og knappen
  «Fjern <filnavn>» ble klippet av.

## 0.1.0 (2026-09-21)

Første versjon.

### Lagt til

- **Tokens** for farge, størrelse, typografi, radius og skygge, med semantiske
  navn (`--semantic-*`) over en råskala. Lyst og mørkt tema, og en egen fil for
  Tailwind 4.
- **34 CSS-komponenter** som bare trenger en klasse og `data-*`-attributter:
  accordion, alert, avatar, badge, breadcrumbs, button, card, checkbox, dialog,
  divider, error-text, fieldset, file-upload, heading, help-text, input, label,
  link, list, pagination, paragraph, radio, search, select, skeleton,
  skip-link, spinner, sr-only, switch, table, tag, textarea, toggle-group og
  tooltip.
- **Fire rammekomponenter** som kobler sammen markupen du selv skriver:
  `<fs-field>`, `<fs-error-summary>`, `<fs-popover>` og `<fs-tabs>`.
- **Fire frittstående komponenter** som eier markupen og interaksjonen:
  `<fs-calendar>`, `<fs-date-field>`, `<fs-suggestion>` og `<fs-toast>`.
- **`fs`-API-et**: én funksjon per komponent som tar et valgobjekt og gir
  attributter tilbake, med lovlige verdier og vakt hengt på funksjonen. En egen
  inngang for React (`@fristil/designsystem/react`) med `className` og
  `htmlFor`, og JSX-deklarasjoner for de egendefinerte elementene.
- **`fristil`-kommandoen** som bygger et tema fra egne farger, sjekker
  kontrasten mot WCAG og skriver ut CSS-en.
- **Tilpasning utenfra**: all CSS ligger i `@layer fristil`, form og størrelse
  leses fra `--fs-*`-variabler med tokenverdien som reserve, og komponenten med
  shadow DOM eksponerer delene sine med `::part()`.
