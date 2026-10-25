package no.lotek

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * At sjekken kan gå mot prosjektets eget manifest, slik språkserveren og
 * IntelliJ-pluginen gjør, og at manifestet i pakken gjelder ellers.
 */
class ManifestTest {
    private val packageManifest = File(System.getProperty("manifest")).readText()

    /** Manifestet med `lt-card` byttet ut med `lt-kort`. */
    private val takenOver = packageManifest.replace("\"lt-card\": {", "\"lt-kort\": {")

    private fun rules(html: String, manifest: String? = null) =
        Lotek.diagnoseMarkup(html, manifest = manifest).map { it.rule }

    @Test
    fun `checks against the manifest it is given`() {
        assertEquals(listOf("unknown-class"), rules("""<div class="lt-kort">x</div>"""))
        assertEquals(emptyList(), rules("""<div class="lt-kort">x</div>""", takenOver))
        assertEquals(listOf("unknown-class"), rules("""<div class="lt-card">x</div>""", takenOver))
        assertEquals(
            emptyList(),
            Lotek.diagnosePage("""<div class="lt-kort">x</div>""", manifest = takenOver).map { it.rule },
        )
        assertEquals(
            listOf("unstyled-class"),
            Lotek
                .diagnoseMarkup("""<div class="lt-kort">x</div>""", css = emptyList(), manifest = takenOver)
                .map { it.rule },
        )
    }

    /*
     * De to under bruker én instans direkte. Gjennom poolen kunne neste kall
     * fått en annen instans, som aldri hadde lastet noe, og testen ville
     * bestått også uten at manifestet ble satt tilbake.
     */
    private fun Core.rules(html: String, manifest: String? = null): List<String> {
        use(manifest)
        return (Json.parse(callWithStatus("diagnose_markup_raw", html).second) as List<*>).map { (it as Map<*, *>)["rule"] as String }
    }

    @Test
    fun `the package manifest applies again without one`() {
        val core = Core()
        assertEquals(emptyList(), core.rules("""<div class="lt-kort">x</div>""", takenOver))
        assertEquals(listOf("unknown-class"), core.rules("""<div class="lt-kort">x</div>"""))
    }

    @Test
    fun `a manifest the core cannot read throws, and the package manifest applies after`() {
        val core = Core()
        core.rules("<p>x</p>", takenOver)
        val error = assertFailsWith<IllegalArgumentException> { core.rules("<p>x</p>", "{\"classes\": 3}") }
        assertContains(error.message.orEmpty(), "schemaVersion")
        assertEquals(listOf("unknown-class"), core.rules("""<div class="lt-kort">x</div>"""))
    }
}
