package no.fristil.intellij

import com.intellij.lang.documentation.AbstractDocumentationProvider
import com.intellij.psi.PsiElement

/**
 * Viser hva en klasse er, med lenke til komponentsiden.
 *
 * Gjelder både mens lista står åpen og når markøren hviler på en klasse i
 * markupen. Teksten er den samme som VS Code-utvidelsen viser, siden begge
 * leser den samme genererte lista.
 */
class FristilDocumentationProvider : AbstractDocumentationProvider() {
    override fun generateDoc(
        element: PsiElement?,
        original: PsiElement?,
    ): String? {
        val klasse = klassenVed(original ?: element ?: return null) ?: return null

        return buildString {
            append("<div class='definition'><pre>")
            append(klasse.navn)
            append("</pre></div>")
            append("<div class='content'>")
            append("<b>")
            append(klasse.komponent)
            append("</b><br>")
            append(klasse.beskrivelse)
            if (klasse.lenke.isNotEmpty()) {
                append("<br><br><a href='")
                append(klasse.lenke)
                append("'>Dokumentasjon</a>")
            }
            append("</div>")
        }
    }

    private fun klassenVed(element: PsiElement): Klasse? {
        /*
         * Noden under markøren er hele attributtverdien, ikke ett klassenavn.
         * `class="fs-button fs-table"` er én node, så ordet må plukkes ut av
         * teksten med utgangspunkt i hvor markøren faktisk står.
         */
        val tekst = element.text ?: return null
        if (!tekst.contains("fs-")) return null

        // Står markøren på ett enkelt ord, er det ordet klassen.
        val ord = tekst.trim('"', '\'', ' ')
        Katalog.finn(ord)?.let { return it }

        // Ellers: den eneste Fristil-klassen i verdien, hvis det bare er én.
        val treff = ord.split(' ', '\t', '\n').mapNotNull { Katalog.finn(it) }
        return treff.singleOrNull()
    }
}
