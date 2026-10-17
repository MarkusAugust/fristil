# Fristil for Kotlin

Fristil i Kotlin og Java, uten Node og uten npm: byggefunksjonene,
diagnostikken, og CSS-en og web-komponentene som WebJar.

```kotlin
val felt = Fs.field(id = "epost", required = RequiredMarker.TEXT, error = true, invalid = ugyldig)

"""
<label ${felt.label.toHtml()}>E-postadresse</label>
<input ${(Fs.input(type = InputType.EMAIL, state = felt.state) + felt.control).toHtml()}>
<p ${(Fs.errorText() + felt.error).toHtml()}>Skriv en gyldig adresse.</p>
"""
```

```kotlin
val html = client.post("/soknad") { setBody(ugyldig) }.bodyAsText()
assertEquals(emptyList(), Fristil.diagnosePage(html))
```

## Byggefunksjonene

`Fs` har de samme byggefunksjonene og valgene som `fs` i TypeScript, med de
lovlige verdiene som `enum`-er. Hver gir et `Attributes`, et vanlig
`Map<String, String>` som kan gis til hvilken som helst malmotor, eller skrives
ut med `toHtml()`. Byggefunksjonene som gir flere sett, som `Fs.dialog` og
`Fs.field`, gir en dataklasse med ett felt per sett.

De fleste genereres fra manifestet (`manifest/manifest.json` i npm-pakken)
når pakken bygges. Manifestet beskriver hver byggefunksjon som en tabell over
hva hvert valg legger til, og `generate-manifest.ts` prøver tabellen mot
TypeScript for hver kombinasjon av valg før den skrives. De seks der valgene
virker sammen (`field`, `label`, `legend`, `suggestion`, `tabs` og
`errorSummary`) står skrevet for hånd i `Handwritten.kt`.

`ContractTest` kjører alle mot de 1353 byggetilfellene i
`../designsystem/manifest/byggetilfeller.json`, som har svaret fra TypeScript.
Én forskjell i ett attributt, og testen feiler.

## Diagnostikken

