# @fristil/designsystem

Rammeverksuavhengig designsystem for web: tokens, CSS-komponenter og web components. Alt er bygd på ting nettleseren allerede forstår, så de samme komponentene virker i ren HTML, React, Astro og [Datastar](https://data-star.dev).

> **Dette er en proof of concept.** Ikke et ferdig produkt, ikke aktivt vedlikeholdt, og det kan bli lagt på is. Bruk det til å prøve ut ideen, ikke til noe du må stole på.

Hele dokumentasjonen, med komponentsider, tokens, mønstre og eksempler for fire miljøer, ligger på **[fristil.netlify.app](https://fristil.netlify.app/)**.

## Installasjon

```bash
npm install @fristil/designsystem
```

Det er alt du trenger å installere. `lit` følger med, og brukes av komponentene som er web components.

Bruker du bare CSS-komponentene, havner Lit aldri i bunten din. Ingenting registreres ved import alene, så Lit kommer først med når du kaller en `defineFs*`.

## CSS-komponenter

En klasse og noen `data-*`-attributter, ingen JavaScript. `tokens.css` definerer variablene alt annet bygger på, så den lastes først. Importer bare stilarkene du bruker; det finnes ingen samlet CSS-fil.

```js
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
```

```html
<button class="fs-button">Send søknad</button>
<button class="fs-button" data-variant="secondary">Lagre utkast</button>
```

## Attributtene som funksjoner

`fs` gir de samme klassene og attributtene med fullføring og typesjekk i editoren. Hver komponent tar ett valgobjekt og gir attributtene ut:

```js
import { fs } from "@fristil/designsystem"

fs.button({ variant: "secondary" })
// { class: "fs-button", "data-variant": "secondary" }
```

I React importerer du fra `@fristil/designsystem/react`, som gir `className` og `htmlFor` i stedet for HTML-navnene:

```jsx
import { fs } from "@fristil/designsystem/react"

<button {...fs.button({ variant: "secondary" })}>Lagre utkast</button>
```

## Web components

Ingenting registreres ved import alene. Du kaller `defineFs*` selv, så du bestemmer når elementet finnes og hva det skal hete:

```js
import { defineFsDateField } from "@fristil/designsystem/date-field"
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/date-field.css"

defineFsDateField()
```

```html
<fs-date-field label="Fødselsdato" value="2026-05-31"></fs-date-field>
```

## Eget fargetema

Kommandolinja lager et fullt tema av merkefargene dine, med kontrastkravene regnet ut i OKLCH:

```bash
npx @fristil/designsystem tema --interaktiv=#7c3aed --fare=#b3261e \
  --suksess=#2b6940 --advarsel=#8a5a00 --noytral=#1a1a1a --ut=tema.css
```

Strekker ikke tilpasning gjennom CSS til, kopierer `overta` kildekoden til én komponent inn i prosjektet ditt, med henvisningene skrevet om:

```bash
npx @fristil/designsystem overta button --ut=src/ui
```

`npx @fristil/designsystem --hjelp` viser resten.

## Tilpasning

All CSS ligger i `@layer fristil`, så dine egne regler vinner uten `!important`. Form og størrelse leses fra `--fs-*`-variabler med tokenverdien som reserve:

```css
.fs-button {
  --fs-button-padding: var(--size-3) var(--size-6);
}
```

Tailwind er valgfritt. Temaet er en ren CSS-fil, `@fristil/designsystem/tailwind.css`, så pakken har ingen avhengighet til Tailwind og kan ikke komme i konflikt med versjonen din.

## Lisens

MIT
