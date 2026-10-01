# Fristil for IntelliJ

Fullføring på Fristils CSS-klasser i HTML, også i HTML som er injisert i en
streng.

## Hvorfor den finnes

`web-types.json` følger npm-pakken og gir fullføring på både elementene og de
72 klassene i JetBrains-IDE-ene, uten at noen installerer noe. Men den leses
bare for filer. Skriver du markup i en Kotlin-streng, som i en Ktor- eller
Spring-app, blir HTML-en et injisert fragment, og fragmentet er ikke en fil.

Det er etterprøvd: med `web-types.json` på plass gir `class="fs-` forslag i en
`.html`-fil, men ingenting i den samme markupen inne i en multiline-streng.

Pluginen lukker det hullet, og bare det.

## Hvordan

Én registrering i `plugin.xml`:

```xml
<completion.contributor language="HTML" order="first" … />
```

Registrert på HTML-språket, ikke på Kotlin. Injiserer IntelliJ HTML i en
streng, blir fragmentet et ekte `PsiFile` med HTML-språk, og bidragsyteren
kalles for det. Den samme linja dekker derfor `.html`-filer, Kotlin-strenger
og TypeScript-strenger, uten en registrering per vertsspråk.

## Dataene

`Klasser.kt` er generert av `editor/scripts/generate.ts` fra `classesData()`,
den samme funksjonen som skriver `classes.ts`, `fristil.html-data.json` og
`web-types.json`. Fire utganger, én kilde. Pluginen kan derfor ikke foreslå
en klasse diagnostikken avviser.

Den er Kotlin og ikke JSON med vilje: da trengs ingen parser og ingen
avhengighet, og kompilatoren leser dataene. Det er det samme valget som for
`src/diagnostics/classes.ts`.

Regenerer med:

```bash
bun --filter fristil-vscode generate
```

## Bygge og teste

Krever JDK 21.

```bash
./gradlew build
```

Første kjøring laster ned IntelliJ-plattformen, rundt en gigabyte, og tar et
par minutter. Senere kjøringer tar sekunder.

Pluginen havner i `build/distributions/` som en zip du kan installere med
`Settings → Plugins → ⚙ → Install Plugin from Disk`.

## Hvorfor den ikke er i `bun run sjekk`

Hovedrekka tar tre minutter og kjøres før hver push. Et Gradle-bygg som
laster ned en IDE hører ikke hjemme der. `.github/workflows/ci-intellij.yml`
kjører derfor for seg, og bare når `editor-intellij/**` er endret.
