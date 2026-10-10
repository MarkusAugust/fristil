# Slik jobber vi i Fristil

## Grener og pull requests

`master` skal alltid være grønn. Derfor går alt arbeid gjennom en gren og en pull request, også små endringer.

```bash
git checkout master && git pull
git checkout -b det-du-jobber-med

# arbeid, og kjør det CI kjører før du sender noe fra deg
bun run sjekk

git push -u origin det-du-jobber-med
gh pr create --fill
```

Grenen kan slås sammen når CI er grønn. GitHub er satt opp til å kreve det, så en rød kjøring stopper knappen.

## `bun run sjekk`

Kjører stegene i `.github/workflows/ci.yml`, i samme rekkefølge og på samme
måte: hvert `run:` med bash og `-eo pipefail`, i mappa steget oppgir.
`scripts/sjekk.ts` leser stegene fra fila, så en ny sjekk i CI kjøres lokalt
fra første dag. Jobbene går etter hverandre:

| Jobb | Hva den kontrollerer |
| --- | --- |
| `forfattere` | at ingen commit har en agent som forfatter |
| `sjekk` | lint, typene, nettlesertestene i Chromium, Firefox og WebKit, bygget, kommandolinja og språkserveren i hver vert, den rendrede siden, VS Code-utvidelsen, at ingenting er ugenerert, og axe mot den bygde dokumentasjonen |
| `kjerne` | Rust-formatering og clippy, Rust-testene, WASI-modulen, kjernen mot fasiten og Kotlin-testene |

Tre ting kjøres ikke lokalt, og står med grunnen i `SKIPPED` i skriptet:
Windows-jobben, oppgraderingen av den globale npm-en, og hentingen av
nettlesere. Står et navn der som ikke finnes i `ci.yml`, stopper kjøringen,
så lista kan ikke bli stående etter at et steg har byttet navn.

«Ingenting er ugenerert» spør git om bygget endret noe, så kjør `sjekk` etter
at endringen er committet. Steget feiler ellers på dine egne endringer.

