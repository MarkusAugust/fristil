# Fristil Designsystem (POC)

Fristil er en proof of concept for et rammeverksuavhengig designsystem for web. Komponentene er CSS-klasser og web components, altså ting nettleseren allerede forstår. Et designsystem bundet til ett rammeverk må skrives om når rammeverket byttes ut. Nettleserens egne API-er byttes ikke ut.

**Skal du bruke Fristil i en app, står alt i [dokumentasjonen](https://fristil.netlify.app/).** Der ligger installasjon, komponentsidene, tokens, tilpasning, Tailwind-oppsettet og eksempler for ren HTML, React, Astro og Datastar. Denne fila handler om å jobbe med Fristil, ikke om å bruke det.

## Status

Dette er kun en proof of concept.

- Ikke et ferdig produkt.
- Ikke vedlikeholdt aktivt.
- Kan bli lagt på is eller aldri bli ferdigstilt.
- Bidrag fra andre skjer kun etter avtale med eier.

## Repoet

Bun-monorepo med to workspaces:

| Workspace | Pakke | Innhold |
| --- | --- | --- |
| `designsystem/` | `@fristil/designsystem` | tokens, CSS-komponenter, web components, temageneratoren |
| `documentation/` | `@fristil/documentation` | Astro 6 + Starlight, demoene og sjekkene av dem |

Komponentene ligger under `designsystem/src/components/`, delt i tre kategorier etter hvem som skriver markupen:

- `css/<komponent>/`: en klasse og `data-*`-attributter, ingen JavaScript.
- `ramme/<komponent>/`: web component som kobler sammen elementene du selv legger inn, som `<fs-field>`.
- `frittstaende/<komponent>/`: web component som lager alt innholdet sitt selv, fordi det ikke finnes noe for serveren å sende, som `<fs-session-timeout>`.

Ingen komponent bruker shadow DOM. Kategorien sier hvem som eier DOM-en mens siden lever: serveren, eller komponenten. Se `.claude/CLAUDE.md`.

## Lokal utvikling

Forutsetning: Bun.

```bash
bun install
bun run build   # må kjøres én gang: dokumentasjonen leser fra designsystem/dist
bun run dev     # dokumentasjonssiden
```

Bygget genererer også `tokens.css` fra `tokens.ts`. Endrer du TypeScript eller tokens i pakken, kjør `bun run build` på nytt.

```bash
bun run lint             # Biome, har siste ordet om formatering
bun run typecheck        # tsc -b
bun run typecheck:tests  # testene, som tsc -b ikke leser
bun run test             # nettlesertestene i Chromium, Firefox og WebKit
bun run test:docs        # sjekkene mot den bygde dokumentasjonen
bun run sjekk            # alt det over, i samme rekkefølge som CI
```

Nettleserne hentes med `bun --filter @fristil/designsystem nettlesere`.

## Arbeidsflyt

`master` er beskyttet og skal alltid være grønn, så alt arbeid går gjennom en gren og en pull request. Kjør `bun run sjekk` før du sender noe fra deg. Hele flyten, inkludert hvordan en versjon slippes, står i [CONTRIBUTING.md](CONTRIBUTING.md). Endringer en konsument merker, skrives inn i [designsystem/CHANGELOG.md](designsystem/CHANGELOG.md) i samme pull request.

## Ny komponent

1. Lag mappa under riktig kategori, med komponenten, stilarket og en `*.browser.test.ts` ved siden av.
2. Legg til `exports`-oppføringer i `designsystem/package.json`, både CSS og JS.
3. Eksporter fra `designsystem/src/index.ts` hvis den skal med i `fs`.
4. Legg stilarket inn i `customCss` og i `STILARK` i `documentation/src/components/Preview.astro`, ellers mangler stilene i eksemplene.
5. Skriv komponentsiden under `documentation/src/content/docs/components/` og legg den i sidebaren i `documentation/astro.config.mjs`.

Fire sjekker holder dette på plass, og de kjøres av `bun run sjekk`:

| Sjekk | Hva den krever |
| --- | --- |
| `pakke-css.browser.test.ts` | Alt ligger i `@layer fristil`, alle klasser er `fs-`-prefikset i kebab-case, og hvert token en reserve peker på finnes |
| `fs.browser.test.ts` | Hver bygger i `fs` gir en klasse og ingen `undefined`-attributter |
| `sjekk-eksport.ts` | Alt `exports` lover blir med i tarballen, og ingen testfiler gjør det |
| `sjekk-dokumentasjon.ts` | Komponenten har en side som nevner hver klasse, hver `part` og hver `--fs-`-variabel den har |

### Navnekonvensjoner

| Ting | Form | Eksempel |
| --- | --- | --- |
| CSS-klasse | `fs-` + kebab-case | `fs-session-timeout` |
| Egendefinert element | `fs-` + kebab-case | `<fs-session-timeout>` |
| Klasse | `Fs` + PascalCase | `FsSessionTimeout` |
| Registreringsfunksjon | `defineFs` + PascalCase | `defineFsSessionTimeout()` |
| Tagg-konstant | `FS_` + SCREAMING_SNAKE | `FS_DATE_FIELD_TAG` |
| Variant | `data-variant` | `data-variant="secondary"` |
| Tilstand | `data-state` | `data-state="invalid"` |

### To ting som er lette å gjøre feil

**Bruk alltid tokens i CSS:** `var(--semantic-…)`, `var(--size-…)`. Hardkodede farger og pikselverdier hører ikke hjemme i en komponent.

**Registrer web components i en eksportert `defineFs*`-funksjon**, ikke med `@customElement`-dekoratoren. Da bestemmer konsumenten når elementet registreres, og pakken får ingen bivirkninger ved import.

## Tokens

`designsystem/src/tokens/tokens.ts` er den eneste fila som redigeres. `tokens.css` genereres derfra, og endringer gjort direkte i den blir overskrevet:

```bash
bun --filter @fristil/designsystem generate
```

Fargene ligger i to lag. Palettfargene (`--palette-azure-70`) er råverdier, og de semantiske (`--semantic-interactive-main`) sier hva fargen betyr og peker på en palettfarge. Komponenter bruker det semantiske laget, så de følger med når paletten justeres.

Merk forskjellen på `disabled` og `neutral`. `disabled` er for kontroller som er slått av, og er unntatt kontrastkravet i WCAG 1.4.3. `neutral` er for dempet informasjon brukeren faktisk skal lese eller trykke på, og må holde 4,5:1.

Temageneratoren i `src/tokens/theme.ts` bygger et helt tema av en konsuments merkefarger. Kontrastkravene den må holde, står i `src/testing/kontrast.ts`, og den samme lista måler Fristils egne farger.

## Tester

Hver komponent har en `*.browser.test.ts` ved siden av seg, som kjøres i Chromium, Firefox og WebKit gjennom Playwright. Det er ikke pynt: hele premisset er at vi bruker nettleserens egne API-er, og det er nettopp de som spriker.

Test det komponenten lover utad, altså klasser, attributter, `aria-*`-koblinger og hendelser, ikke interne detaljer.

Hver komponent har også en tilgjengelighetstest som kjører axe mot WCAG 2.1 nivå A og AA:

```ts
import {
	forventIngenTilgjengelighetsbrudd,
	monter,
	ventPaTegning,
} from "../../../testing/a11y"

it("har nok kontrast i alle varianter", async () => {
	monter(`
		<span class="fs-min-komponent">Innhold</span>
		<span class="fs-min-komponent" data-variant="primary">Innhold</span>
	`)

	await ventPaTegning()
	await forventIngenTilgjengelighetsbrudd()
})
```

`monter` setter opp en flate med designsystemets sidefarger. Den delen er ikke pynt: axe regner ut kontrast ved å lete oppover etter en bakgrunnsfarge, og finner den ingen, melder den «incomplete» i stedet for å gi et svar.

Skriv markupen slik komponenten faktisk skal brukes, med ledetekst på feltet og tekst i merket. Tester du markup ingen ville skrevet, tester du ingenting. Axe fanger kontrast, manglende ledetekster og feil bruk av `aria-*`. Den fanger ikke fokushåndtering, så flytter komponenten fokus, trenger det sin egen test.

### Sjekkene mot dokumentasjonen

Komponenttestene kjører mot komponentene isolert, og fanger derfor ikke feil som oppstår først når de settes inn på en side. `bun run test:docs` kjører mot den bygde siden: axe i begge temaer, at dokumentasjonen nevner det koden har, at demoene på mønstersidene fortsatt virker, og at ingenting havner utenfor skjermen på en telefon.

## Dokumentasjonen

Teksten er på norsk (bokmål) og skal lese som om en norsk utvikler har skrevet den. Anglisismer i brødtekst oversettes, overskrifter bruker norsk stor forbokstav bare i første ord, og eksempler skal vise hvordan komponenten faktisk tas i bruk, med import, registrering og realistiske verdier.

Levende eksempler går gjennom `Preview.astro`, som legger innholdet i en shadow root. Uten isolasjonen treffer dokumentasjonssidens egen CSS eksempelet, og du ser ikke lenger det en konsument får.
