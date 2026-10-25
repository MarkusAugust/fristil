# Slik jobber vi i LO-TEK

## Grener og pull requests

`master` skal alltid være grønn. Derfor går alt arbeid gjennom en gren og en pull request, også små endringer.

```bash
git checkout master && git pull
git checkout -b det-du-jobber-med

# arbeid og commit, og kjør så det CI kjører før du sender noe fra deg
git commit -am "Rett …"
bun run check

git push -u origin det-du-jobber-med
gh pr create --fill
```

Grenen kan slås sammen når CI er grønn. GitHub er satt opp til å kreve det, så en rød kjøring stopper knappen.

## `bun run check`

Kjører stegene i `.github/workflows/ci.yml`, i samme rekkefølge og på samme
måte: hvert `run:` med bash og `-eo pipefail`, i mappa steget oppgir.
`scripts/check.ts` leser stegene fra fila, så en ny sjekk i CI kjøres lokalt
fra første dag. Jobbene går etter hverandre:

| Jobb | Hva den kontrollerer |
| --- | --- |
| `forfattere` | at ingen commit har en agent som forfatter |
| `sjekk` | lint, typesjekk av koden og testene, nettlesertestene i Chromium, Firefox og WebKit, bygget, kommandolinja og språkserveren i hver vert, den rendrede siden, VS Code-utvidelsen, at ingenting er ugenerert, og axe mot den bygde dokumentasjonen |
| `kjerne` | Rust-formatering og clippy, Rust-testene, WASI-modulen, kjernen mot fasiten og Kotlin-testene |

Tre ting kjøres ikke lokalt, og står med grunnen i `SKIPPED` i skriptet:
Windows-jobben, oppgraderingen av den globale npm-en, og hentingen av
nettlesere. Står et navn der som ikke finnes i `ci.yml`, stopper kjøringen,
så lista kan ikke bli stående etter at et steg har byttet navn. Stegene med
`uses`, som hurtigbufferne og oppsettet av Java, hoppes også over: de gir
CI-maskinen det maskinen din har fra før. Lokalt brukes altså den Java-en du
har installert. Står det noe i `ci.yml` skriptet ikke forstår, som `env`,
`if` eller `defaults`, stopper det før det kjører noe.

«Ingenting er ugenerert» spør git om bygget endret noe, så kjør `sjekk` etter
at endringen er committet. Steget feiler ellers på dine egne endringer.

