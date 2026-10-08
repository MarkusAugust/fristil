# Fristil for IntelliJ

Fullføring på Fristils CSS-klasser og feilmeldinger fra Fristils sjekk i HTML,
også i HTML som er injisert i en streng.

## Hvorfor den finnes

`web-types.json` følger npm-pakken og gir fullføring på både elementene og
klassene i JetBrains-IDE-ene, uten at noen installerer noe. Men den leses
bare for **filer**, og et injisert fragment er ikke en fil.

Det er etterprøvd: med `web-types.json` på plass gir `class="fs-` forslag i en
`.html`-fil, men ingenting i den samme markupen inne i en multiline-streng.

Pluginen lukker det hullet. I tillegg viser den feilmeldingene fra sjekken,
som ingen annen kilde gir i IntelliJ.

## Feilmeldingene

`FristilAnnotator` kjører den samme Rust-kjernen som `fristil sjekk` og VS
Code, gjennom Maven-pakken i `../kotlin`. Der er kjernen kompilert til
WebAssembly og så til JVM-bytekode, og Chicory kjører den i IDE-ens egen JVM.
Ingen Node, ingen prosess å starte.

Det er et vanlig `Annotator` på HTML-språket, av samme grunn som fullføringen:
da kalles det også for injiserte fragmenter. Sjekken er `diagnoseMarkup`, fordi
en fil eller et fragment er en mal. Hvert funn har regelnavnet og en lenke til
dokumentasjonen, og en rettelse når kjernen har en. Et funn undertrykkes med
`<!-- fristil-ignore-next regelnavn -->` over taggen.

Gradle bygger `../kotlin`, og dermed kjernen, med `includeBuild`. Det krever
Rust med målet `wasm32-unknown-unknown`, som `kjerne/rust-toolchain.toml`
henter.

## Strengen må være merket

IntelliJ injiserer ikke HTML i en streng av seg selv. Den gjør det når du sier
fra, med `@Language("HTML")` på funksjonen eller en `// language=HTML`-kommentar
over verdien. Begge deler er innebygd i IntelliJ og krever ingen avhengighet.

Uten et slikt merke er strengen bare tekst for IDE-en, og da har pluginen
ingenting å feste seg i. Den dekker altså merkede strenger, ikke enhver streng
som tilfeldigvis inneholder markup.

## Hvordan

Én registrering i `plugin.xml`:

```xml
<completion.contributor language="HTML" order="first" … />
```

Registrert på HTML-språket, ikke på Kotlin. Injiserer IntelliJ HTML i en
streng, blir fragmentet et ekte `PsiFile` med HTML-språk, og bidragsyteren
kalles for det. Den samme linja dekker derfor `.html`-filer og merkede
strenger, uten en registrering per vertsspråk.

Testene dekker `.html` og Kotlin, for både fullføringen og feilmeldingene. En merket TypeScript-streng virker av den
samme grunnen, og begge er etterprøvd for hånd i IntelliJ IDEA Ultimate
2026.2.3.

Skal du etterprøve for hånd, må Kotlin-fila ligge i en modul. En løs `.kt`-fil
i en mappe IntelliJ har åpnet uten modul får ingen injeksjon, og fullføringen
svarer «No suggestions» selv med pluginen på. `⌥↩` inne i strengen viser
*Edit HTML Fragment* når injeksjonen er aktiv.

## Dataene

`Klasser.kt` er generert av `editor/scripts/generate.ts` fra `classesData()`,
den samme funksjonen som skriver `classes.ts`, `fristil.html-data.json` og
`web-types.json`. Fire utganger, én kilde. Pluginen kan derfor ikke foreslå
en klasse diagnostikken avviser.

Den er Kotlin og ikke JSON med vilje: da trengs ingen parser og ingen
avhengighet, og kompilatoren leser dataene. Det er det samme valget som for
`src/vocabulary/classes.ts`.

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

## Utgivelse

Pluginen ligger på [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/34764-fristil)
med ID-en `no.fristil`. Tre ting er verdt å vite:

- **ID-en kan aldri endres** etter første opplasting.
- **Beskrivelsen i `plugin.xml` og `changeNotes` i `build.gradle.kts` er på
  engelsk.** Marketplace krever engelsk som hovedspråk.
- **En ny versjon** får nytt nummer i `pluginVersion` i `gradle.properties` og
  en linje i `changeNotes`. Når den ligger på master, dyttes taggen opp
  med `bun run tag intellij`. Da bygger,
  tester og laster `publiser-intellij.yml` opp pluginen med tokenet i
  hemmeligheten `JETBRAINS_MARKETPLACE_TOKEN`. Taggen må stemme med
  `pluginVersion`. JetBrains godkjenner hver versjon før den blir synlig.
- **Pluginen signeres ikke med eget sertifikat.** Det er valgfritt, Gradle
  hopper over `signPlugin` uten sertifikat, og Marketplace signerer den selv.

## Hvorfor den ikke er i `bun run sjekk`

Hovedrekka tar tre minutter og kjøres før hver push. Et Gradle-bygg som
laster ned en IDE hører ikke hjemme der. `.github/workflows/ci-intellij.yml`
kjører derfor for seg, og bare når `editor-intellij/**` eller arbeidsflyten
selv er endret, eller du starter den for hånd.
