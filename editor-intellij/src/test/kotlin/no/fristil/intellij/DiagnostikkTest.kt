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

    /** Manifestet i pakken med `fs-card` byttet ut med `fs-kort`, som etter `fristil overta`. */
    private val overtatt =
        java.io.File(System.getProperty("manifest")).readText().replace("\"fs-card\": {", "\"fs-kort\": {")

    fun `test bruker prosjektets manifest fra build-fristil`() {
        myFixture.addFileToProject("build/fristil/manifest.json", overtatt)
        val ut = funn("test.html", """<div class="fs-kort">Søknad</div><div class="fs-card">Søknad</div>""")
        assertEquals("bare fs-card skal meldes, fikk $ut", listOf("fs-card"), ut.map { it.first })
    }

    fun `test leter oppover fra fila`() {
        myFixture.addFileToProject("node_modules/@fristil/designsystem/manifest/manifest.json", overtatt)
        val fil = myFixture.addFileToProject("sider/skjema/side.html", """<div class="fs-kort">Søknad</div>""")
        myFixture.configureFromExistingVirtualFile(fil.virtualFile)
        val ut = myFixture.doHighlighting(HighlightSeverity.WARNING).filter { it.toolTip?.contains("Fristil:") == true }
        assertTrue("ingen funn, fikk ${ut.map { it.description }}", ut.isEmpty())
    }

    fun `test bruker prosjektets manifest i et injisert fragment`() {
        myFixture.addFileToProject("build/fristil/manifest.json", overtatt)
        val ut =
            funn(
                "Visning.kt",
                """
                // language=HTML
                val kort = ""${'"'}
                    <div class="fs-kort">Søknad</div>
                ""${'"'}
                """.trimIndent(),
            )
        assertTrue("ingen funn, fikk $ut", ut.isEmpty())
    }

    fun `test et manifest kjernen ikke kan lese gir det innebygde`() {
        myFixture.addFileToProject("build/fristil/manifest.json", "{}")
        val ut = funn("test.html", """<div class="fs-kort">Søknad</div><div class="fs-card">Søknad</div>""")
        assertEquals("fs-kort skal meldes, fikk $ut", listOf("fs-kort"), ut.map { it.first })
    }

    fun `test rettelsen bytter ut teksten`() {
        myFixture.configureByText("test.html", """<button class="fs-buton<caret>">Lagre</button>""")
        val rettelser = myFixture.availableIntentions.filter { it.familyName == "Fristil" }
        assertTrue("kjernen skal foreslå en rettelse, fikk ${myFixture.availableIntentions.map { it.text }}", rettelser.isNotEmpty())
        myFixture.launchAction(rettelser.first())
        assertTrue("fs-button skal stå der nå: ${myFixture.editor.document.text}", myFixture.editor.document.text.contains("\"fs-button\""))
    }
}
