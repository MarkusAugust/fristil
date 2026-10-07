# Fristil for Kotlin (prototype)

Fristils diagnostikk i Kotlin og Java, uten Node og uten JavaScript.

```kotlin
val html = client.post("/soknad") { setBody(ugyldig) }.bodyAsText()
assertEquals(emptyList(), Fristil.diagnosePage(html))
```

Diagnostikken er skrevet i Rust (`../kjerne`) og kompilert til WebAssembly.
Her kjøres modulen av [Chicory](https://chicory.dev), en WebAssembly-runtime i
ren Java, med kompilatoren som gjør den om til JVM-bytekode når den lastes.
Det er to Maven-avhengigheter, uten JNI og uten noe å installere.

Det virker likt for alt som lager HTML på JVM-en: strenger, kotlinx.html,
Thymeleaf, JTE, Ktor og Spring. Sjekken leser HTML-en som kommer ut, ikke
kilden.

## Kjør

```bash
cd kotlin && ./gradlew test
```

Gradle bygger modulen fra `../kjerne` med `cargo`, så jar-en aldri bærer en
utdatert kjerne. Det krever Rust med målet `wasm32-unknown-unknown`.

`ParitetTest` krever at funnene er identiske med det TypeScript-versjonen
svarer på fiksturene i `../kjerne/paritet/`, og at posisjonene peker på riktig
tekst i en Kotlin-streng, også med «æøå» og emoji foran.
