# Fristil Designsystem

Fristil er et rammeverksuavhengig designsystem for web. Komponentene er CSS-klasser og web components, altså ting nettleseren allerede forstår. Et designsystem bundet til ett rammeverk må skrives om når rammeverket byttes ut. Nettleserens egne API-er byttes ikke ut.

**Skal du bruke Fristil i en app, står alt i [dokumentasjonen](https://fristil.sobernetics.no/).** Der ligger installasjon, komponentsidene, tokens, tilpasning, Tailwind-oppsettet og eksempler for ren HTML, React, Astro og Datastar. Denne fila handler om å jobbe med Fristil, ikke om å bruke det.

**Kodeagenter** finner reglene på [fristil.sobernetics.no/llms.txt](https://fristil.sobernetics.no/llms.txt), med én regelbok per miljø under [`/agent/`](https://fristil.sobernetics.no/kodeagenter/). De samme regelbøkene ligger i pakken, i `node_modules/@fristil/designsystem/agent/`.

## Status

Fristil er før 1.0. Et undertall kan ha brytende endringer, og de står under
«Brytende» i [versjonsloggen](designsystem/CHANGELOG.md).

Bidrag fra andre skjer kun etter avtale med eier.

### Planlagt

Det som kommer, og i hvilken rekkefølge, står på
[veikartet](https://fristil.sobernetics.no/veikart/). Siden ligger i
`documentation/src/content/docs/veikart.mdx`, og den er det eneste stedet
planene står, så README og dokumentasjon ikke kan si noe ulikt.

## Repoet

Bun-monorepo med tre workspaces, og ett Gradle-prosjekt ved siden av:

| Workspace | Pakke | Innhold |
| --- | --- | --- |
| `designsystem/` | `@fristil/designsystem` | tokens, CSS-komponenter, web components, temageneratoren |
| `documentation/` | `@fristil/documentation` | Astro 6 + Starlight, demoene og sjekkene av dem |
| `editor/` | `fristil-vscode` | VS Code-utvidelsen: fullføring, snippets og diagnostikk |
| `editor-intellij/` | ikke en bun-workspace | IntelliJ-pluginen, bygget med Gradle |

Komponentene ligger under `designsystem/src/components/`, delt i tre kategorier etter hvem som lager markupen og om en web-komponent legger oppførsel på den:

- `css/<komponent>/`: en klasse og `data-*`-attributter, ingen JavaScript.
- `ramme/<komponent>/`: web component som kobler sammen elementene du selv legger inn, som `<fs-field>`.
- `frittstaende/<komponent>/`: web component som lager alt innholdet sitt selv, fordi det ikke finnes noe for serveren å sende, som `<fs-connection-status>`.

Ingen komponent bruker shadow DOM. Kategorien sier hvem som lager nodene: den som rendrer, eller web-komponenten selv. Se `.claude/CLAUDE.md`.

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
4. Legg byggefunksjonen inn i `designsystem/src/react.ts`, med React-navnene på attributtene.
5. Deklarer elementet og egenskapene i `designsystem/src/jsx/react.ts`.
6. Legg stilarket inn i `STILARK` i `documentation/src/components/Preview.astro`, ellers mangler stilene i eksemplene.
7. Skriv komponentsiden under `documentation/src/content/docs/components/` og legg den i sidebaren i `documentation/astro.config.mjs`.

Steg 4 og 5 er ikke valgfrie: `react.browser.test.ts` krever at hver funksjon i `fs` finnes i `/react`, og en test leser `static observedAttributes` fra komponentene og krever at hvert attributt er deklarert for JSX.

Seks sjekker holder dette på plass, og de kjøres av `bun run sjekk`:

| Sjekk | Hva den krever |
| --- | --- |
| `pakke-css.browser.test.ts` | Alt utenom grensen mot en vertsside ligger i `@layer fristil`, alle klasser er `fs-`-prefikset i kebab-case, og hvert token en reserve peker på finnes |
| `fs.browser.test.ts` | Hver byggefunksjon i `fs` gir en klasse og ingen `undefined`-attributter |
| `sjekk-eksport.ts` | Alt `exports` lover blir med i tarballen, og ingen testfiler gjør det |
| `sjekk-dokumentasjon.ts` | Komponenten har en side som nevner hver klasse, hver `part` og hver `--fs-`-variabel den har |
| `react.browser.test.ts` | Hver byggefunksjon finnes i `/react`, og ingen sender ut et attributt React staver annerledes |
| `sjekk-skriving.ts` | All skriving i en `ramme`-komponent går gjennom `setAttr`, `setFlag` og `addClass` |

### Navnekonvensjoner

| Ting | Form | Eksempel |
| --- | --- | --- |
| CSS-klasse | `fs-` + kebab-case | `fs-session-timeout` |
| Web component | `fs-` + kebab-case | `<fs-session-timeout>` |
| Klasse | `Fs` + PascalCase | `FsSessionTimeout` |
| Registreringsfunksjon | `defineFs` + PascalCase | `defineFsSessionTimeout()` |
| Tagg-konstant | `FS_` + SCREAMING_SNAKE | `FS_SESSION_TIMEOUT_TAG` |
| Variant | `data-variant` | `data-variant="secondary"` |
| Tilstand | `data-state` | `data-state="invalid"` |

### To ting som er lette å gjøre feil

**Bruk alltid tokens i CSS:** `var(--fs-color-…)`, `var(--fs-spacing-…)`. Hardkodede farger og pikselverdier hører ikke hjemme i en komponent.

**Registrer web components i en eksportert `defineFs*`-funksjon**, som går gjennom `defineElement`. Da bestemmer konsumenten når elementet registreres, pakken får ingen bivirkninger ved import, og modulen kan lastes på en server uten DOM.

## Tokens

`tokens.css` er generert, og endringer gjort direkte i den blir overskrevet. Kilden er `designsystem/src/tokens/tokens.ts` for alt som ikke er farge. Fargene har ingen verdi skrevet noe sted: merkefargene, lyshetene per rolle og løftene står i `src/tokens/fargekontrakt.json`, og kjernen i `kjerne/` regner fargene av dem. Skal du flytte en farge, er det den fila du redigerer:

```bash
bun --filter @fristil/designsystem generate
```

Fargene er en matrise av **familie**, altså hva fargen betyr, og **rolle**, altså hva den gjør. Navnet er `--fs-color-<familie>-<rolle>`, som `--fs-color-danger-fill`. Hver familie har hver rolle, og rollen bestemmer lysheten, så kontrasten kan garanteres uansett merkefarge.

Merk forskjellen på `disabled` og `neutral`. `disabled` er for kontroller som er slått av, og er unntatt kontrastkravet i WCAG 1.4.3. `neutral` er for dempet informasjon brukeren faktisk skal lese eller trykke på, og må holde 4,5:1.

Temageneratoren bygger et helt tema av en konsuments merkefarger. Den er skrevet i Rust, i `kjerne/src/theme/`, og når JavaScript gjennom `@fristil/designsystem/tema`. Løftene den må holde, står i `src/tokens/fargekontrakt.json`, og de samme løftene sjekker Fristils egne farger. Testene for kontrakten står i `kjerne/src/theme/tests.rs`.

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

## Lisens og navn

Fristil er utgitt under MIT. Det koster ingenting, og hver versjon som er sluppet forblir MIT:
den tillatelsen kan ikke trekkes tilbake, heller ikke av meg. Du kan bruke det kommersielt,
endre det og sende det med i et lukket produkt. Det eneste vilkåret er at copyright-notisen
følger med.

Navnet Fristil og merket er ikke en del av den tillatelsen. Du står fritt til å forke koden, men
ikke til å kalle resultatet Fristil eller publisere under det navnet.

Bidrag: issues er alltid velkomne. Pull requests tas imot etter en samtale først, og den som
bidrar signerer [CLA.md](CLA.md). Hele bildet står i [dokumentasjonen](https://fristil.sobernetics.no/lisens/).

---

<a href="https://sobernetics.no">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/sobernetics-dark.svg">
    <img alt="Søbernetics" src=".github/sobernetics-light.svg" height="18">
  </picture>
</a>
