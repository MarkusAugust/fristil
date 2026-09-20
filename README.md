# Fristil Designsystem (POC)

Fristil er en proof of concept for et rammeverksuavhengig designsystem for web.

Komponentene er CSS-klasser og web components — ting nettleseren allerede forstår. Et designsystem bundet til ett rammeverk må skrives om når rammeverket byttes ut; nettleserens egne API-er byttes ikke ut.

Prosjektet utforsker tre kategorier som kan brukes hver for seg eller sammen:

- **`css`** — klasser og tokens for styling uten JavaScript.
- **`ramme`** — web components som kobler sammen HTML-en du selv legger inn, og tar tilgjengelighetskoblingen.
- **`sammensatt`** — web components som bygger alt selv, for interaksjon som må holde flere deler i synk.

Shadow DOM er et valg per komponent, ikke en egen kategori. Skjemafelt holder seg i vanlig DOM så `FormData` og testverktøy finner dem; innkapslede widgets som kalenderen kan skjermes.

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

`tokens.css` må lastes først — alle andre stilark bygger på variablene der.

Du kan også bruke konkrete CSS-komponenter direkte:

```js
import "@fristil/designsystem/button.css"
import "@fristil/designsystem/input.css"
import "@fristil/designsystem/field.css"
```

For web components importerer du JS-modulen og registrerer elementet én gang når appen starter:

```ts
import { defineFsField } from "@fristil/designsystem/field"
import "@fristil/designsystem/field.css"

defineFsField()
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

Hele komponent-API-et ligger i ett navnerom:

```ts
import { fs } from "@fristil/designsystem"

<button {...fs.button({ variant: "secondary" })}>Lagre utkast</button>
<input {...fs.input({ type: "email", state: "invalid" })} />
```

Hver komponent er en funksjon som tar et valgobjekt og returnerer attributtene du sprer inn i elementet. Formen er lik for alle. Skriv `fs.` i editoren for å se hva som finnes, og `fs.button.` for å se lovlige verdier og vakten som validerer verdier utenfra.

`fs.field()` kobler ledetekst, felt, hjelpetekst og feilmelding, og deler kjerne med `<fs-field>` — kontrakten finnes ett sted. Se «Typesikker bruk» og «Rammeverk» i dokumentasjonen — sistnevnte dekker ren HTML, React, Astro og Datastar.

`@fristil/designsystem/react-jsx` gir `<fs-field>`, `<fs-calendar>` og `<fs-date-field>` typer i JSX — uten den kjenner ikke TypeScript elementene, og attributter som `required-marker` og `help-text` er ukontrollerte strenger.

Bruker du React, importer `fs` fra `@fristil/designsystem/react`. Samme kall, men `className` og `htmlFor` i returverdien — React skriver ellers «Invalid DOM property `class`» i konsollen for hvert element. Vue, Svelte, Solid og Preact tar HTML-navnene som de er.

## Lokal utvikling

Forutsetninger: Bun installert.

1. Installer avhengigheter fra repo-roten:

```bash
bun install
```

2. Bygg `designsystem` én gang før du starter docs:

```bash
bun run build
```

Dette er nødvendig fordi dokumentasjonen bruker subpath-importer som leser fra `designsystem/dist`. Bygget genererer også `tokens.css` fra `tokens.ts`.

3. Kjør docs i dev-modus fra repo-roten:

```bash
bun run dev
```

4. Når du endrer TypeScript-kode eller tokens i `designsystem`, bygg pakken på nytt med `bun run build`.

5. Nyttige kommandoer fra repo-roten:

```bash
bun run typecheck        # tsc -b
bun run typecheck:tests  # typesjekk av testene
bun run test             # nettlesertester, inkludert axe
bun run test:docs        # axe mot den bygde dokumentasjonen, begge temaer
bun run lint             # biome check .
```

## Pakkeinnhold

```ts
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/utilities.css"

// CSS-komponent: stilark pluss typet hjelper
import "@fristil/designsystem/button.css"
import { fs } from "@fristil/designsystem"

