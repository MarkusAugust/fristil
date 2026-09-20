# @fristil/designsystem

Design tokens og komponenter for Fristil — et rammeverksuavhengig designsystem.

Se [dokumentasjonssiden](../documentation) for bruksanvisning. Denne fila handler om å utvikle selve pakken.

---

## Installere

```bash
npm install @fristil/designsystem
```

`lit` og `tailwindcss` er valgfrie `peerDependencies`. `lit` trengs bare hvis du bruker en `ramme`- eller `sammensatt`-komponent.

Importer tokens først — alle andre stilark bygger på dem:

```js
import "@fristil/designsystem/tokens.css"
import "@fristil/designsystem/button.css"
```

---

## Mappestruktur

```
src/
├── index.ts                  # re-eksporterer alt
├── tokens/
│   ├── tokens.ts             # eneste kilde for alle verdier
│   ├── tokens.css            # GENERERT — rediger aldri for hånd
│   └── utilities.css         # .link, .srOnly
├── tailwind/preset.ts
├── testing/                  # hjelpere for tester, bygges ikke
└── components/
    ├── css/                  # CSS-klasse, ingen JavaScript
    ├── ramme/                # web component som kobler dine elementer
    └── sammensatt/           # web component som bygger alt selv
```

Hver komponent har sin egen mappe med CSS, eventuell TypeScript og en `*.browser.test.ts`.

---

## Kommandoer

```bash
bun run generate         # skriver tokens.css fra tokens.ts
bun run build            # generate + tsc -b
bun run typecheck        # tsc --noEmit
bun run typecheck:tests  # typesjekk av testene
bun run test:browser     # Vitest i nettleser via Playwright
```

Fra rot kan du kjøre `bun run test` og `bun run typecheck:tests` i stedet.

---

## Design tokens

`src/tokens/tokens.ts` er den eneste fila som redigeres. Kjør `bun run generate` etterpå — endringer gjort direkte i `tokens.css` blir overskrevet.

Fargene ligger i to lag. Palettfargene (`--palette-azure-70`) er råverdier; de semantiske (`--semantic-interactive-main`) sier hva fargen betyr og peker på en palettfarge. Komponenter skal bruke det semantiske laget, slik at de følger med når paletten justeres.

Avstand og utstrekning går gjennom én skala, `--size-*`. Det finnes ingen egen `--spacing-*`.

---

## Legge til en komponent

### Kategori `css`

For alt der utfordringen er utseende, ikke oppførsel.

**1. Lag CSS-fila** i `src/components/css/min-komponent/min-komponent.css`:

```css
.fs-min-komponent {
	color: var(--semantic-page-foreground);
	padding: var(--size-2) var(--size-4);
	font-size: var(--font-size-m);
	border-radius: var(--size-1);
}

.fs-min-komponent[data-variant="primary"] {
	background: var(--semantic-interactive-main);
	color: var(--palette-graphite-0);
}
```

Bruk alltid tokens. Hardkodede farger og pikselverdier hører ikke hjemme her.

**2. Eksporter fila** i `package.json`:

```json
"./min-komponent.css": "./src/components/css/min-komponent/min-komponent.css"
```

**3. Lag TypeScript-hjelperne** i samme mappe, etter samme form som de andre komponentene:

```ts
// src/components/css/min-komponent/min-komponent.ts
export const MIN_KOMPONENT_CLASS = "fs-min-komponent" as const

export const minKomponentVariants = ["primary", "secondary"] as const

export type MinKomponentVariant = (typeof minKomponentVariants)[number]

export function isMinKomponentVariant(
	value: string,
): value is MinKomponentVariant {
	return (minKomponentVariants as readonly string[]).includes(value)
}

export function getMinKomponentStyleAttributes(
	variant: MinKomponentVariant = "primary",
) {
	if (variant === "primary") {
		return { class: MIN_KOMPONENT_CLASS }
	}
	return { class: MIN_KOMPONENT_CLASS, "data-variant": variant }
}
```

Tre deler hver gang: en type med de gyldige verdiene, en funksjon som lager attributtene, og en vaktfunksjon for verdier som kommer utenfra. Standardvarianten skal ikke gi noe `data-`-attributt.

**4. Eksporter fra `src/index.ts`** og legg inn en `exports`-oppføring for TypeScript-modulen i `package.json`.

### Kategori `ramme`

