package no.fristil.intellij

import com.intellij.psi.PsiFile
import no.fristil.Fristil
import no.fristil.Manifest

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
 * [klasserFor] er klassene i manifestet fila sjekkes mot: prosjektets når det
 * har et, ellers [klasser], manifestet i Kotlin-pakken. Det er det samme
 * manifestet [FristilAnnotator] gir kjernen, funnet av [ProjectManifest], så
 * fullføringen foreslår aldri en klasse diagnostikken avviser, og den
 * foreslår klassene i komponenter prosjektet har overtatt. Før leste
 * fullføringen alltid pakkens manifest, mens annotatoren leste prosjektets,
 * og med en eldre pakke installert ble en klasse foreslått og streket under
 * rett etterpå.
 */
object Katalog {
    /** Klassene i manifestet i Kotlin-pakken. */
    val klasser: List<Klasse> by lazy { fra(Fristil.manifest) }

    /** Klassene i manifestet [file] sjekkes mot, se [ProjectManifest]. */
    fun klasserFor(file: PsiFile): List<Klasse> = ProjectManifest.classesFor(file) ?: klasser

    internal fun fra(manifest: Manifest): List<Klasse> =
        manifest.classes.values.map { Klasse(it.name, it.title, it.description, it.link) }

    private val etterNavn: Map<String, Klasse> by lazy {
        klasser.associateBy { it.navn }
    }

    fun finn(navn: String): Klasse? = etterNavn[navn]
}
