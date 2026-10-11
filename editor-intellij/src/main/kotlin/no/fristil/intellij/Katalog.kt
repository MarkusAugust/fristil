package no.fristil.intellij

import com.google.gson.JsonParser

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
 * Lista leses fra manifestet i Kotlin-pakken, `no/fristil/manifest.json` i
 * jar-en, det samme kjernen sjekker mot. Pluginen har derfor ingen egen
 * utgave som kan komme ut av takt med diagnostikken eller med
 * VS Code-utvidelsen. Gson følger med IntelliJ-plattformen.
 */
object Katalog {
    val klasser: List<Klasse> by lazy {
        val tekst =
            Katalog::class.java.getResourceAsStream("/no/fristil/manifest.json")?.use {
                it.readBytes().toString(Charsets.UTF_8)
            } ?: error("manifest.json mangler i Kotlin-pakken")
        JsonParser.parseString(tekst).asJsonObject.getAsJsonObject("classes").entrySet().map { (navn, verdi) ->
            val klasse = verdi.asJsonObject
            Klasse(navn, klasse["title"].asString, klasse["description"].asString, klasse["link"].asString)
        }
    }

    private val etterNavn: Map<String, Klasse> by lazy {
        klasser.associateBy { it.navn }
    }

    fun finn(navn: String): Klasse? = etterNavn[navn]
}
