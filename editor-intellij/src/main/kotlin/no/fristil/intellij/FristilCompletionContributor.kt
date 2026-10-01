package no.fristil.intellij

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.icons.AllIcons

/**
 * Foreslår Fristils klasser inne i `class="…"`.
 *
 * Registrert på HTML-språket, ikke på Kotlin. Injiserer IntelliJ HTML i en
 * streng, blir fragmentet et ekte `PsiFile` med HTML-språk, og denne kalles
 * for det. Den samme registreringen dekker derfor vanlige `.html`-filer,
 * Kotlin-strenger og TypeScript-strenger.
 *
 * Det er nettopp hullet pluginen finnes for: `web-types.json` gir fullføring
 * i HTML-filer uten noe plugin, men leses ikke inn i injiserte fragmenter.
 */
class FristilCompletionContributor : CompletionContributor() {
    override fun fillCompletionVariants(
        parameters: CompletionParameters,
        result: CompletionResultSet,
    ) {
        if (parameters.completionType != CompletionType.BASIC) return

        val tekst = parameters.originalFile.text
        val posisjon = parameters.offset
        if (!iKlasseverdi(tekst, posisjon)) return

        /*
         * Prefikset er IntelliJs eget.
         *
         * Her sto først en egen matcher som leste bakover til nærmeste
         * mellomrom, skrevet på antakelsen om at IntelliJ deler ord på
         * bindestrek. Den antakelsen var feil: målt i en attributtverdi gir
         * `class="fs-` alle 72, og `class="min-egen fs-but` fullfører til
         * `fs-button`, med og uten matcheren. Koden gjorde altså ingenting,
         * og er borte.
         */
        for (klasse in Katalog.klasser) {
            result.addElement(
                LookupElementBuilder.create(klasse.navn)
                    .withIcon(AllIcons.Xml.Css_class)
                    .withTypeText(klasse.komponent, true)
                    .withCaseSensitivity(false),
            )
        }
    }

    private companion object {
        /**
         * Om markøren står inne i verdien til et `class`-attributt.
         *
         * Leser bakover i teksten framfor å gå i PSI-treet. Et injisert
         * fragment kan være ufullstendig mens du skriver, og da er treet
         * ustabilt: `<table class="fs-` har ingen lukket tagg og ingen
         * attributtnode å spørre. Teksten bakover er den samme uansett.
         */
        fun iKlasseverdi(
            tekst: String,
            posisjon: Int,
        ): Boolean {
            if (posisjon <= 0 || posisjon > tekst.length) return false

            // Finn anførselstegnet verdien åpner med.
            var i = posisjon - 1
            while (i >= 0) {
                val tegn = tekst[i]
                if (tegn == '"' || tegn == '\'') break
                // En tagg kan ikke lukkes inne i en attributtverdi.
                if (tegn == '>' || tegn == '<') return false
                i--
            }
            if (i < 0) return false

            // Rett før anførselstegnet skal det stå `class=`, med rom rundt.
            val før = tekst.substring(0, i).trimEnd()
            if (!før.endsWith("=")) return false
            val navn = før.dropLast(1).trimEnd().takeLastWhile { it.isLetterOrDigit() || it == '-' }
            return navn.equals("class", ignoreCase = true)
        }
    }
}
