package no.fristil.html

import kotlinx.html.Tag

/**
 * Legger attributtene fra Fristils byggefunksjoner på en tagg i kotlinx.html.
 *
 * ```kotlin
 * val felt = Fs.field(id = "epost", required = RequiredMarker.TEXT, error = true, invalid = ugyldig)
 *
 * label { fs(felt.label); +"E-postadresse" }
 * input { fs(Fs.input(type = InputType.EMAIL, state = felt.state), felt.control); name = "epost" }
 * p { fs(Fs.errorText(), felt.error); +"Skriv en gyldig adresse." }
 * ```
 *
 * Settene legges på i rekkefølge, og et senere vinner over et tidligere,
 * som `{...a} {...b}` i JSX. `class` er unntaket: klassene legges til dem
 * taggen allerede har, så `div(classes = "min-egen") { fs(Fs.card()) }` gir
 * begge. Et flagg som `hidden` har den tomme teksten som verdi, og kotlinx.html
 * skriver det som `hidden=""`, som betyr det samme i HTML.
 */
fun Tag.fs(vararg sets: Map<String, String>) {
    for (set in sets) {
        for ((name, value) in set) {
            attributes[name] = if (name == "class") joinClasses(attributes[name], value) else value
        }
    }
}

/** Klassene i begge, i rekkefølge og uten doble. */
private fun joinClasses(existing: String?, added: String): String =
    (existing.orEmpty().split(' ') + added.split(' '))
        .filter { it.isNotBlank() }
        .distinct()
        .joinToString(" ")