// Web component: stilark pluss registreringsfunksjon
import "@fristil/designsystem/field.css"
import { defineFsField } from "@fristil/designsystem/field"
```

Tokens finnes både som CSS custom properties og TypeScript-eksporter.

## Legge til ny komponent

Komponentene ligger under `designsystem/src/components/`, delt etter kategori:

- `css/<komponent>/` — CSS-klasse, ingen JavaScript
- `ramme/<komponent>/` — web component som kobler dine elementer
- `sammensatt/<komponent>/` — web component som bygger alt selv

Husk å oppdatere `exports` i `designsystem/package.json` for nye subpaths, både CSS og JS ved behov, og å eksportere fra `designsystem/src/index.ts` hvis komponenten skal med i toppnivå-API-et. Har komponenten et eget stilark, må det også inn i `customCss` i `documentation/astro.config.mjs`, ellers mangler stilene i eksemplene på dokumentasjonssiden.

### Navnekonvensjoner

| Ting | Form | Eksempel |
| --- | --- | --- |
| CSS-klasse | `fs-` + kebab-case | `fs-date-field` |
| Egendefinert element | `fs-` + kebab-case | `<fs-date-field>` |
| Klasse | `Fs` + PascalCase | `FsDateField` |
| Registreringsfunksjon | `defineFs` + PascalCase | `defineFsDateField()` |
| Tagg-konstant | `FS_` + SCREAMING_SNAKE | `FS_DATE_FIELD_TAG` |
| Variant | `data-variant` | `data-variant="secondary"` |
| Tilstand | `data-state` | `data-state="invalid"` |

### To ting som er lette å gjøre feil

**Bruk alltid tokens i CSS** — `var(--semantic-…)`, `var(--size-…)`. Hardkodede farger og pikselverdier hører ikke hjemme i en komponent.

**Registrer web components i en eksportert `defineFs*`-funksjon**, ikke med `@customElement`-dekoratoren. Da bestemmer konsumenten når elementet registreres, og pakken får ingen bivirkninger ved import.

## Design tokens

`designsystem/src/tokens/tokens.ts` er den eneste fila som redigeres. `tokens.css` genereres derfra, og endringer gjort direkte i den blir overskrevet:

```bash
bun --filter @fristil/designsystem generate
```

Fargene ligger i to lag. Palettfargene (`--palette-azure-70`) er råverdier; de semantiske (`--semantic-interactive-main`) sier hva fargen betyr og peker på en palettfarge. Komponenter skal bruke det semantiske laget, så de følger med når paletten justeres.

Merk forskjellen på `disabled` og `neutral`. `disabled` er for kontroller som er slått av, og er unntatt kontrastkravet i WCAG 1.4.3. `neutral` er for dempet informasjon brukeren faktisk skal lese eller trykke på, og må holde 4,5:1.

## Tester

Hver komponent har en `*.browser.test.ts` ved siden av seg, som kjøres i ekte Chromium via Playwright:

```bash
bun run test
```

Test det komponenten lover utad — klasser, attributter, `aria-*`-koblinger og hendelser — ikke interne detaljer.

### Tilgjengelighetstester

Systemet lover at tilgjengelighet er løst sentralt. Hver komponent har derfor en test som kjører axe mot WCAG 2.1 nivå A og AA:

```ts
import {
	forventIngenTilgjengelighetsbrudd,
	monter,
	ventPaTegning,
} from "../../../testing/a11y"

describe("fs-min-komponent tilgjengelighet", () => {
	it("har nok kontrast i alle varianter", async () => {
		monter(`
			<span class="fs-min-komponent">Innhold</span>
			<span class="fs-min-komponent" data-variant="primary">Innhold</span>
		`)

		await ventPaTegning()
		await forventIngenTilgjengelighetsbrudd()
	})
})
```

`monter` setter opp en flate med designsystemets sidefarger. Den delen er ikke pynt: axe regner ut kontrast ved å lete oppover etter en bakgrunnsfarge, og finner den ingen, melder den «incomplete» i stedet for å gi et svar.

Skriv markupen slik komponenten faktisk skal brukes — et felt med ledetekst, et merke med tekst i. Tester du markup ingen ville skrevet, tester du ingenting.

Axe fanger kontrast, manglende ledetekster og feil bruk av `aria-*`. Den fanger ikke fokushåndtering. Flytter komponenten fokus — slik `fs-calendar` gjør når panelet lukkes — må det ha sin egen test.

### Dokumentasjonssiden

Komponenttestene kjører mot komponentene isolert, og fanger derfor ikke feil som oppstår først når de settes inn på en side. Dokumentasjonen for et designsystem er et produkt i seg selv, og har sin egen sjekk:

```bash
bun run build
bun run test:docs
```

Den kjører axe mot hver bygde side i både lyst og mørkt tema.

## Dokumentasjon

Dokumentasjonen er på norsk og skal lese som om en norsk utvikler har skrevet den. Anglisismer i brødtekst oversettes, overskrifter bruker norsk stor forbokstav, og eksempler skal vise hvordan komponenten faktisk tas i bruk — med import, registrering og realistiske verdier.

Nye komponenter trenger en side under `documentation/src/content/docs/components/` og en oppføring i sidebaren i `documentation/astro.config.mjs`.
