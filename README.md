# Fristil Designsystem (POC)

Fristil er en proof of concept for et rammeverksuavhengig designsystem for web.

Prosjektet utforsker tre nivåer som kan brukes hver for seg eller sammen:

- Pure CSS: tokens og klasser for enkel styling uten runtime.
- Light DOM web components: komponenter med logikk og a11y-hjelp, men med vanlig DOM.
- Shadow DOM web components: mer isolerte widgets for kompleks interaksjon.

Målet er å teste retning, arkitektur og utvikleropplevelse, ikke å levere et ferdig produkt.

## Viktig status

Dette er kun en proof of concept.

- Ikke et ferdig produkt.
- Ikke vedlikeholdt aktivt.
- Kan bli lagt på is eller aldri bli ferdigstilt.
- Bidrag fra andre skjer kun etter avtale med eier.

## Monorepo-oversikt

Repoet har to workspaces:

- `designsystem`: selve pakken med tokens, CSS og komponenter.
- `documentation`: Astro/Starlight-dokumentasjon og demoer.

## Kom i gang med pakken

Installer pakken hos en konsument:

```bash
npm install @fristil/designsystem
```

Importer tokens i appen:

```js
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/utilities.css" // valgfri: .link, .srOnly
```

Du kan også bruke konkrete CSS-komponenter direkte:

```js
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/input.css"
import "@fristil/designsystem/field.css"
```

For web components importerer du JS-modulen og registrerer elementet én gang:

```ts
import { defineDsField } from "@fristil/designsystem/field"
import "@fristil/designsystem/field.css"

defineDsField()
```

Tilgjengelige JS-subpaths er blant annet:

- `@fristil/designsystem/button`
- `@fristil/designsystem/label`
- `@fristil/designsystem/input`
- `@fristil/designsystem/textarea`
- `@fristil/designsystem/select`
- `@fristil/designsystem/help-text`
- `@fristil/designsystem/error-text`
- `@fristil/designsystem/field`
- `@fristil/designsystem/date-field`
- `@fristil/designsystem/calendar`
- `@fristil/designsystem/tokens`
- `@fristil/designsystem/tailwind`

## Lokal utvikling

Forutsetninger:

- Bun installert.

1. Installer avhengigheter fra repo-roten:

```bash
bun install
```

2. Bygg `designsystem` én gang før du starter docs:

```bash
bun run build
```

Dette er nødvendig fordi dokumentasjonen bruker subpath-importer som leser fra `designsystem/dist`.

3. Kjør docs i dev-modus (fra repo-roten):

```bash
bun run dev
```

Dette starter dokumentasjonen og bruker lokal workspace-versjon av `@fristil/designsystem`.

4. Når du endrer TypeScript-kode i `designsystem`, bygg pakken på nytt:

```bash
bun run build
```

Bygget genererer `dist/`, som brukes av subpath-imports og dokumentasjon.

5. Nyttige kommandoer:

```bash
# Fra repo-roten
bun run typecheck
bun run lint

# Fra designsystem/
bun run test:browser
```

## Pakkeinnhold

Eksempler på det som eksporteres fra `@fristil/designsystem`:

```ts
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/utilities.css"

import "@fristil/designsystem/button.css"
import { defineDsButton } from "@fristil/designsystem/button"

import "@fristil/designsystem/field.css"
import { defineDsField } from "@fristil/designsystem/field"
```

Tokens finnes både som CSS custom properties og TypeScript-eksporter.

## Legge til ny komponent (internt i repo)

Bruk samme arkitektur som resten av repoet:

- Pure CSS-komponenter legges i `designsystem/src/components/css/<komponent>/`.
- Light DOM-komponenter legges i `designsystem/src/components/ramme/`.
- Shadow DOM-komponenter legges i `designsystem/src/components/sammensatt/`.

Husk å oppdatere exports i `designsystem/package.json` for nye subpaths (både CSS og JS ved behov), og eksporter fra `designsystem/src/index.ts` hvis komponenten skal med i toppnivå-API-et.
