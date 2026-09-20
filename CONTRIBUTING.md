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

## Commit-meldinger

På norsk, i imperativ, med et prefiks som sier hva slags endring det er: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Brødteksten forklarer hvorfor, ikke hva diffen allerede viser.

## Når CI er rød på master

Det skal ikke skje, men skjer det: lag en gren med fiksen, åpne PR, og la CI bekrefte at den virker før du slår sammen. Ikke push rett til master for å fikse raskt. En feil i selve arbeidsflyten vises bare i en kjøring, og en kjøring får du bare gjennom en PR eller en push til master.
