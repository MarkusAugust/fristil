# LO-TEK for IntelliJ

Fullføring på LO-TEKs CSS-klasser og feilmeldinger fra LO-TEKs sjekk i HTML,
også i HTML som er injisert i en streng.

## Hvorfor den finnes

`web-types.json` følger npm-pakken og gir fullføring på både elementene og
klassene i JetBrains-IDE-ene, uten at noen installerer noe. Men den leses
bare for **filer**, og et injisert fragment er ikke en fil.

Det er etterprøvd: med `web-types.json` på plass gir `class="lt-` forslag i en
`.html`-fil, men ingenting i den samme markupen inne i en multiline-streng.

Pluginen lukker det hullet. I tillegg viser den feilmeldingene fra sjekken,
som ingen annen kilde gir i IntelliJ.

## Live templates

Skriv `lt-field` og trykk Tab, og markupen fra komponentsiden står der, med
id-en som variabel og `for` som følger med. Malene ligger i
`designsystem/live-templates.xml`, generert av `generate-vocabulary.ts` fra de
samme oppskriftene som snippetene i VS Code, og Gradle kopierer fila inn som
`liveTemplates/Lotek.xml`. En ny komponent får en mal av seg selv ved neste
`generate`, men pluginen må gis ut på nytt for at brukerne skal få den.

## Feilmeldingene

`LotekAnnotator` kjører den samme Rust-kjernen som `lotek sjekk` og VS
Code, gjennom Maven-pakken i `../kotlin`. Der er kjernen kompilert til
WebAssembly og så til JVM-bytekode, og Chicory kjører den i IDE-ens egen JVM.
Ingen Node, ingen prosess å starte.

Det er et vanlig `Annotator` på HTML-språket, av samme grunn som fullføringen:
da kalles det også for injiserte fragmenter. Sjekken er `diagnoseMarkup`, fordi
en fil eller et fragment er en mal. Hvert funn har regelnavnet og en lenke til
dokumentasjonen, og en rettelse når kjernen har en. En rettelse kan være
flere endringer, som `id` på feltet og `for` på ledeteksten; de brukes bakfra,
så posisjonene holder. I en streng regnes hver endring om til sin del av
vertsstrengen og skrives gjennom strengens egen manipulator, så
anførselstegnene rettelsen setter inn, rømmes i en `"…"`-streng, og en mal
som `$navn` i strengen står urørt. Et funn undertrykkes med
`<!-- lotek-ignore-next regelnavn -->` over taggen.

Sjekken går mot prosjektets manifest, funnet slik språkserveren finner det:
fra mappa fila ligger i og oppover til prosjektmappa, først
`build/lotek/manifest.json`, som Gradle-oppgaven `lotekManifest` skriver
når prosjektet har overtatt komponenter, så
`node_modules/@lo-tek/interfaces/manifest/manifest.json`. For et injisert
fragment letes det fra fila strengen står i. Finnes ingen av dem, eller kan
kjernen ikke lese manifestet, gjelder manifestet i Kotlin-pakken, og det
siste står i IDE-ens logg. Se `ProjectManifest.kt`. Kommer, endres eller forsvinner
manifestet, sjekkes de åpne filene på nytt (`ManifestListener.kt`).
Fullføringen leser klassene fra det samme manifestet, se [Dataene](#dataene).

Annotatoren kjører kjernen på hver fil, også en uten en eneste `lt-`-klasse:
regelen `ikon-uten-navn` gjelder vanlig HTML, og `lotek sjekk` og VS Code
melder en ikonknapp uten navn uansett. En snarvei som hoppet over filer uten
«lt-» i teksten, gjorde at IntelliJ tidde om den.

Gradle bygger `../kotlin` med `includeBuild`, og Kotlin-pakken bygges av
npm-pakken med samme versjon. Mellom to utgivelser er den på npm for gammel,
så pakk den fra repoet først, som i `kotlin/README.md`:

```bash
bun --filter @lo-tek/interfaces pack
cd editor-intellij && ./gradlew build -Plotek.pakke=../designsystem
```

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

Klassene leses fra manifestet fila sjekkes mot: prosjektets når
`ProjectManifest` finner et, ellers manifestet i Kotlin-pakken,
`no/lotek/manifest.json` i jar-en. Det er det samme manifestet kjernen
sjekker mot, så pluginen kan ikke foreslå en klasse diagnostikken avviser, og
den foreslår klassene i komponenter prosjektet har overtatt. Før leste
fullføringen alltid pakkens manifest, mens sjekken leste prosjektets, og med
en eldre pakke installert ble en klasse foreslått og streket under rett
etterpå. Manifestet leses med `Manifest.parse` i Kotlin-pakken. Se
`Catalogue.kt`.

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

Pluginen ligger på [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/34764-lotek)
med ID-en `no.lotek`. Tre ting er verdt å vite:

- **ID-en kan aldri endres** etter første opplasting.
- **Beskrivelsen i `plugin.xml` og `changeNotes` i `build.gradle.kts` er på
  engelsk.** Marketplace krever engelsk som hovedspråk.
- **En ny versjon** får nytt nummer i `pluginVersion` i `gradle.properties` og
  en linje i `changeNotes`. Når den ligger på master, dyttes taggen opp
  med `bun run tag intellij`, med én gang: Editoren-siden i dokumentasjonen
  beskriver det den nyeste versjonen gjør, og rulles ut i det master
  endrer seg, så en utagget versjon lover noe Marketplace ikke har. Da
  bygger, tester og laster `publish-intellij.yml` opp pluginen med tokenet
  i hemmeligheten `JETBRAINS_MARKETPLACE_TOKEN`. Taggen må stemme med
  `pluginVersion`. JetBrains godkjenner hver versjon før den blir synlig.
- **Pluginen signeres ikke med eget sertifikat.** Det er valgfritt, Gradle
  hopper over `signPlugin` uten sertifikat, og Marketplace signerer den selv.

## Hvorfor den ikke er i `bun run check`

Hovedrekka kjøres før hver push, og tar alt noen minutter, se
`CONTRIBUTING.md`. Et Gradle-bygg som laster ned en IDE hører ikke hjemme
der. `.github/workflows/ci-intellij.yml` kjører derfor for seg, og bare når
noe pluginen bygges av er endret: pluginen selv, Kotlin-pakken, kjernen,
manifestet, pakkens kildekode, regelbøkene, skriptene som skriver dem eller
`designsystem/package.json`. Stiene står i `paths` øverst i arbeidsflyten,
med grunnen, og den kan også startes for hånd.