For komponenter som skal koble sammen elementer utvikleren selv legger inn — typisk tilgjengelighetskobling i skjema.

```ts
// src/components/ramme/min-ramme/fs-min-ramme.ts
import { html, LitElement } from "lit"

export const FS_MIN_RAMME_TAG = "fs-min-ramme" as const

export class FsMinRamme extends LitElement {
	static properties = {
		invalid: { type: Boolean, reflect: true },
	}

	invalid = false

	// Vanlig DOM: elementene må være synlige for FormData og testverktøy
	createRenderRoot() {
		return this
	}

	render() {
		return html`<slot @slotchange=${this.handleSlotChange}></slot>`
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"fs-min-ramme": FsMinRamme
	}
}

export function defineFsMinRamme(tagName = FS_MIN_RAMME_TAG): void {
	if (!customElements.get(tagName)) {
		customElements.define(tagName, FsMinRamme)
	}
}
```

To ting er viktige her. `createRenderRoot()` returnerer `this`, slik at innholdet blir liggende i vanlig DOM. Og registreringen skjer i en eksportert `defineFs*`-funksjon, ikke med `@customElement`-dekoratoren — da bestemmer konsumenten når elementet registreres, og biblioteket får ingen bivirkninger ved import.

### Kategori `sammensatt`

For komponenter som bygger alt selv, der flere deler må holdes i synk.

Shadow DOM er et valg per komponent, ikke noe kategorien krever. La `createRenderRoot()` stå urørt når komponenten skal skjermes — som `fs-calendar` — og returner `this` når skjemaelementene må være synlige utenfra, som i `fs-date-field`.

```ts
export class FsMinWidget extends LitElement {
	static properties = {
		open: { type: Boolean, reflect: true },
	}

	open = false

	static styles = css`
		:host {
			display: block;
			background: var(--semantic-page-background);
			border: 1px solid var(--semantic-divider-30);
			padding: var(--size-4);
		}
	`
}
```

CSS-variabler arves gjennom skyggegrensen, så tokens fra `:root` fungerer inne i `css\`\`` uten videre.

---

## Navnekonvensjoner

| Ting | Form | Eksempel |
| --- | --- | --- |
| CSS-klasse | `fs-` + kebab-case | `fs-date-field` |
| Egendefinert element | `fs-` + kebab-case | `<fs-date-field>` |
| Klasse | `Fs` + PascalCase | `FsDateField` |
| Registreringsfunksjon | `defineFs` + PascalCase | `defineFsDateField()` |
| Tagg-konstant | `FS_` + SCREAMING_SNAKE | `FS_DATE_FIELD_TAG` |
| Variant | `data-variant` | `data-variant="secondary"` |
| Tilstand | `data-state` | `data-state="invalid"` |

---

## Tester

Hver komponent har en `*.browser.test.ts` ved siden av seg, som kjøres i ekte Chromium via Playwright:

```bash
bun run test:browser
```

Test det komponenten lover utad — klasser, attributter, `aria-*`-koblinger og hendelser — ikke interne detaljer.

### Tilgjengelighetstester

Systemet lover at tilgjengelighet er løst sentralt. Hver komponent har derfor
en test som kjører axe mot WCAG 2.1 nivå A og AA:

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

`monter` setter opp en flate med designsystemets sidefarger. Den delen er
ikke pynt: axe regner ut kontrast ved å lete oppover etter en bakgrunnsfarge,
og finner den ingen, melder den «incomplete» i stedet for å gi et svar.

Skriv markupen slik komponenten faktisk skal brukes — et felt med ledetekst,
et merke med tekst i. Tester du markup ingen ville skrevet, tester du
ingenting.

Axe fanger kontrast, manglende ledetekster og feil bruk av `aria-*`. Den
fanger ikke fokushåndtering. Flytter komponenten fokus — slik `fs-calendar`
gjør når panelet lukkes — må det ha sin egen test.

---

## Dokumentasjon

Nye komponenter trenger en side under `documentation/src/content/docs/components/`, og en oppføring i sidebaren i `documentation/astro.config.mjs`. Har komponenten et eget stilark, må det også inn i `customCss` samme sted, ellers mangler stilene i eksemplene.

Dokumentasjonen er på norsk. Se språkavsnittet i `.claude/CLAUDE.md` for hva som forventes av tekst og eksempler.
