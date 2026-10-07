# Fristil-kjernen (prototype)

Fristils diagnostikk i Rust, kompilert til én WebAssembly-modul som alle
vertsspråk kjører: Node, Bun og nettleseren direkte, JVM-en gjennom Chicory
(`../kotlin`), og Go, .NET og Python gjennom sine egne runtimer.

## Hvorfor

Diagnostikken er det eneste som leser markup fra en servermal: Thymeleaf,
JTE, kotlinx.html, Go-maler, Razor eller en streng. I TypeScript var den
bare tilgjengelig der det fantes en JavaScript-motor. I Rust er den én liten
modul (rundt 210 kB, med manifestet innebygd) uten importer, og verten
trenger bare en WebAssembly-runtime.

## Grensesnittet

Ingen bindingsverktøy, så den samme modulen virker overalt:

1. `alloc(lengde)` gir et område i modulens minne.
2. Verten skriver HTML-en dit som UTF-8.
3. `diagnose_markup_raw(peker, lengde)` eller `diagnose_page_raw(…)`.
4. `result_ptr()` og `result_len()` peker på funnene som JSON.

I tillegg bytter `load_manifest_raw(peker, lengde)` til et annet manifest,
`reset_manifest()` går tilbake til det innebygde, og `version_raw()` gir
kjernens og manifestets versjon.

Funnene har de samme feltene som `Finding` i TypeScript, og i tillegg
`rule` (navnet på regelen), `line` og `column` (fra 1). Posisjonene er
UTF-16-indekser, som i JavaScript og Kotlin: hele kjernen jobber på
UTF-16-enheter, så ingen posisjon må regnes om.

## Ordforrådet

Kjernen leser `designsystem/manifest/manifest.json`, som pakken skriver fra
koden, og bærer det innebygd som standard. En vert kan gi den et annet
manifest, for eksempel det prosjektet har installert. Manifestet har en
`schemaVersion`, og kjernen avviser et manifest med en form den ikke forstår,
med en forklaring.

## Undertrykking

En kommentar gjelder den neste taggen:

```html
<!-- fristil-ignore-next -->
<!-- fristil-ignore-next ukjent-klasse ugyldig-klasseverdi -->
```

Uten regelnavn undertrykkes alle funn i taggen, med regelnavn bare dem.
Reglene står i `src/types.rs` (`RULES`).

Lasteren for JavaScript står i `js/kjerne.ts`, og den for Kotlin i
`../kotlin/src/main/kotlin/no/fristil/Fristil.kt`. Hver er rundt 40
linjer.

## Paritet

Rust-versjonen er en oversettelse av `designsystem/src/diagnostics/`,
funksjon for funksjon og med de samme meldingene. `scripts/sjekk-paritet.ts`
krever at de svarer nøyaktig det samme, felt for felt, på:

- fiksturene i `paritet/`, én per regel
- all markup i repoet: dokumentasjonen, regelbøkene, komponentene og testene
- 4000 varianter av fiksturene, klipt og skjøtet med et fast frø

Ett endret tegn i én melding gir hundrevis av avvik. Det er etterprøvd.

To steder svarer Rust annerledes, med vilje: TypeScript-versjonen slår opp
attributtnavn i vanlige objekter, så `constructor` og `__proto__` treffer
`Object.prototype`. `<button class="fs-button" constructor="x">` får den til
å kaste, og `<fs-field constructor="x">` meldes ikke som et ukjent
attributt.

## Kjør

```bash
bun kjerne/scripts/bygg.ts           # modulen og fasiten
bun kjerne/scripts/sjekk-paritet.ts  # Rust mot TypeScript
cd kotlin && ./gradlew test          # Kotlin mot fasiten
```

Krever Rust med målet `wasm32-unknown-unknown`
(`rustup target add wasm32-unknown-unknown`).

Manifestet er generert og sjekket inn, så Gradle-bygget trenger bare Rust,
ikke Bun. `cargo test` kjører enhetstestene.

## Ytelse

På en side på 68 000 tegn:

| | per `diagnosePage` |
| --- | --- |
| TypeScript i Bun | 18 ms |
| Rust-modulen i Bun | 9,5 ms |
| Rust-modulen på JVM, Chicory med kompilator | 79 ms |

På JVM tar første kall rundt ett sekund, mens modulen kompileres til
bytekode. Chicory kan gjøre det når jar-en bygges i stedet, og da forsvinner
den tiden.
