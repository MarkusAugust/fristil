package no.fristil

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * At sjekken kan gå mot prosjektets eget manifest, slik språkserveren og
 * IntelliJ-pluginen gjør, og at det innebygde gjelder ellers.
 */
class ManifestTest {
    private val builtin = File(System.getProperty("manifest")).readText()

    /** Manifestet med `fs-card` byttet ut med `fs-kort`. */
    private val takenOver = builtin.replace("\"fs-card\": {", "\"fs-kort\": {")

    private fun rules(html: String, manifest: String? = null) =
        Fristil.diagnoseMarkup(html, manifest = manifest).map { it.rule }

    @Test
    fun `checks against the manifest it is given`() {
        assertEquals(listOf("ukjent-klasse"), rules("""<div class="fs-kort">x</div>"""))
        assertEquals(emptyList(), rules("""<div class="fs-kort">x</div>""", takenOver))
        assertEquals(listOf("ukjent-klasse"), rules("""<div class="fs-card">x</div>""", takenOver))
        assertEquals(
            emptyList(),
            Fristil.diagnosePage("""<div class="fs-kort">x</div>""", manifest = takenOver).map { it.rule },
        )
        assertEquals(
            listOf("ustylet-klasse"),
            Fristil
                .diagnoseMarkup("""<div class="fs-kort">x</div>""", css = emptyList(), manifest = takenOver)
                .map { it.rule },
        )
    }

    @Test
    fun `the built-in manifest applies again without one`() {
        assertEquals(emptyList(), rules("""<div class="fs-kort">x</div>""", takenOver))
        assertEquals(emptyList(), rules("""<div class="fs-card">x</div>"""))
    }

    @Test
    fun `a manifest the core cannot read throws, and the built-in one applies after`() {
        val error = assertFailsWith<IllegalArgumentException> { rules("<p>x</p>", "{\"classes\": 3}") }
        assertContains(error.message.orEmpty(), "schemaVersion")
        assertEquals(emptyList(), rules("""<div class="fs-card">x</div>"""))
    }
}
