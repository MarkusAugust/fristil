# Fristil for Kotlin

Byggefunksjonene fra `@fristil/designsystem`, for Kotlin-servere som skriver
markupen selv. Med dem står tilgjengelighetskoblingen i HTML-en fra serveren,
før noe skript har kjørt, og `<fs-field>` trengs ikke.

Foreløpig er fem byggefunksjoner med: `field`, `input`, `label`, `helpText`
og `errorText`. Biblioteket har ingen avhengigheter.

## Bruk

```kotlin
import no.fristil.Fs
import no.fristil.InputType

val felt = Fs.field(id = "epost", help = true, error = true, invalid = epostUgyldig)
val input = Fs.input(type = InputType.EMAIL, state = felt.state) + felt.control

"""
<label${felt.label.toHtml()}>E-post</label>
<input${input.toHtml()} name="epost">
<p${(Fs.helpText() + felt.help).toHtml()}>Vi sender aldri spam</p>
<p${(Fs.errorText() + felt.error).toHtml()}>Skriv en gyldig e-postadresse</p>
"""
```

Er adressen ugyldig, sender serveren dette:

```html
<label class="fs-label" for="epost">E-post</label>
<input class="fs-input" type="email" data-state="invalid" aria-invalid="true" id="epost" aria-describedby="epost-help epost-error" name="epost">
<p class="fs-help-text" id="epost-help">Vi sender aldri spam</p>
<p class="fs-error-text" id="epost-error">Skriv en gyldig e-postadresse</p>
```

Er den gyldig, får feilmeldingen `hidden`, og `aria-describedby` peker bare på
hjelpeteksten. Eksempelet over kjøres i `ReadmeTest`.

Hvert sett er et `Map<String, String>`, så i kotlinx.html legges det rett inn:

```kotlin
label { attributes.putAll(felt.label); +"E-post" }
input { attributes.putAll(input); name = "epost" }
```

- **`+`** legger to sett oppå hverandre. Står samme navn i begge, vinner settet
  til høyre, som når to objekter spres etter hverandre i JSX.
- **Et boolsk attributt** som er på, som `disabled` og `hidden`, har den tomme
  strengen som verdi. `toHtml()` skriver det uten verdi, og escaper resten.
- **De lovlige verdiene er enum-er:** `InputType`, `FieldState`,
  `RequiredMarker`, `HelpTextVariant` og `ErrorTextVariant`. En skrivefeil er
  en kompileringsfeil.
- **`id` er påkrevd.** En id som er tom eller bare mellomrom, kaster. TypeScript
  lager en tilfeldig id og sier fra i konsollen, fordi en konsument uten
  typesjekk kan glemme den; her stopper typen det.

## Kontrakten

TypeScript er fasiten. `designsystem/scripts/generate-contract.ts` kaller hver
byggefunksjon med alle kombinasjoner av valgene og skriver inndata og svar til
`contract/cases.json`. `ContractTest` kjører de samme kallene i Kotlin og
krever det samme svaret på hvert tilfelle, med attributtene i samme
rekkefølge, og at de lovlige verdiene er de samme. Et valg i kontrakten som
Kotlin ikke leser, feiler tilfellet i stedet for å bli ignorert.

Én forskjell godtas: `true` i TypeScript, som for `disabled`, og den tomme
strengen, som for `data-optional`, er begge den tomme strengen i Kotlin. I
HTML betyr de det samme.

Ingen av de to kan gå fra den andre uten at noe blir rødt:

- **Endres TypeScript,** endres `contract/cases.json` i neste bygg. CI feiler
  hvis den ikke er committet.
- **Kotlin-testene kjører i den påkrevde jobben i `ci.yml`,** rett etter det
  steget, og i `bun run sjekk` lokalt. En rød Kotlin-test stopper en merge.
- **Endres Kotlin,** må det fortsatt gi svaret fila sier.

Systemet er mutasjonstestet fem veier:

- Kotlin med Java sin `\s` i stedet for JavaScript sin gir 16 ulike svar.
- En inputtype for mye feller sammenligningen av verdiene.
- En endret regel for `aria-describedby` i TypeScript gir 52 ulike svar.
- To attributter i byttet rekkefølge i `input` gir 13 ulike svar.
- Et valg i kontrakten som Kotlin ikke leser, feiler tilfellet.

Legger du til en byggefunksjon i Kotlin, legg den til i generatoren, i `run`
og i `KNOWN_OPTIONS` i `ContractTest` samtidig. Står den i kontrakten uten å finnes i
Kotlin, feiler testen.

## Bygge og teste

```bash
bun run test:kotlin     # eller: cd kotlin && ./gradlew build
```

Kontrakten genereres med resten av pakken:

```bash
bun --filter @fristil/designsystem generate
```
