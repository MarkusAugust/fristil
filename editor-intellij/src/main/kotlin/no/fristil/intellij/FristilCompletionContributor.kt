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
         * bindestrek. Den antakelsen var feil: testet i en attributtverdi gir
         * `class="fs-` hele lista, og `class="min-egen fs-but` fullfører til
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

            /*
             * Finn taggen markøren står i.
             *
             * `<` kan ikke stå i en attributtverdi i gyldig HTML, så den
             * siste før markøren åpner taggen. Er det et `>` etter den, er
             * taggen lukket og markøren står i vanlig tekst.
             */
            val tagg = tekst.lastIndexOf('<', posisjon - 1)
            if (tagg < 0) return false
            if (tekst.indexOf('>', tagg).let { it in 0 until posisjon }) return false

            /*
             * Åpnende eller lukkende anførselstegn?
             *
             * Å gå bakover til nærmeste anførselstegn er ikke nok:
             * `<div title="class=" fs-` bryter på det *lukkende*, og da står
             * `=` fra verdiens innhold igjen og ser ut som et attributt.
             * Antallet anførselstegn fra taggens start avgjør: oddetall betyr
             * at det siste åpnet en verdi vi fortsatt står i.
             */
            var antall = 0
            var sisteSitat = -1
            for (j in tagg until posisjon) {
                if (tekst[j] == '"' || tekst[j] == '\'') {
                    antall++
                    sisteSitat = j
                }
            }

            val før =
                if (antall % 2 == 1) {
                    // I en sitert verdi. Mellomrom skiller klasser, ikke noe
                    // mer, så alt fram til anførselstegnet hører til verdien.
                    val utenSitat = tekst.substring(tagg, sisteSitat).trimEnd()
                    if (!utenSitat.endsWith("=")) return false
                    utenSitat.dropLast(1)
                } else {
                    /*
                     * Utenfor en verdi, eller i en bar en. Bar verdi er
                     * gyldig HTML, og `<div class=fs-` ga ingenting da bare
                     * anførselstegn talte. Her avslutter et mellomrom
                     * verdien, i motsetning til i den siterte.
                     */
                    val fra = tekst.substring(tagg, posisjon)
                    val likhet = fra.lastIndexOf('=')
                    if (likhet < 0) return false
                    if (fra.substring(likhet + 1).any { it.isWhitespace() }) return false
                    fra.substring(0, likhet)
                }

            val navn = før.trimEnd().takeLastWhile { it.isLetterOrDigit() || it == '-' }
            return navn.equals("class", ignoreCase = true)
        }
    }
}
