package no.fristil

import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Sjekken med stilarkene: det CSS-en siden laster ikke styler. */
class StylesTest {
    private val css = listOf(""".fs-button { } .fs-button[data-variant="ghost"] { }""")

    @Test
    fun `says what the style sheets do not style`() {
        val html = """<button class="fs-button" data-variant="danger">x</button><div class="fs-card">"ø"</div>"""
        val findings = Fristil.diagnoseMarkup(html, css)
        assertEquals(listOf("ustylet-verdi", "ustylet-klasse"), findings.map { it.rule })
        assertEquals("fs-card", html.substring(findings[1].start, findings[1].end))
        assertTrue(Fristil.diagnoseMarkup("""<button class="fs-button" data-variant="ghost">x</button>""", css).isEmpty())
        // Uten stilark er det som før.
        assertTrue(Fristil.diagnoseMarkup(html).isEmpty())
        // En tom liste er en side uten stilark, som i TypeScript.
        assertEquals(listOf("ustylet-klasse", "ustylet-klasse"), Fristil.diagnoseMarkup(html, emptyList()).map { it.rule })
    }

    @Test
    fun `checks a rendered page`() {
        val rendered = mapOf("html" to "<!DOCTYPE html><html><body><div class=\"fs-card\"></div></body></html>", "css" to css)
        val error = assertFailsWith<AssertionError> { assertFristilRendered { script ->
            assertContains(script, "document.styleSheets")
            rendered
        } }
        assertContains(error.message!!, "ustylet-klasse")
    }

    @Test
    fun `markup with quotes, newlines and control characters reaches the core unchanged`() {
        val html = "<p title=\"«\\\"\u0001»\">🧾\n\t</p>\r\n<div class=\"fs-card\">x</div>"
        val finding = Fristil.diagnosePage(html, css).single { it.rule == "ustylet-klasse" }
        assertEquals("fs-card", html.substring(finding.start, finding.end))
    }
}
