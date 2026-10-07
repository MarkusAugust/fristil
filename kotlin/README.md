# Fristil for Kotlin (prototype)

Fristil i Kotlin og Java, uten Node og uten JavaScript: byggefunksjonene og
diagnostikken.

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
kilden. Hver tråd får sin egen instans, så kall fra flere tråder venter ikke på
hverandre.

## Kjør

```bash
cd kotlin && ./gradlew test
```

Gradle bygger modulen fra `../kjerne` med `cargo`, så jar-en aldri bærer en
utdatert kjerne. Det krever Rust med målet `wasm32-unknown-unknown`, men ikke
Bun: manifestet er sjekket inn.

`ParityTest` krever at funnene er identiske med det TypeScript-versjonen
svarer på fiksturene i `../kjerne/paritet/`, og at posisjonene peker på riktig
tekst i en Kotlin-streng, også med «æøå» og emoji foran.
