# Fristil-kjernen

Fristils sjekk og temagenerator i Rust, kompilert til én WebAssembly-modul som alle
vertsspråk kjører: Node, Bun og nettleseren direkte (`@fristil/designsystem/diagnostics`),
VS Code (`../editor`), JVM-en gjennom Chicory (`../kotlin`), IntelliJ
(`../editor-intellij`), og Go, .NET og Python gjennom sine egne runtimer.

## Hvorfor

Sjekken er det eneste som leser markup fra en servermal: Thymeleaf, JTE,
kotlinx.html, Go-maler, Razor eller en streng. Skrevet i TypeScript var den
bare tilgjengelig der det fantes en JavaScript-motor. I Rust er den én liten
modul (rundt 245 kB, med manifestet innebygd) uten importer, og verten
trenger bare en WebAssembly-runtime.

Den var skrevet i TypeScript først. Rust-utgaven ble oversatt funksjon for
funksjon, og de to ble kjørt side om side, felt for felt, på over 4000 sider
uten ett avvik før TypeScript-utgaven ble slettet.

## Grensesnittet

Ingen bindingsverktøy, så den samme modulen virker overalt:

1. `alloc(lengde)` gir et område i modulens minne.
2. Verten skriver HTML-en dit som UTF-8.
3. `diagnose_markup_raw(peker, lengde)` eller `diagnose_page_raw(…)`.
4. `result_ptr()` og `result_len()` peker på funnene som JSON.

I tillegg bytter `load_manifest_raw(peker, lengde)` til et annet manifest,
`reset_manifest()` går tilbake til det innebygde, og `version_raw()` gir
kjernens og manifestets versjon.

Hvert funn har `start`, `end`, `line`, `column`, `severity`, `rule`, `link`,
`message` og noen ganger `fix`. Posisjonene er UTF-16-indekser, som i
JavaScript og Kotlin: hele kjernen jobber på UTF-16-enheter, så ingen
posisjon må regnes om. Linja og kolonnen begynner på 1.

Lasteren for JavaScript står i `designsystem/src/diagnostics/core.ts`, og
den for Kotlin i `../kotlin/src/main/kotlin/no/fristil/Fristil.kt`. Hver er
rundt 40 linjer.

## Temaet

`src/theme/` bygger et fargetema av merkefarger og kontrollerer et tema skrevet
som CSS. Fargekontrakten, altså lysheten per rolle, kravene og løftene, er data i
`designsystem/src/tokens/fargekontrakt.json`, som kjernen bærer innebygd.
`build_theme_raw(peker, lengde)` tar oppskriften som JSON og svarer 0 med temaet
eller 1 med `{"error": …}`. `inspect_theme_raw(peker, lengde)` tar CSS-en og
svarer med funnene og hva som ble kontrollert.

CSS-en leses med `cssparser`, tokenizeren fra Servo som Firefox bruker, etter
CSS Syntax Level 3. Det er kjernens eneste avhengighet.

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

## Testene

- `cargo test`: enhetstestene i Rust.
- `scripts/sjekk-kjerne.ts`: fiksturene i `paritet/` mot fasiten ved siden
  av, felt for felt, og krav om at de til sammen utløser hver regel i
  `RULES`. En fikstur med en `.css` ved siden av sjekkes også med
  stilarket. Fasiten for de ti første ble skrevet av TypeScript-utgaven, de
  andre av kjernen, og den er nå en vanlig test: et endret svar er en endret
  fasit, og synes i diffen. `ParityTest` i `../kotlin` krever den samme
  fasiten fra JVM-en. I tillegg kjøres all markup i repoet og 4000
  ødelagte varianter av fiksturene, med et fast frø, mot kravene et svar må
  holde: ingen unntak, hvert funn innenfor teksten, riktig linje og kolonne,
  og en regel som finnes.
- `editor/scripts/sjekk-diagnostikk.ts`: 156 tilfeller som hver sier hvor
  mange funn de skal gi, hva meldingen skal nevne, hva funnet skal dekke og
  hva rettelsen skal gjøre. Også tidsgrenser for store sider.
- `src/theme/tests.rs`: kontrakten og kontrollen av et tema, med tolv
  merkefarger rundt hele fargesirkelen mot ti nøytrale, fra svart og hvitt
  til farget grått, i begge utseender: 240 kombinasjoner.
- `tema/`: oppskrifter og temaer med svaret ved siden av, skrevet av
  TypeScript-utgaven av temaet før den ble slettet. `sjekk-kjerne.ts` krever
  det samme svaret, og at 2000 ødelagte temaer ikke krasjer kjernen.
- `../kotlin`: den samme fasiten fra JVM-en.

## Kjør

```bash
bun kjerne/scripts/bygg.ts         # modulen, inn i designsystem/kjerne/
bun kjerne/scripts/sjekk-kjerne.ts # fasiten og kravene
cd kotlin && ./gradlew test        # Kotlin mot fasiten
```

Krever Rust. `rust-toolchain.toml` henter versjonen og målet
`wasm32-unknown-unknown` ved første kall.

Manifestet er generert og sjekket inn, så Gradle-bygget trenger bare Rust,
ikke Bun.

## Ytelse

På en side på 68 000 tegn:

| | per `diagnosePage` |
| --- | --- |
| Rust-modulen i Bun | 9,5 ms |
| TypeScript-utgaven i Bun, før den ble slettet | 18 ms |

På JVM er modulen kompilert til bytekode når jar-en bygges, så første kall
tar rundt 0,2 sekunder, og en ny tråd rundt 40 millisekunder.