Det krever Rust, Java 17 eller nyere og VS Code-testens nedlasting i tillegg
til Bun: sjekken i pakken er bygget fra `kjerne/`. Installer
[rustup](https://rustup.rs), og `kjerne/rust-toolchain.toml` henter riktig
versjon ved første kall.

Hele kjøringen tar noen minutter, mest på grunn av de tre nettleserne. Under
arbeid er `bun --filter @fristil/designsystem test:browser --project chromium`
nok. `bun run test -- --project chromium` virker ikke: `bun run` legger
argumentene bakerst i skriptteksten, og `test` er to kommandoer etter
hverandre, så flaggene havner på den siste.

Nettleserne hentes én gang:

```bash
bun --filter @fristil/designsystem nettlesere
```

Bruk den formen, ikke `bunx playwright install`, som kan hente en annen versjon enn den vitest bruker, og heller ikke `bun --filter <pakke> run <skript>`, som gir «No packages matched the filter». Skriptnavnet skal stå uten `run`.

Kan Playwrights nettlesere ikke hentes, uten nett eller bak en brannmur,
kjører `bun --filter @fristil/designsystem test:chromium` testene i en Chrome
eller Chromium som alt står på maskinen. Stien leses fra `CHROMIUM`, ellers
prøves de vanlige stedene. Bare Chromium: Firefox og WebKit må være
Playwrights egne bygg.

## Genererte filer

Fjorten filer skrives av et skript, og en endring rett i dem blir overskrevet ved neste kjøring. De kommer fra to kommandoer.

`bun --filter @fristil/designsystem generate` skriver åtte:

| Fil | Kilde |
| --- | --- |
| `designsystem/src/tokens/tokens.css` | `src/tokens/tokens.ts` og fargematrisen |
| `designsystem/src/tailwind/tailwind.css` | de samme tokenene |
| `designsystem/agent/*.md`, seks regelbøker for kodeagenter | `scripts/generate-agent.ts` og `agent-deler.ts` |

`bun --filter fristil-vscode generate` skriver seks, og tre av dem lander i pakken:

| Fil | Hva den er |
| --- | --- |
| `editor/fristil.html-data.json` | VS Codes format for tagger og attributter |
| `editor/snippets.json` | én snippet per element |
| `designsystem/src/vocabulary/elements.ts` | elementene og attributtene, som manifestet skrives fra |
| `designsystem/src/vocabulary/classes.ts` | hver `fs-`-klasse, lest ved å kalle byggefunksjonene |
| `designsystem/web-types.json` | JetBrains sitt format, følger npm-pakken |
| `editor-intellij/src/main/kotlin/no/fristil/intellij/Klasser.kt` | katalogen IntelliJ-pluginen slår opp i |

Alle seks kommer fra `editor/metadata.ts`, CSS-en og «Ren HTML»-fanene på komponentsidene. De står nærmere beskrevet under [Editorutvidelsen](#editorutvidelsen).

I regelbøkene står prosaen i generatoren, mens listene og tallene leses fra pakken: klassene, elementene, byggefunksjonene og tokennavnene hentes der de faktisk bor, så en regelbok kan ikke stå og love noe som ikke finnes. `sjekk-agent.ts` kontrollerer begge deler.

Glemmer du å regenerere, sier CI fra. Steget «Ingenting er ugenerert» kjører `git status --porcelain` etter bygget og feller hvis bygget endret en sporet fil.

## Versjonslogg og utgivelser

`designsystem/CHANGELOG.md` skrives underveis, ikke ved utgivelse. Endrer du noe en konsument merker, legg linjen under «Ikke utgitt» i samme pull request som endringen. `bun run build` stopper hvis versjonen i `package.json` mangler en overskrift i loggen.

Når en versjon skal ut:

```bash
bun run prepare-version 0.4.0
bun run sjekk
git checkout -b slipp-0.4.0 && git commit -am "Versjon 0.4.0"
git push -u origin slipp-0.4.0 && gh pr create --fill
```

`prepare-version` døper om overskriften «Ikke utgitt» til nummeret og datoen, legger inn en ny tom over, og setter samme nummer i `designsystem/package.json`. Den nekter å sette en versjon som ikke er høyere enn den som står der, og å gi ut en tom «Ikke utgitt».

Taggen settes først når versjonen ligger på master:

```bash
git checkout master && git pull
bun run tag pakke
```

`bun run tag` uten argumenter viser versjonene på commiten og hvilke som er tagget. Med `pakke`, `utvidelse` eller `intellij` (gjerne flere) setter det taggene og dytter dem opp. Det nekter når du ikke står på master slik den er på GitHub, når arbeidstreet har endringer, når taggen finnes fra før, og når versjonen mangler i versjonsloggen. `--prøv` viser hva som ville skjedd.

**Tagg med én gang grenen er slått sammen.** Dokumentasjonen rulles ut av
Netlify i det master endrer seg, og oppskriftene der peker på
`cdn.jsdelivr.net/npm/@fristil/designsystem@<versjon>`, altså på den versjonen
`package.json` oppgir. Den finnes ikke på npm før taggen har kjørt
`publish.yml`. Venter du med taggen, står «Ren HTML»- og Datastar-oppskriftene
på tolv sider og peker på en pakke som ikke er der ennå. Begge byggene tar et par
minutter, så tagger du med det samme, er vinduet i praksis lukket.

Rekkefølgen er ikke til å bytte om på. Tagger du før versjonen er på master, stopper kontrollen i `publish.yml` kjøringen, og taggen må fjernes med `git push origin :refs/tags/v0.4.0` og `git tag -d v0.4.0` før du kan sette den på nytt. `git push` alene sender ingen tagger, så det siste steget kan ikke hoppes over.

Taggen starter `.github/workflows/publish.yml`, som bygger pakken og legger den ut på npm. Arbeidsflyten har ingen hemmeligheter i seg: den ber npm om en kortlevd legitimasjon gjennom GitHubs OIDC, og det virker bare så lenge pakken har en utgiver registrert under Settings på npmjs.com (GitHub Actions, `MarkusAugust`, `fristil`, `publish.yml`). npm signerer samtidig en attestasjon som viser hvilken commit versjonen kom fra.

Den aller første utgivelsen kan ikke gjøres slik, for en utgiver kan bare kobles til en pakke som alt finnes. Den gjøres fra maskinen, med `npm login` først:

```bash
cd designsystem && npm publish --access public
```

En versjon kan aldri publiseres på nytt eller overskrives, og `npm unpublish` er stengt etter 72 timer. Skal en versjon ut av sirkulasjon, er `npm deprecate` veien.

Hovedtallet skal opp når et klassenavn, et `data-*`-attributt, et `part`-navn, et tokennavn, en `--fs-*`-variabel, en funksjon i `fs` eller en oppføring i `exports` forsvinner eller endrer betydning. Reglene står øverst i versjonsloggen, og er det leseren av pakken forholder seg til.

## Editorutvidelsen

`editor/` er VS Code-utvidelsen. `package.json` peker på
`fristil.html-data.json` og `snippets.json`, som gir fullføring og snippets
uten kode, og på `dist/extension.js`, som kobler sjekken til editoren med
streker, lyspærer, fullføring og hover. Sjekken er Rust-kjernen i `kjerne/`,
bygget til WebAssembly. Den samme modulen ligger i pakken, som
`@fristil/designsystem/diagnostics` og `fristil sjekk`, og utvidelsen har en
kopi i `dist/`. Kjernen sjekker mot manifestet, som skrives fra
`designsystem/src/vocabulary/elements.ts` og `classes.ts`. `classes.ts` leses
fra pakkens CSS og fra byggefunksjonene i `fs`, kalt én gang per variant, så
en ny variant er med når `fs` gir den. Filene genereres fra
`editor/metadata.ts`, CSS-en og «Ren HTML»-fanene på komponentsidene,
sammen med `designsystem/web-types.json` for JetBrains. Endrer du et
attributt på en komponent, stopper typesjekken til `metadata.ts` har en
setning om det, og `bun run build` stopper til filene er generert på nytt:

```bash
bun --filter fristil-vscode generate
```

Kjernen har ingen VS Code i seg, og `scripts/sjekk-diagnostikk.ts`
kjører den over hver feiltype den skal fange, snippetene medregnet som rene
tilfeller. Legger du til en regel i `kjerne/src/`, legg til tilfellet som feller den, og se
at det faktisk feller ved å skru regelen av. Se `kjerne/README.md`. `bun --filter fristil-vscode
sjekk` kjører begge sjekkene, bygger `dist/extension.js` og pakker
`fristil.vsix`.

Utvidelsen har sitt eget versjonsnummer i `editor/package.json` og sin egen
logg i `editor/CHANGELOG.md`, og gis ut med en egen tagg:

```bash
bun run tag utvidelse
```

Taggen starter `.github/workflows/publiser-utvidelse.yml`. Marketplace har
ingen OIDC, så arbeidsflyten trenger hemmeligheten `VSCE_PAT`: et personlig
token fra Azure DevOps med rettigheten «Marketplace: Manage», laget av den
som eier utgiveren `fristil` på marketplace.visualstudio.com. Utgiveren må
opprettes der før første utgivelse.

## Dokumentasjonen

Teksten er på norsk bokmål og skal lese som om en norsk utvikler har skrevet
den. Anglisismer i brødtekst oversettes, overskrifter har stor forbokstav
bare i første ord, og eksempler skal vise hvordan komponenten faktisk tas i
bruk, med import, registrering og realistiske verdier.

Levende eksempler går gjennom `Preview.astro`, som legger innholdet i en
shadow root. Uten isolasjonen treffer dokumentasjonssidens egen CSS
eksempelet, og du ser ikke lenger det en konsument får.

## Commit-meldinger

På norsk, i imperativ, uten prefiks: «Rett fokus i feiloppsummeringen», ikke «fix: …». Brødteksten forklarer hvorfor, ikke hva diffen allerede viser.

## Forfatter

Commits skrives alltid i eierens navn, `MASK <m.a.sobergklyver@gmail.com>`, også når en kodeagent har skrevet koden. En agent skal aldri stå som forfatter eller committer, og meldingen skal ikke ha linjer som gir den æren: ingen `Co-Authored-By: Claude …`, ingen `Claude-Session: …` og ingen «Generated with Claude Code». Det samme gjelder beskrivelsen av en PR, og regelen går foran det et verktøy ellers ber om.

Sjekk identiteten før første commit, særlig i et nytt miljø som en sky-økt:

```bash
git config user.name "MASK"
git config user.email "m.a.sobergklyver@gmail.com"
```

CI-jobben **Forfattere** (`bun run sjekk:forfattere`) går gjennom hele historikken og feiler på begge deler. Grener får beskrivende navn, ikke `claude/…`.

## Når CI er rød på master

Det skal ikke skje, men skjer det: lag en gren med fiksen, åpne PR, og la CI bekrefte at den virker før du slår sammen. Ikke push rett til master for å fikse raskt. En feil i selve arbeidsflyten vises bare i en kjøring, og en kjøring får du bare gjennom en PR eller en push til master.
