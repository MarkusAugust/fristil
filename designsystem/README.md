# @lo-tek/interfaces

Rammeverksuavhengig designsystem for web: tokens, CSS-komponenter og web components. Alt er bygd på ting nettleseren allerede forstår, så de samme komponentene virker i ren HTML, React, Astro og [Datastar](https://data-star.dev).

> LO-TEK er før 1.0. Et undertall kan ha brytende endringer, og de står under «Brytende» i [versjonsloggen](https://github.com/MarkusAugust/lo-tek/blob/master/designsystem/CHANGELOG.md).

Hele dokumentasjonen, med komponentsider, tokens, mønstre og eksempler for fire miljøer, ligger på **[lo-tek.sobernetics.no](https://lo-tek.sobernetics.no/)**.

**Kodeagenter** finner reglene på [lo-tek.sobernetics.no/llms.txt](https://lo-tek.sobernetics.no/llms.txt), med én regelbok per miljø under [`/agent/`](https://lo-tek.sobernetics.no/coding-agents/). De samme regelbøkene ligger i pakken, i `node_modules/@lo-tek/interfaces/agent/`.

## Installasjon

```bash
npm install @lo-tek/interfaces
```

Pakken har ingen avhengigheter. Web-komponentene er vanlige `HTMLElement`-klasser, og ingenting registreres ved import alene, så du betaler bare for det du faktisk kaller.

## CSS-komponenter

En klasse og noen `data-*`-attributter, ingen JavaScript. `tokens.css` definerer variablene alt annet bygger på, så den må lastes. Den står først av vane; rekkefølgen har ikke noe å si.

Med et byggesteg importerer du bare stilarkene du bruker, så en side med bare knapper ikke laster CSS for en dialog:

```js
import "@lo-tek/interfaces/tokens.css"
import "@lo-tek/interfaces/button.css"
```

Uten et byggesteg lenker du den samlede fila, som har alt i seg:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@lo-tek/interfaces/dist/lotek.css" />
```

Markupen er den samme uansett hvilken av de to du valgte:

```html
<button class="lt-button">Send søknad</button>
<button class="lt-button" data-variant="secondary">Lagre utkast</button>
```

## Attributtene som funksjoner

`lt` gir de samme klassene og attributtene med fullføring og typesjekk i editoren. Hver komponent tar ett objekt med valg og gir attributtene ut:

```js
import { lt } from "@lo-tek/interfaces"

lt.button({ variant: "secondary" })
// { class: "lt-button", "data-variant": "secondary" }
```

I React importerer du fra `@lo-tek/interfaces/react`, som gir `className` og `htmlFor` i stedet for HTML-navnene:

```jsx
import { lt } from "@lo-tek/interfaces/react"

<button {...lt.button({ variant: "secondary" })}>Lagre utkast</button>
```

## Web components

Ingenting registreres ved import alene. Du kaller `defineLt*` selv, så du bestemmer når elementet finnes:

```js
import { defineLtToast } from "@lo-tek/interfaces/toast"
import "@lo-tek/interfaces/tokens.css"
import "@lo-tek/interfaces/toast.css"

defineLtToast()
```

```html
<lt-toast class="lt-toast" role="status" aria-live="polite" aria-atomic="false"
          aria-label="Varsler" data-ignore-morph></lt-toast>
```

Hver `defineLt*` tar også et eget tagnavn, som `defineLtToast("app-toast")`, og flere kall er ufarlige, også ved siden av `defineLt()`. Stilarkene er likevel skrevet for `lt-*`-navnene: en `<lt-field>` registrert som `<min-felt>` kobler fortsatt ledeteksten til feltet, men `display`-regelen på elementnavnet følger ikke med, `<lt-tabs>` og `<lt-suggestion>` skjuler ikke innholdet før registreringen, og `<lt-dialog>` plasserer ikke lenger en dialog som står åpen før den er modal. De fire som setter klassen sin selv, `<lt-toast>`, `<lt-session-timeout>`, `<lt-connection-status>` og `<lt-error-summary>`, ser like ut under et annet navn.

## Serveren skriver markupen

LO-TEK er bygget for apper der HTML-en kommer fra serveren, enten det er TanStack Start, React Server Components eller Datastar. Ingen web-komponent lager noder i markup serveren har sendt, fordi rammeverket rundt da river det bort igjen ved neste oppdatering.

Byggefunksjonene i `lt` gir markupen, komponentene gir oppførselen, og de to overlapper ikke:

```js
import { lt } from "@lo-tek/interfaces"

lt.errorSummary({ count: 2, id: "feil" })
// { host: { class: "lt-error-summary", role: "alert", tabindex: "-1", id: "feil" },
//   title:     { class: "lt-error-summary__title" } }
```

`id` er påkrevd i `lt.field()`, `lt.suggestion()`, `lt.tabs()` og `lt.popover()`, og `titleId` i `lt.dialog()`. `lt.tabs()` og `lt.suggestion()` tar også `keys`, én nøkkel fra dataene per fane eller alternativ, og `lt.tabs()` krever `label`, navnet på raden. Grunnen er hydrering: lager funksjonen id-en selv, lager serveren og nettleseren hver sin, og koblingen mellom delene er brutt til React har rettet den opp. I React kommer den fra `useId()`. I `lt.errorSummary()` er den valgfri, siden den bare navngir boksen slik at noe annet kan peke på den.

Hele begrunnelsen, med testene bak, står på [Markup og oppførsel](https://lo-tek.sobernetics.no/markup-and-behaviour/).

## Eget fargetema

Kommandolinja lager et fullt tema av merkefargene dine, med kontrastkravene regnet ut i OKLCH:

```bash
npx @lo-tek/interfaces tema --aksent=#7c3aed --fare=#b3261e \
  --suksess=#2b6940 --advarsel=#8a5a00 --noytral=#1a1a1a --ut=theme.css
```

Strekker ikke tilpasning gjennom CSS til, kopierer `overta` kildekoden til én komponent inn i prosjektet ditt, med henvisningene skrevet om:

```bash
npx @lo-tek/interfaces overta button --ut=src/ui
```

`npx @lo-tek/interfaces --hjelp` viser resten.

## Tilpasning

Komponentene ligger i `@layer lotek`, så dine egne regler vinner uten `!important`. Bygger du en komponent inn i en side du ikke eier, gir `data-lt-boundary` på rotelementet LO-TEKs stil tilbake der vertens CSS uten lag ellers ville tatt den; se Tilpasning i dokumentasjonen. Form og størrelse leses fra `--lt-*`-variabler med tokenverdien som reserve:

```css
.lt-button {
  --lt-button-padding: var(--lt-spacing-3) var(--lt-spacing-6);
}
```

Tailwind er valgfritt. Temaet er en ren CSS-fil, `@lo-tek/interfaces/tailwind.css`, så pakken har ingen avhengighet til Tailwind og kan ikke komme i konflikt med versjonen din.

## Lisens

MIT
