# @fristil/designsystem

Rammeverksuavhengig designsystem for web: tokens, CSS-komponenter og web components. Alt er bygd på ting nettleseren allerede forstår, så de samme komponentene virker i ren HTML, React, Astro og [Datastar](https://data-star.dev).

> **Dette er en proof of concept.** Ikke et ferdig produkt, ikke aktivt vedlikeholdt, og det kan bli lagt på is. Bruk det til å prøve ut ideen, ikke til noe du må stole på.

Hele dokumentasjonen, med komponentsider, tokens, mønstre og eksempler for fire miljøer, ligger på **[fristil.netlify.app](https://fristil.netlify.app/)**.

## Installasjon

```bash
npm install @fristil/designsystem
```

Pakken har ingen avhengigheter. Web-komponentene er vanlige `HTMLElement`-klasser, og ingenting registreres ved import alene, så du betaler bare for det du faktisk kaller.

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
import { defineFsSessionTimeout } from "@fristil/designsystem/session-timeout"
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/session-timeout.css"

defineFsSessionTimeout()
```

```html
<fs-session-timeout class="fs-session-timeout" warn-at="1500" expires-at="1800"
                    data-ignore-morph></fs-session-timeout>
```

## Serveren skriver markupen

Fristil er bygget for apper der HTML-en kommer fra serveren, enten det er TanStack Start, React Server Components eller Datastar. Ingen komponent rendrer sitt eget innhold i DOM serveren eier, fordi rammeverket rundt da river det bort igjen ved neste oppdatering.

Byggerne i `fs` gir markupen, komponentene gir oppførselen, og de to overlapper ikke:

```js
import { fs } from "@fristil/designsystem"

fs.errorSummary({ count: 2, id: "feil" })
// { container: { class: "fs-error-summary", role: "alert", tabindex: "-1", id: "feil" },
//   title:     { class: "fs-error-summary__title" } }
```

`id` er påkrevd i `fs.field()`, `fs.suggestion()`, `fs.tabs()` og `fs.popover()`, og `titleId` i `fs.dialog()`. Grunnen er hydrering: lager funksjonen id-en selv, lager serveren og nettleseren hver sin, og koblingen mellom delene er brutt til React har rettet den opp. I React kommer den fra `useId()`. I `fs.errorSummary()` er den valgfri, siden den bare navngir boksen slik at noe annet kan peke på den.

Hele begrunnelsen, med testene bak, står på [Markup og oppførsel](https://fristil.netlify.app/markup-og-oppforsel/).

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
