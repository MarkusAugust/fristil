package no.lotek.intellij

import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * At feilmeldingene fra kjernen havner i editoren, på riktig sted, både i en
 * HTML-fil og i HTML injisert i en Kotlin-streng.
 */
class DiagnosticsTest : BasePlatformTestCase() {
    /** Funnene fra LO-TEK i fila, som teksten de dekker og meldingen. */
    private fun funn(
        filnavn: String,
        innhold: String,
    ): List<Pair<String, String>> {
        myFixture.configureByText(filnavn, innhold)
        val tekst = myFixture.editor.document.text
        return myFixture.doHighlighting(HighlightSeverity.WARNING)
            .filter { it.toolTip?.contains("LO-TEK:") == true }
            .map { tekst.substring(it.startOffset, it.endOffset) to it.description }
    }

    fun `test melder en ukjent klasse i en HTML-fil`() {
        val ut = funn("test.html", """<button class="lt-buton">Lagre</button>""")
        assertEquals("ett funn, fikk $ut", 1, ut.size)
        assertEquals("lt-buton", ut.single().first)
    }

    fun `test melder en ikonknapp uten navn i en fil uten lt-`() {
        // Regelen icon-without-name trenger ingen LO-TEK-klasse. Annotatoren
        // hoppet før over hver fil uten «lt-» i teksten, så `lotek sjekk`
        // og VS Code meldte knappen mens IntelliJ tidde.
        val ut = funn("test.html", """<button><svg aria-hidden="true"></svg></button>""")
        assertEquals("ett funn, fikk $ut", 1, ut.size)
        assertEquals("button", ut.single().first)
    }

    fun `test tier om riktig markup`() {
        val ut = funn("test.html", """<button class="lt-button" data-variant="secondary">Lagre</button>""")
        assertTrue("ingen funn, fikk $ut", ut.isEmpty())
    }

    fun `test melder i HTML injisert i en Kotlin-streng`() {
        val ut =
            funn(
                "Visning.kt",
                """
                // language=HTML
                val knapp = ""${'"'}
                    <button class="lt-button" data-variant="sekundær">Lagre</button>
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
                <!-- lotek-ignore-next unknown-class -->
                <div class="lt-eksperiment"></div>
                """.trimIndent(),
            )
        assertTrue("ingen funn, fikk $ut", ut.isEmpty())
    }

    /** Manifestet i pakken med `lt-card` byttet ut med `lt-kort`, som etter `lotek overta`. */
    private val overtatt =
        java.io.File(System.getProperty("manifest")).readText().replace("\"lt-card\": {", "\"lt-kort\": {")

    fun `test bruker prosjektets manifest fra build-lotek`() {
        myFixture.addFileToProject("build/lotek/manifest.json", overtatt)
        val ut = funn("test.html", """<div class="lt-kort">Søknad</div><div class="lt-card">Søknad</div>""")
        assertEquals("bare lt-card skal meldes, fikk $ut", listOf("lt-card"), ut.map { it.first })
    }

    fun `test leter oppover fra fila`() {
        myFixture.addFileToProject("node_modules/@lo-tek/interfaces/manifest/manifest.json", overtatt)
        val fil =
            myFixture.addFileToProject(
                "sider/form/side.html",
                """<div class="lt-kort">Søknad</div><div class="lt-card">Søknad</div>""",
            )
        myFixture.configureFromExistingVirtualFile(fil.virtualFile)
        val tekst = myFixture.editor.document.text
        val ut =
            myFixture.doHighlighting(HighlightSeverity.WARNING)
                .filter { it.toolTip?.contains("LO-TEK:") == true }
                .map { tekst.substring(it.startOffset, it.endOffset) }
        assertEquals("bare lt-card skal meldes, fikk $ut", listOf("lt-card"), ut)
    }

    fun `test bruker prosjektets manifest i et injisert fragment`() {
        myFixture.addFileToProject("build/lotek/manifest.json", overtatt)
        val ut =
            funn(
                "Visning.kt",
                """
                // language=HTML
                val kort = ""${'"'}
                    <div class="lt-kort">Søknad</div><div class="lt-card">Søknad</div>
                ""${'"'}
                """.trimIndent(),
            )
        assertEquals("bare lt-card skal meldes, fikk $ut", listOf("lt-card"), ut.map { it.first })
    }

    fun `test et manifest kjernen ikke kan lese gir pakkens`() {
        myFixture.addFileToProject("build/lotek/manifest.json", "{}")
        val ut = funn("test.html", """<div class="lt-kort">Søknad</div><div class="lt-card">Søknad</div>""")
        assertEquals("lt-kort skal meldes, fikk $ut", listOf("lt-kort"), ut.map { it.first })
    }

