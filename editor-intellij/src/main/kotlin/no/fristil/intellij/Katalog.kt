package no.fristil.intellij

import no.fristil.Fristil

/**
 * En klasse fra Fristil, slik editoren viser den.
 *
 * @property navn klassenavnet, for eksempel `fs-button`
 * @property komponent komponenten den hører til, vist som detalj i lista
 * @property beskrivelse hva komponenten er, vist i dokumentasjonsruta
 * @property lenke adressen til komponentsiden
 */
data class Klasse(
    val navn: String,
    val komponent: String,
    val beskrivelse: String,
    val lenke: String,
)

/**
 * Klassene Fristil sender ut.
 *
 * Lista er klassene i `Fristil.manifest` i Kotlin-pakken, manifestet det
 * samme kjernen sjekker mot. Pluginen har derfor ingen egen utgave som kan
 * komme ut av takt med diagnostikken eller med VS Code-utvidelsen.
 */
object Katalog {
    val klasser: List<Klasse> by lazy {
        Fristil.manifest.classes.values.map { Klasse(it.name, it.title, it.description, it.link) }
    }

    private val etterNavn: Map<String, Klasse> by lazy {
        klasser.associateBy { it.navn }
    }

    fun finn(navn: String): Klasse? = etterNavn[navn]
}
