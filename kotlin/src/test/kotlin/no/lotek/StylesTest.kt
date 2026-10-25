package no.lotek

import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** The check with the stylesheets: what the CSS the page loads does not style. */
class StylesTest {
    private val css = listOf(""".lt-button { } .lt-button[data-variant="ghost"] { }""")

    @Test
    fun `says what the style sheets do not style`() {
        val html = """<button class="lt-button" data-variant="danger">x</button><div class="lt-card">"ø"</div>"""
        val findings = Lotek.diagnoseMarkup(html, css)
        assertEquals(listOf("unstyled-value", "unstyled-class"), findings.map { it.rule })
        assertEquals("lt-card", html.substring(findings[1].start, findings[1].end))
        assertTrue(Lotek.diagnoseMarkup("""<button class="lt-button" data-variant="ghost">x</button>""", css).isEmpty())
        // Without stylesheets it is as before.
        assertTrue(Lotek.diagnoseMarkup(html).isEmpty())
        // An empty list is a page without stylesheets, as in TypeScript.
        assertEquals(listOf("unstyled-class", "unstyled-class"), Lotek.diagnoseMarkup(html, emptyList()).map { it.rule })
    }

    @Test
    fun `checks a rendered page`() {
        val rendered = mapOf("html" to "<!DOCTYPE html><html><body><div class=\"lt-card\"></div></body></html>", "css" to css)
        val error = assertFailsWith<AssertionError> { assertLotekRendered { script ->
            assertContains(script, "document.styleSheets")
            rendered
        } }
        assertContains(error.message!!, "unstyled-class")
    }

    @Test
    fun `markup with quotes, newlines and control characters reaches the core unchanged`() {
        val html = "<p title=\"«\\\"\u0001»\">🧾\n\t</p>\r\n<div class=\"lt-card\">x</div>"
        val finding = Lotek.diagnosePage(html, css).single { it.rule == "unstyled-class" }
        assertEquals("lt-card", html.substring(finding.start, finding.end))
    }
}