Det krever i tillegg til Bun: Rust, siden sjekken i pakken bygges fra
`core/`; Java 17 eller nyere, for jar-en og Kotlin-testene; og nett første
gang, når VS Code lastes ned. På Linux uten skjerm, altså uten `DISPLAY` og
`WAYLAND_DISPLAY` satt, trengs også `xvfb-run`; har maskinen skjerm, kjøres
VS Code på den.
Installer [rustup](https://rustup.rs), og `core/rust-toolchain.toml` henter
riktig versjon og målene ved første kall.

Hele kjøringen tar rundt seks minutter på en Mac med M-brikke. Mest tid går til
nettlesertestene, axe mot dokumentasjonen, språkserveren og jar-en. Under
arbeid er `bun --filter @lo-tek/interfaces test:browser --project chromium`
nok. `bun run test -- --project chromium` virker ikke: `bun run` legger
argumentene bakerst i skriptteksten, og `test` er to kommandoer etter
hverandre, så flaggene havner på den siste.

Nettleserne hentes én gang:

```bash
bun --filter @lo-tek/interfaces browsers
```

Bruk den formen, ikke `bunx playwright install`, som kan hente en annen versjon enn den vitest bruker, og heller ikke `bun --filter <pakke> run <skript>`, som gir «No packages matched the filter». Skriptnavnet skal stå uten `run`.

Kan Playwrights nettlesere ikke hentes, uten nett eller bak en brannmur,
kjører `bun --filter @lo-tek/interfaces test:chromium` testene i en Chrome
eller Chromium som alt står på maskinen. Stien leses fra `CHROMIUM`, ellers
prøves de vanlige stedene. Bare Chromium: Firefox og WebKit må være
Playwrights egne bygg.

## Genererte filer

Filene i de to tabellene under skrives av et skript, og en endring rett i dem blir overskrevet ved neste kjøring. `bun --filter @lo-tek/interfaces generate` skriver alle sammen, i rekkefølgen under, og `bun run build` kjører `generate` rett etter kjernen, før noen sjekk leser filene.

| Fil | Kilde |
| --- | --- |
| `designsystem/src/tokens/matrix-cells.ts` | `src/tokens/color-contract.json` og merkefargene, regnet av kjernen i `scripts/generate-matrix.ts` |
| `designsystem/src/tokens/tokens.css` | `src/tokens/tokens.ts` og fargematrisen |
| `designsystem/src/tailwind/tailwind.css` | de samme tokenene |
| ordforrådet, tabellen under | `scripts/generate-vocabulary.ts` |
| `designsystem/agent/*.md`, regelbøkene for kodeagenter | `scripts/generate-agent.ts` og `agent-parts.ts` |
| `designsystem/manifest/manifest.json`, `build-cases.json` og `files.json` | `scripts/generate-manifest.ts`, fra `src/lt.ts`, ordforrådet og mappene. `files.json` er regelbøkene og komponentfilene kommandolinja leser |

Ordforrådet har i tillegg sin egen kommando, `bun --filter @lo-tek/interfaces vocabulary`, som skriver bare disse, alle i pakken. Editorene leser dem: VS Code-utvidelsen kopierer de to første når den bygges, og IntelliJ-pluginen leser klassene fra prosjektets manifest, med manifestet i Kotlin-pakken som reserve.

| Fil | Hva den er |
| --- | --- |
| `designsystem/html-data.json` | VS Codes format for tagger og attributter |
| `designsystem/snippets.json` | én snippet per element |
| `designsystem/src/vocabulary/elements.ts` | elementene og attributtene, som manifestet skrives fra |
| `designsystem/src/vocabulary/classes.ts` | hver `lt-`-klasse, lest ved å kalle byggefunksjonene |
| `designsystem/web-types.json` | JetBrains sitt format, følger npm-pakken |
| `designsystem/src/components/events.ts` | typene til hendelsene og tagnavnene, som utvider `HTMLElementEventMap` og `HTMLElementTagNameMap` |

Alle seks kommer fra `designsystem/scripts/metadata.ts`, CSS-en og «Ren HTML»-fanene på komponentsidene, gjennom `scripts/generate-vocabulary.ts`. De står nærmere beskrevet under [Editorutvidelsen](#editorutvidelsen).

I regelbøkene står prosaen i generatoren, mens listene og tallene leses fra pakken: klassene, elementene, byggefunksjonene og tokennavnene hentes der de faktisk bor, så en regelbok kan ikke stå og love noe som ikke finnes. `check-agent.ts` kontrollerer begge deler.

Bygget stopper ikke på en utdatert fil: `generate` skriver dem på nytt før noen sjekk leser dem, så `check:vocabulary` og `check:agent` sammenligner alltid med det som nettopp ble skrevet. Glemmer du å regenerere, eller å committe det som ble generert, sier CI fra: steget «Ingenting er ugenerert» kjører `git status --porcelain` etter bygget og feller hvis bygget endret en sporet fil.

## Versjonslogg og utgivelser

`designsystem/CHANGELOG.md` skrives underveis, ikke ved utgivelse. Endrer du noe en konsument merker, legg linjen under «Ikke utgitt» i samme pull request som endringen. `bun run build` stopper hvis versjonen i `package.json` mangler en overskrift i loggen.

Når en versjon skal ut:

```bash
bun run prepare-version 0.4.0
git checkout -b slipp-0.4.0 && git commit -am "Versjon 0.4.0"
bun run check
git push -u origin slipp-0.4.0 && gh pr create --fill
```

Commiten står før `sjekk`, ikke etter: «Ingenting er ugenerert» spør git om bygget endret noe, og `prepare-version` har nettopp skrevet fjorten sporede filer, så kjørt før commiten stopper `sjekk` på dem flere minutter ut i kjøringen.

`prepare-version` døper om overskriften «Ikke utgitt» til nummeret og datoen, legger inn en ny tom over, og setter samme nummer i `designsystem/package.json`, `bun.lock`, `web-types.json`, `kotlin/gradle.properties` og presentasjonen. Til slutt kjører den `generate-agent.ts` og `generate-manifest.ts`, så `designsystem/agent/*.md` og `designsystem/manifest/*.json`, som også har versjonen i seg, står på det nye nummeret i samme commit. Den nekter å sette en versjon som ikke er høyere enn den som står der, og å gi ut en tom «Ikke utgitt», og alle kontrollene står før den skriver noe, så et stoppet forsøk etterlater ingen halvferdige filer.

Taggen settes først når versjonen ligger på master:

```bash
git checkout master && git pull
bun run tag pakke
```

`bun run tag` uten argumenter viser versjonene på commiten og hvilke som er tagget. Med `pakke`, `utvidelse` eller `intellij` (gjerne flere) setter det taggene og dytter dem opp. Det nekter når du ikke står på master slik den er på GitHub, når arbeidstreet har endringer, når taggen finnes fra før, og når versjonen mangler i versjonsloggen. `--prøv` viser hva som ville skjedd.

**Tagg med én gang grenen er slått sammen.** Dokumentasjonen rulles ut av
Netlify i det master endrer seg, og oppskriftene der peker på
`cdn.jsdelivr.net/npm/@lo-tek/interfaces@<versjon>`, altså på den versjonen
`package.json` oppgir. Den finnes ikke på npm før taggen har kjørt
`publish.yml`. Venter du med taggen, står «Ren HTML»- og Datastar-oppskriftene
på tolv sider og peker på en pakke som ikke er der ennå. Begge byggene tar et par
minutter, så tagger du med det samme, er vinduet i praksis lukket.

Rekkefølgen er ikke til å bytte om på. Tagger du før versjonen er på master, stopper kontrollene i `publish.yml` kjøringen: taggen må si det samme som `package.json`, og commiten den står på må være på master. Taggen må da fjernes med `git push origin :refs/tags/v0.4.0` og `git tag -d v0.4.0` før du kan sette den på nytt. `git push` alene sender ingen tagger, så det siste steget kan ikke hoppes over.

Taggen starter `.github/workflows/publish.yml`, som bygger pakken og legger den ut på npm. Arbeidsflyten har ingen hemmeligheter i seg: den ber npm om en kortlevd legitimasjon gjennom GitHubs OIDC, og det virker bare så lenge pakken har en utgiver registrert under Settings på npmjs.com (GitHub Actions, `MarkusAugust`, `lotek`, `publish.yml`). npm signerer samtidig en attestasjon som viser hvilken commit versjonen kom fra.

Den aller første utgivelsen kan ikke gjøres slik, for en utgiver kan bare kobles til en pakke som alt finnes. Den gjøres fra maskinen, med `npm login` først:

```bash
cd designsystem && npm publish --access public
```

En versjon kan aldri publiseres på nytt eller overskrives, og `npm unpublish` er stengt etter 72 timer. Skal en versjon ut av sirkulasjon, er `npm deprecate` veien.

Når npm-pakken er ute, kjører samme arbeidsflyt en jobb til, bygd av den publiserte tarballen: `lotek.wasm` og `lotek.jar` legges ved utgivelsen på GitHub.

Kotlin-pakken går til Maven Central som `io.github.markusaugust:lo-tek-interfaces`, `lo-tek-kotlinx-html`, `lo-tek-cli` og `lo-tek-gradle-plugin`, men ikke av seg selv. Central har et månedlig tak på antall utgivelser og filer for en gratis organisasjon, og hver kjøring dit teller, så Maven-jobben kjører bare når du starter arbeidsflyten for hånd på taggen og ber om den:

```bash
gh workflow run publish.yml --ref v0.34.0 -f maven=true
```

Gjør det når en endring angår Kotlin-konsumentene, ikke for hver tagg. Maven-versjonen kan hoppe over npm-versjoner: hver Maven-versjon bygges av npm-pakken med samme nummer, så 0.34.3 på Central er den samme LO-TEK som 0.34.3 på npm, også når 0.34.1 og 0.34.2 aldri gikk dit. Versjonen i `kotlin/gradle.properties` settes av `prepare-version`. Central krever et navnerom bekreftet på central.sonatype.com, et brukertoken og en GPG-nøkkel, og hemmelighetene står i kommentaren over jobben i `publish.yml`. Mangler de, publiseres ingenting til Central, og kjøringen får en advarsel. En versjon på Central kan heller aldri byttes ut.

Hovedtallet skal opp når et klassenavn, et `data-*`-attributt, et `part`-navn, et tokennavn, en `--lt-*`-variabel, en funksjon i `lt` eller en oppføring i `exports` forsvinner eller endrer betydning. Reglene står øverst i versjonsloggen, og er det leseren av pakken forholder seg til.

## Editorutvidelsen

`editor/` er VS Code-utvidelsen. `package.json` peker på
`dist/html-data.json` og `dist/snippets.json`, som bygget kopierer fra
pakken og som gir fullføring og snippets uten kode, og på `dist/extension.js`, som kobler sjekken til editoren med
streker, lyspærer, fullføring og hover. Sjekken er Rust-kjernen i `core/`,
bygget til WebAssembly. Den samme modulen ligger i pakken, som
`@lo-tek/interfaces/diagnostics` og `lotek sjekk`, og utvidelsen har en
kopi i `dist/`. Kjernen bærer ingen data: hver vert gir den manifestet fra
pakken, og utvidelsen har en kopi av det i `dist/manifest/` som reserve.
Manifestet skrives fra
`designsystem/src/vocabulary/elements.ts` og `classes.ts`. `classes.ts` leses
fra pakkens CSS og fra byggefunksjonene i `lt`, kalt én gang per variant, så
en ny variant er med når `lt` gir den. Filene genereres fra
`designsystem/scripts/metadata.ts`, CSS-en og «Ren HTML»-fanene på komponentsidene,
sammen med `designsystem/web-types.json` for JetBrains. Endrer du et
attributt på en komponent, stopper typesjekken til `metadata.ts` har en
setning om det. `bun run build` skriver filene på nytt før noen sjekk leser
dem, og feller ikke en utdatert fil; glemmer du å committe det bygget skrev, gjør
steget «Ingenting er ugenerert» i CI det. Filene kan også skrives alene:

```bash
bun --filter @lo-tek/interfaces vocabulary
```

Kjernen har ingen VS Code i seg, og `core/scripts/check-diagnostics.ts`
kjører den over hver feiltype den skal fange, snippetene medregnet som rene
tilfeller. Legger du til en regel i `core/src/`, legg til tilfellet som feller den, og se
at det faktisk feller ved å skru regelen av. Se `core/README.md`. `bun --filter interfaces
sjekk` bygger `dist/extension.js` og pakker `lotek.vsix`.

Utvidelsen har sitt eget versjonsnummer i `editor/package.json` og sin egen
logg i `editor/CHANGELOG.md`, og gis ut med en egen tagg:

```bash
bun run tag utvidelse
```

Taggen starter `.github/workflows/publish-extension.yml`. Marketplace har
ingen OIDC, så arbeidsflyten trenger hemmeligheten `VSCE_PAT`: et personlig
token fra Azure DevOps med rettigheten «Marketplace: Manage», laget av den
som eier utgiveren `lotek` på marketplace.visualstudio.com. Utgiveren må
opprettes der før første utgivelse.

IntelliJ-pluginen har sitt nummer i `editor-intellij/gradle.properties` og
`changeNotes` i `build.gradle.kts`, og gis ut med `bun run tag intellij`. Se
`editor-intellij/README.md`.

**Også utvidelsen og pluginen tagges med én gang grenen er slått sammen,**
av samme grunn som pakken: Editoren-siden i dokumentasjonen beskriver det
den nyeste versjonen av hver gjør, og rulles ut i det master endrer seg. Står
versjonen i `editor/package.json` eller `pluginVersion` uten tagg, lover
siden noe Marketplace ikke har. `bun run tag` uten argumenter viser hva som
står utagget, og `bun run tag` med en del minner om de andre.

## Dokumentasjonen

Teksten er på norsk bokmål og skal lese som om en norsk utvikler har skrevet
den. Anglisismer i brødtekst oversettes, overskrifter har stor forbokstav
bare i første ord, og eksempler skal vise hvordan komponenten faktisk tas i
bruk, med import, registrering og realistiske verdier.

Levende eksempler går gjennom `Preview.astro`, som legger innholdet i en
shadow root. Uten isolasjonen treffer dokumentasjonssidens egen CSS
eksempelet, og du ser ikke lenger det en konsument får.

## Navn i koden

Funksjoner, variabler, typer og konstanter navngis på engelsk, også lokale
variabler, og aldri blandet i ett navn. Kommentarene er på norsk.
`check-identifiers.ts` feller et norsk navn i koden som sendes ut;
testfiler, `src/testing/`, `src/types/` og skriptene i `scripts/` er unntatt.

En sjekk skal ikke spørre kilden om kilden. Det forventede, antallet eller
innholdet, skal komme fra et annet sted enn køen sjekken går gjennom, ellers
etterprøver vakten bare seg selv. `check-agent.ts` leser derfor mappa på
disk, og `check-vocabulary.ts` leser `exports` i pakken, ikke metadataen.

## Commit-meldinger

På norsk, i imperativ, uten prefiks: «Rett fokus i feiloppsummeringen», ikke «fix: …». Brødteksten forklarer hvorfor, ikke hva diffen allerede viser.

## Forfatter

Commits skrives alltid i eierens navn, `MASK <m.a.sobergklyver@gmail.com>`, også når en kodeagent har skrevet koden. En agent skal aldri stå som forfatter eller committer, og meldingen skal ikke ha linjer som gir den æren: ingen `Co-Authored-By: Claude …`, ingen `Claude-Session: …` og ingen «Generated with Claude Code». Det samme gjelder beskrivelsen av en PR, og regelen går foran det et verktøy ellers ber om.

Sjekk identiteten før første commit, særlig i et nytt miljø som en sky-økt:

```bash
git config user.name "MASK"
git config user.email "m.a.sobergklyver@gmail.com"
```

CI-jobben **Forfattere** (`bun run check:authors`) går gjennom hele historikken og feiler på begge deler. Grener får beskrivende navn, ikke `claude/…`.

## Når CI er rød på master

Det skal ikke skje, men skjer det: lag en gren med fiksen, åpne PR, og la CI bekrefte at den virker før du slår sammen. Ikke push rett til master for å fikse raskt. En feil i selve arbeidsflyten vises bare i en kjøring, og en kjøring får du bare gjennom en PR eller en push til master.
