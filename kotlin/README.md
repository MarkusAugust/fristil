# Fristil for Kotlin (prototype)

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

De fleste genereres fra manifestet (`../designsystem/manifest/manifest.json`)
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

## kotlinx.html

`kotlinx-html/` er en egen pakke, `fristil-kotlinx-html`, med utvidelsen
`Tag.fs(…)`, som legger attributtene fra byggefunksjonene på en tagg.
`FsTest` bygger en søknadsside med den og krever at `assertFristil` består,
med og uten feil i skjemaet.

## WebJar-en

`fristil.css`, stilarket for hver komponent og JavaScript-modulene for
nettleseren ligger under `META-INF/resources/webjars/fristil/<versjon>/`, med
de samme stiene som i npm-pakken. `FristilWebJar` har stiene. Gradle bygger
filene fra `../designsystem` med `bun run bygg:nettleser`, og `WebJarTest`
krever at hver import i hver modul peker på en fil i WebJar-en.

Versjonen er den samme som npm-pakkens, lest fra `../designsystem/package.json`.

## Kommandolinja

`kommandolinje/` bygger `fristil.jar`, kommandolinja som `java -jar`. Den
kjører WASI-modulen fra `../kjerne/cli` med Chicory, kompilert til bytekode
ved bygg, og henter adresser med Javas egen HTTP-klient. Den gis ut på GitHub
Releases, ikke på Maven.

```bash
cd kotlin && ./gradlew :kommandolinje:samletJar
java -jar kommandolinje/build/libs/fristil.jar --hjelp
```

## Gradle-pluginen

`gradle-plugin/` er pluginen `io.github.markusaugust.fristil`, med
`fristilSjekk`, `fristilTema` og `fristilManifest`. Den kjører kommandolinja
fra `kommandolinje/` i Gradle-prosessen. `FristilPluginTest` kjører den i et
lite prosjekt med Gradle TestKit, også med konfigurasjonsbufferen.

## Kjør

```bash
cd kotlin && ./gradlew test
```

Gradle bygger modulen fra `../kjerne` med `cargo`, så jar-en aldri bærer en
utdatert kjerne, og WebJar-en fra `../designsystem` med Bun. Det krever Rust
og Bun, og `bun install` i rota av repoet.

`ParityTest` krever at funnene på JVM-en er identiske med fasiten i
`../kjerne/paritet/`, den samme fasiten `kjerne/scripts/sjekk-kjerne.ts`
krever av kjernen i Bun. Fiksturene utløser til sammen hver regel kjernen har,
med og uten stilark, og posisjonene skal peke på riktig tekst i en
Kotlin-streng, også med «æøå» og emoji foran. Skriptet som leser den rendrede
siden, `READ_RENDERED_PAGE`, prøves av `designsystem/scripts/sjekk-rendret.ts`
i en ekte nettleser.
