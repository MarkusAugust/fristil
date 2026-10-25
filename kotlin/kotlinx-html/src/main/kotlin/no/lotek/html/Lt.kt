package no.lotek.html

import kotlinx.html.Tag

/**
 * Legger attributtene fra LO-TEKs byggefunksjoner på en tagg i kotlinx.html.
 *
 * ```kotlin
 * val felt = Lt.field(id = "epost", required = RequiredMarker.TEXT, error = true, invalid = ugyldig)
 *
 * label { lt(felt.label); +"E-postadresse" }
 * input { lt(Lt.input(type = InputType.EMAIL, state = felt.state), felt.control); name = "epost" }
 * p { lt(Lt.errorText(), felt.error); +"Skriv en gyldig adresse." }
 * ```
 *
 * Settene legges på i rekkefølge, og et senere vinner over et tidligere,
 * som `{...a} {...b}` i JSX. `class` er unntaket: klassene legges til dem
 * taggen allerede har, så `div(classes = "min-egen") { lt(Lt.card()) }` gir
 * begge. Et flagg som `hidden` har den tomme teksten som verdi, og kotlinx.html
 * skriver det som `hidden=""`, som betyr det samme i HTML.
 */
fun Tag.lt(vararg sets: Map<String, String>) {
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
