package no.fristil

import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

/**
 * At kjernen svarer det samme på JVM-en som i Node og nettleseren.
 *
 * Det er den samme WebAssembly-modulen, så det som testes her, er det som
 * ligger rundt den: Chicory, posisjonene i UTF-16, JSON-en og feltene i
 * `Finding`. Fasiten i `kjerne/paritet/`, én `.json` per `.html`, er den
 * samme `kjerne/scripts/sjekk-kjerne.ts` krever av modulen i Bun, og den
 * sjekken krever også at fiksturene til sammen utløser hver regel i
 * `kjerne/src/types.rs`. En fikstur med en `.css` ved siden av testes også
 * med stilarket, som [Fristil.diagnoseRendered]. Avviker ett tegn i én
 * melding eller én posisjon, feiler testen.
 *
 * Skriptet som leser den rendrede siden, [Fristil.READ_RENDERED_PAGE], testes
 * ikke her, men av `designsystem/scripts/sjekk-rendret.ts`, som kjører det i
 * en ekte nettleser ved siden av utgaven i TypeScript.
 */
class ParityTest {
    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    fun `svarer det samme som TypeScript`(name: String) {
        val html = File(DIR, "$name.html").readText()
        val expected = Json.parse(File(DIR, "$name.json").readText()) as Map<*, *>

        assertEquals(expected["markup"], toJson(Fristil.diagnoseMarkup(html)), "diagnoseMarkup")
        assertEquals(expected["side"], toJson(Fristil.diagnosePage(html)), "diagnosePage")
        val css = File(DIR, "$name.css")
        assertEquals(css.exists(), expected.containsKey("stylet"), "stylet i fasiten og .css ved siden av hører sammen")
        if (css.exists()) {
            val rendered = mapOf("html" to html, "css" to listOf(css.readText()))
            assertEquals(expected["stylet"], toJson(Fristil.diagnoseRendered(rendered)), "diagnoseRendered")
        }
    }

    @org.junit.jupiter.api.Test
    fun `posisjonene peker på riktig tekst i en Kotlin-streng`() {
        val html = File(DIR, "09-norske-tegn.html").readText()
        val finding = Fristil.diagnoseMarkup(html).single()
        assertEquals("data-variant=\"sekundær\"", html.substring(finding.start, finding.end))
    }

    @org.junit.jupiter.api.Test
    fun `assertFristil feiler med funnene som melding`() {
        assertFristil("""<button class="fs-button">Lagre</button>""")
        val error = kotlin.test.assertFailsWith<AssertionError> {
            assertFristil("""<button class="fs-buton">Lagre</button>""", fragment = true)
        }
        assertEquals(
            "Fristil fant ett funn:\n1:16: advarsel: ${Fristil.diagnoseMarkup("<button class=\"fs-buton\">").single().message} [ukjent-klasse]",
            error.message,
        )
    }

    /*
     * Funnene i formen fasiten har. Regel, linje og kolonne finnes bare i
     * kjernen, ikke i fasiten fra TypeScript, og `fix` og `preferred` utelates
     * når de mangler, som i TypeScript.
     */
    private fun toJson(findings: List<Finding>): List<Map<String, Any>> =
        findings.map { f ->
            buildMap {
                put("start", f.start.toDouble())
                put("end", f.end.toDouble())
                put("message", f.message)
                put("severity", f.severity)
                put("link", f.link)
                f.fix?.let { fix ->
                    put(
                        "fix",
                        buildMap {
                            put("title", fix.title)
                            put("start", fix.start.toDouble())
                            put("end", fix.end.toDouble())
                            put("text", fix.text)
                            fix.preferred?.let { put("preferred", it) }
                        },
                    )
                }
            }
        }

    companion object {
        private val DIR = File(System.getProperty("paritet"))

        @JvmStatic
        fun fixtures(): List<String> {
            val names = DIR.listFiles { f -> f.name.endsWith(".html") }!!.map { it.nameWithoutExtension }.sorted()
            assertTrue(names.isNotEmpty(), "Ingen fiksturer i $DIR")
            return names
        }
    }
}
