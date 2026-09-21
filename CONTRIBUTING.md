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

Kjører nøyaktig det CI kjører, i samme rekkefølge:

| Steg | Hva det kontrollerer |
| --- | --- |
| `lint` | Formatering og lintregler, med Biome |
| `typecheck` | Typene i pakken og dokumentasjonen |
| `typecheck:tests` | Typene i testene, som ellers ikke leses av `tsc -b` |
| `test` | 1940 tester i Chromium, Firefox og WebKit, pluss Tailwind-temaet |
| `build` | Bygger pakken, og kontrollerer at den inneholder det den lover |
| `test:docs` | axe mot hver bygde side i begge temaer, og at dokumentasjonen følger koden |

Hele kjøringen tar noen minutter, mest på grunn av de tre nettleserne. Under arbeid er `bun run test -- --project chromium` nok.

`sjekk` henter nettleserne først, så den virker i et nyklonet repo. Kommandoen er rask når de allerede ligger der. Trenger du bare dem:

```bash
bun --filter @fristil/designsystem nettlesere
```

Bruk den formen, ikke `bunx playwright install`, som kan hente en annen versjon enn den vitest bruker, og heller ikke `bun --filter <pakke> run <skript>`, som gir «No packages matched the filter». Skriptnavnet skal stå uten `run`.

## Versjonslogg og utgivelser

`designsystem/CHANGELOG.md` skrives underveis, ikke ved utgivelse. Endrer du noe en konsument merker, legg linjen under «Ikke utgitt» i samme pull request som endringen. `bun run build` stopper hvis versjonen i `package.json` mangler en overskrift i loggen.

Når en versjon skal ut:

```bash
bun run publish:versjon 0.4.0
bun run sjekk
git checkout -b slipp-0.4.0 && git commit -am "chore: slipp 0.4.0"
git push -u origin slipp-0.4.0 && gh pr create --fill
```

`publish:versjon` døper om overskriften «Ikke utgitt» til nummeret og datoen, legger inn en ny tom over, og setter samme nummer i `designsystem/package.json`. Den nekter å sette en versjon som ikke er høyere enn den som står der, og å gi ut en tom «Ikke utgitt».

Taggen settes først når versjonen ligger på master:

```bash
git checkout master && git pull
git tag v0.4.0 && git push origin v0.4.0
```

Rekkefølgen er ikke til å bytte om på. Tagger du før versjonen er på master, stopper kontrollen i `publish.yml` kjøringen, og taggen må fjernes med `git push origin :refs/tags/v0.4.0` og `git tag -d v0.4.0` før du kan sette den på nytt. `git push` alene sender ingen tagger, så det siste steget kan ikke hoppes over.

Taggen starter `.github/workflows/publish.yml`, som bygger pakken og legger den ut på npm. Arbeidsflyten har ingen hemmeligheter i seg: den ber npm om en kortlevd legitimasjon gjennom GitHubs OIDC, og det virker bare så lenge pakken har en utgiver registrert under Settings på npmjs.com (GitHub Actions, `MarkusAugust`, `fristil`, `publish.yml`). npm signerer samtidig en attestasjon som viser hvilken commit versjonen kom fra.

Den aller første utgivelsen kan ikke gjøres slik, for en utgiver kan bare kobles til en pakke som alt finnes. Den gjøres fra maskinen, med `npm login` først:

```bash
cd designsystem && npm publish --access public
```

En versjon kan aldri publiseres på nytt eller overskrives, og `npm unpublish` er stengt etter 72 timer. Skal en versjon ut av sirkulasjon, er `npm deprecate` veien.

Hovedtallet skal opp når et klassenavn, et `data-*`-attributt, et `part`-navn, et tokennavn, en `--fs-*`-variabel, en funksjon i `fs` eller en oppføring i `exports` forsvinner eller endrer betydning. Reglene står øverst i versjonsloggen, og er det leseren av pakken forholder seg til.

## Commit-meldinger

På norsk, i imperativ, med et prefiks som sier hva slags endring det er: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Brødteksten forklarer hvorfor, ikke hva diffen allerede viser.

## Når CI er rød på master

Det skal ikke skje, men skjer det: lag en gren med fiksen, åpne PR, og la CI bekrefte at den virker før du slår sammen. Ikke push rett til master for å fikse raskt. En feil i selve arbeidsflyten vises bare i en kjøring, og en kjøring får du bare gjennom en PR eller en push til master.