    fun `test en rettelse med flere endringer brukes under ett`() {
        // «Gi feltet id «epost»» skriver id på feltet og for på ledeteksten.
        myFixture.configureByText(
            "test.html",
            """<lt-field><label class="lt-label">E-post</label><inp<caret>ut class="lt-input" name="epost"></lt-field>""",
        )
        val rettelser = myFixture.availableIntentions.filter { it.familyName == "LO-TEK" }
        assertTrue("kjernen skal foreslå en rettelse, fikk ${myFixture.availableIntentions.map { it.text }}", rettelser.isNotEmpty())
        myFixture.launchAction(rettelser.first())
        assertEquals(
            """<lt-field><label for="epost" class="lt-label">E-post</label><input id="epost" class="lt-input" name="epost"></lt-field>""",
            myFixture.editor.document.text,
        )
    }

    fun `test en rettelse i en vanlig streng holder literalen hel`() {
        // Rettelsen setter inn anførselstegn. I en "…"-streng må de rømmes
        // gjennom vertsstrengen, ellers er literalen ødelagt etterpå.
        myFixture.configureByText(
            "Visning.kt",
            """
            // language=HTML
            val rad = "<lt-tabs><u<caret>l class='lt-tabs__list'><li><a href='#a'>A</a></li></ul><section class='lt-tabs__panel' id='a'></section></lt-tabs>"
            """.trimIndent(),
        )
        // Rettelsen hentes fra funnet, som i editoren: intensjonslista
        // fixturen gir, ser bare vertsfila.
        val funn = myFixture.doHighlighting().firstOrNull { it.description?.contains("fanerad uten navn") == true }
        assertNotNull("kjernen skal melde raden uten navn, fikk ${myFixture.doHighlighting().map { it.description }}", funn)
        var rettelse: com.intellij.codeInsight.intention.IntentionAction? = null
        funn!!.findRegisteredQuickFix { descriptor, _ ->
            if (descriptor.action.familyName == "LO-TEK") rettelse = descriptor.action
            null
        }
        assertNotNull("funnet skal ha en rettelse", rettelse)
        // `myFixture.file` er fragmentet når markøren står i det; vertsfila
        // er den som har literalen, og det er der rømmingen synes. Den hentes
        // før rettelsen, for fragmentet lages på nytt etterpå.
        val vert = com.intellij.lang.injection.InjectedLanguageManager.getInstance(project).getTopLevelFile(myFixture.file)
        myFixture.launchAction(rettelse!!)
        val tekst = vert.viewProvider.document!!.text
        assertTrue("aria-label skal stå rømt i strengen: $tekst", tekst.contains("""<ul aria-label=\"Deler av saken\" class='lt-tabs__list'>"""))
    }

    fun `test en rettelse i en streng med en mal i lar resten av strengen stå`() {
        // `$navn` deler fragmentet i to deler av vertsstrengen. Rettelsen skal
        // havne i den riktige delen, og ingenting annet i strengen endres.
        myFixture.configureByText(
            "Visning.kt",
            """
            val navn = "x"
            // language=HTML
            val rad = "<p>${'$'}navn</p><lt-tabs><u<caret>l class='lt-tabs__list'><li><a href='#a'>A</a></li></ul><section class='lt-tabs__panel' id='a'></section></lt-tabs>"
            """.trimIndent(),
        )
        val vert = com.intellij.lang.injection.InjectedLanguageManager.getInstance(project).getTopLevelFile(myFixture.file)
        val funn = myFixture.doHighlighting().firstOrNull { it.description?.contains("fanerad uten navn") == true }
        assertNotNull("kjernen skal melde raden uten navn, fikk ${myFixture.doHighlighting().mapNotNull { it.description }}", funn)
        var rettelse: com.intellij.codeInsight.intention.IntentionAction? = null
        funn!!.findRegisteredQuickFix { descriptor, _ ->
            if (descriptor.action.familyName == "LO-TEK") rettelse = descriptor.action
            null
        }
        assertNotNull("funnet skal ha en rettelse", rettelse)
        myFixture.launchAction(rettelse!!)
        val tekst = vert.viewProvider.document!!.text
        assertEquals(
            """
            val navn = "x"
            // language=HTML
            val rad = "<p>${'$'}navn</p><lt-tabs><ul aria-label=\"Deler av saken\" class='lt-tabs__list'><li><a href='#a'>A</a></li></ul><section class='lt-tabs__panel' id='a'></section></lt-tabs>"
            """.trimIndent(),
            tekst,
        )
    }

    fun `test rettelsen bytter ut teksten`() {
        myFixture.configureByText("test.html", """<button class="lt-buton<caret>">Lagre</button>""")
        val rettelser = myFixture.availableIntentions.filter { it.familyName == "LO-TEK" }
        assertTrue("kjernen skal foreslå en rettelse, fikk ${myFixture.availableIntentions.map { it.text }}", rettelser.isNotEmpty())
        myFixture.launchAction(rettelser.first())
        assertTrue("lt-button skal stå der nå: ${myFixture.editor.document.text}", myFixture.editor.document.text.contains("\"lt-button\""))
    }
}
