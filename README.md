# LO-TEK Designsystem

LO-TEK er et rammeverksuavhengig designsystem for web. Komponentene er CSS-klasser og web components, altså ting nettleseren allerede forstår. Et designsystem bundet til ett rammeverk må skrives om når rammeverket byttes ut. Nettleserens egne API-er byttes ikke ut.

**Skal du bruke LO-TEK i en app, står alt i [dokumentasjonen](https://lo-tek.sobernetics.no/).** Der ligger installasjon, komponentsidene, tokens, tilpasning, Tailwind-oppsettet og eksempler for ren HTML, React, Astro og Datastar. Denne fila handler om å jobbe med LO-TEK, ikke om å bruke det.

**Kodeagenter** finner reglene på [lo-tek.sobernetics.no/llms.txt](https://lo-tek.sobernetics.no/llms.txt), med én regelbok per miljø under [`/agent/`](https://lo-tek.sobernetics.no/coding-agents/). De samme regelbøkene ligger i pakken, i `node_modules/@lo-tek/interfaces/agent/`.

## Status

LO-TEK er før 1.0. Et undertall kan ha brytende endringer, og de står under
«Brytende» i [versjonsloggen](designsystem/CHANGELOG.md).

Bidrag fra andre skjer kun etter avtale med eier.

### Planlagt

Det som kommer, og i hvilken rekkefølge, står på
[veikartet](https://lo-tek.sobernetics.no/roadmap/). Siden ligger i
`documentation/src/content/docs/roadmap.mdx`, og den er det eneste stedet
planene står, så README og dokumentasjon ikke kan si noe ulikt.

## Repoet

Bun-monorepo med tre workspaces, og ett Gradle-prosjekt ved siden av:

| Workspace | Pakke | Innhold |
| --- | --- | --- |
| `designsystem/` | `@lo-tek/interfaces` | tokens, CSS-komponenter, web components, temageneratoren |
| `documentation/` | `@lo-tek/documentation` | Astro 6 + Starlight, demoene og sjekkene av dem |
| `editor/` | `interfaces` | VS Code-utvidelsen: fullføring, snippets og diagnostikk |
| `editor-intellij/` | ikke en bun-workspace | IntelliJ-pluginen, bygget med Gradle |

Komponentene ligger under `designsystem/src/components/`, delt i tre kategorier etter hvem som lager markupen og om en web-komponent legger oppførsel på den:

- `css/<komponent>/`: en klasse og `data-*`-attributter, ingen JavaScript.
- `frame/<komponent>/`: web component som kobler sammen elementene du selv legger inn, som `<lt-field>`.
- `standalone/<komponent>/`: web component som lager alt innholdet sitt selv, fordi det ikke finnes noe for serveren å sende, som `<lt-connection-status>`.

Ingen komponent bruker shadow DOM. Kategorien sier hvem som lager nodene: den som rendrer, eller web-komponenten selv. Mer om hvordan en ny komponent legges til står under [Ny komponent](#ny-komponent), og om arbeidsflyten i [CONTRIBUTING.md](CONTRIBUTING.md).

## Lokal utvikling

Forutsetning: Bun og Rust ([rustup](https://rustup.rs)). `bun run check` krever også Java 17 eller nyere, se [CONTRIBUTING.md](CONTRIBUTING.md).

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
bun run check            # stegene i ci.yml, i samme rekkefølge som CI
```

Nettleserne hentes med `bun --filter @lo-tek/interfaces browsers`.

## Arbeidsflyt

`master` er beskyttet og skal alltid være grønn, så alt arbeid går gjennom en gren og en pull request. Kjør `bun run check` før du sender noe fra deg. Hele flyten, inkludert hvordan en versjon slippes, står i [CONTRIBUTING.md](CONTRIBUTING.md). Endringer en konsument merker, skrives inn i [designsystem/CHANGELOG.md](designsystem/CHANGELOG.md) i samme pull request.

## Ny komponent

1. Lag mappa under riktig kategori, med komponenten, stilarket og en `*.browser.test.ts` ved siden av.
2. Legg til `exports`-oppføringer i `designsystem/package.json`, både CSS og JS.
3. Eksporter fra `designsystem/src/index.ts` hvis den skal med i `lt`.
4. Legg byggefunksjonen inn i `designsystem/src/react.ts`, med React-navnene på attributtene.
5. Deklarer elementet og egenskapene i `designsystem/src/jsx/react.ts`.
6. Legg stilarket inn i `STILARK` i `documentation/src/components/Preview.astro`, ellers mangler stilene i eksemplene.
7. Skriv komponentsiden under `documentation/src/content/docs/components/` og legg den i sidebaren i `documentation/astro.config.mjs`.

Steg 4 og 5 er ikke valgfrie: `react.browser.test.ts` krever at hver funksjon i `lt` finnes i `/react`, og en test leser `static observedAttributes` fra komponentene og krever at hvert attributt er deklarert for JSX.

Åtte sjekker holder dette på plass, og de kjøres av `bun run check`:

| Sjekk | Hva den krever |
| --- | --- |
| `package-css.browser.test.ts` | Alt utenom grensen mot en vertsside ligger i `@layer lotek`, ingenting står etter laget, alle klasser er `lt-`-prefikset i kebab-case, og hvert token en reserve peker på finnes |
| `lt.browser.test.ts` | Hver byggefunksjon i `lt` gir en klasse og ingen `undefined`-attributter |
| `check-exports.ts` | Alt `exports` lover blir med i tarballen, ingen testfiler gjør det, og hvert kart i pakken peker på en fil som er med |
| `check-types.ts` | Hver inngang til web-komponentene typer `querySelector` og `addEventListener` alene, også `/register` og `/react-jsx` |
| `check-documentation.ts` | Komponenten har en side som nevner hver klasse og hver `--lt-`-variabel den har, som hele ord |
| `check-test-files.ts` | Komponentmappa har minst én `*.browser.test.ts` |
| `react.browser.test.ts` | Hver byggefunksjon finnes i `/react`, og ingen sender ut et attributt React staver annerledes |
| `check-writes.ts` | All skriving i en `ramme`-komponent går gjennom `setAttr`, `setFlag` og `addClass` |

### Navnekonvensjoner

| Ting | Form | Eksempel |
| --- | --- | --- |
| CSS-klasse | `lt-` + kebab-case | `lt-session-timeout` |
| Web component | `lt-` + kebab-case | `<lt-session-timeout>` |
| Klasse | `Lt` + PascalCase | `LtSessionTimeout` |
| Registreringsfunksjon | `defineLt` + PascalCase | `defineLtSessionTimeout()` |
| Tagg-konstant | `LT_` + SCREAMING_SNAKE | `LT_SESSION_TIMEOUT_TAG` |
| Variant | `data-variant` | `data-variant="secondary"` |
| Tilstand | `data-state` | `data-state="invalid"` |

### To ting som er lette å gjøre feil

**Bruk alltid tokens i CSS:** `var(--lt-color-…)`, `var(--lt-spacing-…)`. Hardkodede farger og pikselverdier hører ikke hjemme i en komponent.

**Registrer web components i en eksportert `defineLt*`-funksjon**, som går gjennom `defineElement`. Da bestemmer konsumenten når elementet registreres, pakken får ingen bivirkninger ved import, og modulen kan lastes på en server uten DOM.

## Tokens

`tokens.css` er generert, og endringer gjort direkte i den blir overskrevet. Kilden er `designsystem/src/tokens/tokens.ts` for alt som ikke er farge. Fargene har ingen verdi skrevet noe sted: merkefargene, lyshetene per rolle og løftene står i `src/tokens/color-contract.json`, og kjernen i `core/` regner fargene av dem. Skal du flytte en farge, er det den fila du redigerer:

```bash
bun --filter @lo-tek/interfaces generate
```

Fargene er en matrise av **familie**, altså hva fargen betyr, og **rolle**, altså hva den gjør. Navnet er `--lt-color-<familie>-<rolle>`, som `--lt-color-danger-fill`. Hver familie har hver rolle, og rollen bestemmer lysheten, så kontrasten kan garanteres uansett merkefarge.

Merk forskjellen på `disabled` og `neutral`. `disabled` er for kontroller som er slått av, og er unntatt kontrastkravet i WCAG 1.4.3. `neutral` er for dempet informasjon brukeren faktisk skal lese eller trykke på, og må holde 4,5:1.

Temageneratoren bygger et helt tema av en konsuments merkefarger. Den er skrevet i Rust, i `core/src/theme/`, og når JavaScript gjennom `@lo-tek/interfaces/theme`. Løftene den må holde, står i `src/tokens/color-contract.json`, og de samme løftene sjekker LO-TEKs egne farger. Testene for kontrakten står i `core/src/theme/tests.rs`.

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
		<span class="lt-min-komponent">Innhold</span>
		<span class="lt-min-komponent" data-variant="primary">Innhold</span>
	`)

	await ventPaTegning()
	await forventIngenTilgjengelighetsbrudd()
})
```

`monter` setter opp en flate med designsystemets sidefarger. Den delen er ikke pynt: axe regner ut kontrast ved å lete oppover etter en bakgrunnsfarge, og finner den ingen, melder den «incomplete» i stedet for å gi et svar.

Skriv markupen slik komponenten faktisk skal brukes, med ledetekst på feltet og tekst i merket. Tester du markup ingen ville skrevet, tester du ingenting. Axe fanger kontrast, manglende ledetekster og feil bruk av `aria-*`. Den fanger ikke fokushåndtering, så flytter komponenten fokus, trenger det sin egen test.

### Sjekkene mot dokumentasjonen

Komponenttestene kjører mot komponentene isolert, og fanger derfor ikke feil som oppstår først når de settes inn på en side. `bun run test:docs` kjører mot den bygde siden: axe i begge temaer, at dokumentasjonen nevner det koden har, at demoene på mønstersidene fortsatt virker, og at ingenting havner utenfor skjermen på en telefon.

## Lisens og navn

LO-TEK er utgitt under MIT. Det koster ingenting, og hver versjon som er sluppet forblir MIT:
den tillatelsen kan ikke trekkes tilbake, heller ikke av meg. Du kan bruke det kommersielt,
endre det og sende det med i et lukket produkt. Det eneste vilkåret er at copyright-notisen
følger med.

Navnet LO-TEK og merket er ikke en del av den tillatelsen. Du står fritt til å forke koden, men
ikke til å kalle resultatet LO-TEK eller publisere under det navnet.

Bidrag: issues er alltid velkomne. Pull requests tas imot etter en samtale først, og den som
bidrar signerer [CLA.md](CLA.md). Hele bildet står i [dokumentasjonen](https://lo-tek.sobernetics.no/licence/).

---

<a href="https://sobernetics.no">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/sobernetics-dark.svg">
    <img alt="Søbernetics" src=".github/sobernetics-light.svg" height="18">
  </picture>
</a>
