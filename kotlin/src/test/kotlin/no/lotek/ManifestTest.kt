package no.lotek

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * That the check can run against the project's own manifest, as the
 * language server and the IntelliJ plugin do, and that the package manifest
 * applies otherwise.
 */
class ManifestTest {
    private val packageManifest = File(System.getProperty("manifest")).readText()

    /** The manifest with `lt-card` replaced by `lt-kort`. */
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
     * The two below use one instance directly. Through the pool the next
     * call could have got another instance, which had never loaded anything,
     * and the test would have passed even without the manifest being reset.
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
