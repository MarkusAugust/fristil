# Fristil på JVM (prototype)

Fristils diagnostikk i Kotlin og Java, uten Node.

```kotlin
val html = client.post("/soknad") { setBody(ugyldig) }.bodyAsText()
assertEquals(emptyList(), Fristil.diagnosePage(html))
```

## Hvorfor den finnes

Diagnostikken er skrevet i TypeScript, og den er det eneste som leser markup
fra en servermal: Thymeleaf, JTE, kotlinx.html eller en streng. For et team
på JVM-en var den bare tilgjengelig gjennom `npx`, altså med Node i
byggeløypa.

Koden skrives ikke på nytt i Kotlin. `scripts/bygg.ts` pakker den samme
diagnostikken som editorutvidelsen og `fristil sjekk` bruker, til én fil.
Den kjøres i QuickJS, kompilert til WebAssembly og videre til vanlig
Java-bytekode av [QuickJs4J](https://github.com/roastedroot/quickjs4j). Det er
en Maven-avhengighet, uten JNI og uten noen runtime å installere.

## Paritet

Det finnes én implementasjon, og testen holder det slik. `scripts/bygg.ts`
kjører diagnostikken i Bun på hver fil i `src/test/resources/paritet/` og
skriver svaret som fasit. `ParitetTest` krever at JVM-versjonen svarer
nøyaktig det samme: hver melding, hver posisjon, hver rettelse.

Posisjonene er tegnindekser i UTF-16 på begge sider, så
`html.substring(funn.start, funn.end)` gir teksten funnet gjelder, også med
«æøå» og emoji foran.

## Kjør

```bash
bun jvm/scripts/bygg.ts       # bunten og fasiten, etter endringer i diagnostikken
cd jvm && ./gradlew test
```

## Status

Prototype. Første kall tar rundt ett sekund mens bunten kompileres, deretter
rundt 40 ms per kall. QuickJs4J er i versjon 0.1.0.