Diagnostikken er skrevet i Rust (`../kjerne`) og kompilert til WebAssembly.
Her kjøres modulen av [Chicory](https://chicory.dev), en WebAssembly-runtime i
ren Java. Modulen gjøres om til JVM-bytekode når pakken bygges, så den kjører
med JIT-en og starter på en brøkdel av et sekund. Pakken har én avhengighet,
`chicory:runtime`, uten JNI og uten noe å installere.

Det virker likt for alt som lager HTML på JVM-en: strenger, kotlinx.html,
Thymeleaf, JTE, Ktor og Spring. Sjekken leser HTML-en som kommer ut, ikke
kilden. Et kall låner en instans fra en pool og gir den tilbake etterpå, så
kall fra flere tråder venter ikke på hverandre. Poolen holder høyst like mange
ledige instanser som maskinen har prosessorer.

## Temaet

`Fristil.buildTheme(oppskrift)` bygger fargetemaet av JSON-teksten i en
oppskrift, med norske eller engelske nøkler som `fristil tema`, og
`Fristil.inspectTheme(css)` kontrollerer et håndskrevet tema. Svarene,
`Theme` og `ThemeReport`, har de samme feltene som `CoreTheme` og
`CoreThemeReport` i TypeScript. Fargekontrakten ligger i jar-en som
manifestet gjør, og `ThemeParityTest` krever det samme svaret som fasiten i
`kjerne/tema/` for hver oppskrift og hvert tema.

## Manifestet

`Fristil.manifest` er manifestet i pakken, det samme sjekken går mot, med
typer: elementene med attributter, deler og hendelser, og klassene med
attributtene, de lovlige verdiene, innholdet og delene, tokenene med
avstandene, brekkpunktene, containerbreddene, fargeaksene og
komponentvariablene, og byggefunksjonene med valgene og formen på svaret. `Manifest.parse` leser et annet, som
det `fristilManifest` skriver for et prosjekt som har overtatt komponenter.
IntelliJ-pluginen henter klassene til fullføringen herfra.
`ManifestReaderTest` krever at ingenting fra JSON-en blir borte på veien.

## kotlinx.html

`kotlinx-html/` er en egen pakke, `fristil-kotlinx-html`, med utvidelsen
`Tag.fs(…)`, som legger attributtene fra byggefunksjonene på en tagg.
`FsTest` bygger en søknadsside med den og krever at `assertFristil` består,
med og uten feil i skjemaet.

## WebJar-en

`fristil.css`, stilarket for hver komponent og JavaScript-modulene for
nettleseren ligger under `META-INF/resources/webjars/fristil/<versjon>/`, med
de samme stiene som i npm-pakken. `FristilWebJar` har stiene. Filene kopieres
fra npm-pakken, og `WebJarTest` krever at hver import i hver modul peker på en
fil i WebJar-en.

## Kommandolinja

`kommandolinje/` bygger `fristil.jar`, kommandolinja som `java -jar`. Den
kjører WASI-modulen fra npm-pakken (`kjerne/fristil.wasm`) med Chicory,
kompilert til bytekode ved bygg, og henter adresser med Javas egen
HTTP-klient. `fristil.jar` gis ut på GitHub Releases. Den vanlige jar-en, uten
avhengighetene i seg, ligger på Maven som `fristil-kommandolinje`, fordi
Gradle-pluginen kjører den.

```bash
cd kotlin && ./gradlew :kommandolinje:samletJar -Pfristil.pakke=../designsystem
java -jar kommandolinje/build/libs/fristil.jar --hjelp
```

## Gradle-pluginen

`gradle-plugin/` er pluginen `io.github.markusaugust.fristil`, med
`fristilSjekk`, `fristilTema` og `fristilManifest`. Den kjører kommandolinja
fra `kommandolinje/` i Gradle-prosessen. `FristilPluginTest` kjører den i et
lite prosjekt med Gradle TestKit, også med konfigurasjonsbufferen.

## Kjør

```bash
bun --filter @fristil/designsystem pakk
cd kotlin && ./gradlew test -Pfristil.pakke=../designsystem
```

Bygget trenger bare Java. Alt pakken består av, kommer fra npm-pakken
`@fristil/designsystem` med versjonen i `gradle.properties`: kjernen og
kommandolinja som WebAssembly, manifestet, regelbøkene og filene til
WebJar-en. `io.github.markusaugust:fristil` og `@fristil/designsystem` med
samme versjon er altså bygd av de samme filene.

Uten noe mer hentes versjonen fra npm, og fila sammenlignes med integriteten
registeret oppgir. Mellom to utgivelser er koden her nyere enn det som ligger
på npm, og da pakkes tarballen fra repoet og oppgis med `fristil.pakke`, slik
kommandoene over og CI gjør. Pakkingen krever Bun og Rust, men Gradle gjør
det ikke. Mot npm-utgaven gir testene feil svar: fasiten under er fra repoet,
og kjernen fra forrige utgivelse.

`fristil.pakke` er tarballen eller mappa den ligger i, regnet fra `kotlin/`,
også når bygget tas inn med `includeBuild`. Er den en mappe, brukes
`fristil-designsystem-<versjon>.tgz`. Pakk på nytt når pakken er endret:
Gradle bruker tarballen som ligger der, også en gammel. Bygget stopper hvis tarballen har en
annen versjon enn `gradle.properties`, og `bun run prepare-version` setter
begge.

Fasiten for testene er ikke en del av npm-pakken, og leses fra repoet:
`../designsystem/manifest/byggetilfeller.json` og `../kjerne/paritet/`.

`ParityTest` krever at funnene på JVM-en er identiske med fasiten i
`../kjerne/paritet/`, den samme fasiten `kjerne/scripts/sjekk-kjerne.ts`
krever av kjernen i Bun. Fiksturene utløser til sammen hver regel kjernen har,
stilarkreglene medregnet, og posisjonene skal peke på riktig tekst i en
Kotlin-streng, også med «æøå» og emoji foran. Skriptet som leser den rendrede
siden, `READ_RENDERED_PAGE`, testes av `designsystem/scripts/sjekk-rendret.ts`
i en ekte nettleser.
