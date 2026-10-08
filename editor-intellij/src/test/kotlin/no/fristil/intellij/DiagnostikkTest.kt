package no.fristil.intellij

import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * At feilmeldingene fra kjernen havner i editoren, på riktig sted, både i en
 * HTML-fil og i HTML injisert i en Kotlin-streng.
 */
class DiagnostikkTest : BasePlatformTestCase() {
    /** Funnene fra Fristil i fila, som teksten de dekker og meldingen. */
    private fun funn(
        filnavn: String,
        innhold: String,
    ): List<Pair<String, String>> {
        myFixture.configureByText(filnavn, innhold)
        val tekst = myFixture.editor.document.text
        return myFixture.doHighlighting(HighlightSeverity.WARNING)
            .filter { it.toolTip?.contains("Fristil:") == true }
            .map { tekst.substring(it.startOffset, it.endOffset) to it.description }
    }

    fun `test melder en ukjent klasse i en HTML-fil`() {
        val ut = funn("test.html", """<button class="fs-buton">Lagre</button>""")
        assertEquals("ett funn, fikk $ut", 1, ut.size)
        assertEquals("fs-buton", ut.single().first)
    }

    fun `test tier om riktig markup`() {
        val ut = funn("test.html", """<button class="fs-button" data-variant="secondary">Lagre</button>""")
        assertTrue("ingen funn, fikk $ut", ut.isEmpty())
    }

    fun `test melder i HTML injisert i en Kotlin-streng`() {
        val ut =
            funn(
                "Visning.kt",
                """
                // language=HTML
                val knapp = ""${'"'}
                    <button class="fs-button" data-variant="sekundær">Lagre</button>
                ""${'"'}
                """.trimIndent(),
            )
        assertEquals("ett funn, fikk $ut", 1, ut.size)
        assertTrue("funnet skal dekke attributtet, fikk $ut", ut.single().first.startsWith("data-variant"))
    }

    fun `test undertrykking med en kommentar virker`() {
        val ut =
            funn(
                "test.html",
                """
                <!-- fristil-ignore-next ukjent-klasse -->
                <div class="fs-eksperiment"></div>
                """.trimIndent(),
            )
        assertTrue("ingen funn, fikk $ut", ut.isEmpty())
    }

    fun `test rettelsen bytter ut teksten`() {
        myFixture.configureByText("test.html", """<button class="fs-buton<caret>">Lagre</button>""")
        val rettelser = myFixture.availableIntentions.filter { it.familyName == "Fristil" }
        assertTrue("kjernen skal foreslå en rettelse, fikk ${myFixture.availableIntentions.map { it.text }}", rettelser.isNotEmpty())
        myFixture.launchAction(rettelser.first())
        assertTrue("fs-button skal stå der nå: ${myFixture.editor.document.text}", myFixture.editor.document.text.contains("\"fs-button\""))
    }
}
