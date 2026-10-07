package no.fristil

import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

/**
 * At JVM-versjonen svarer nøyaktig det TypeScript-versjonen svarer.
 *
 * Fasiten i `kjerne/paritet/`, én `.json` per `.html`, er skrevet av
 * `kjerne/scripts/bygg.ts` med TypeScript-versjonen av diagnostikken. Avviker
 * ett tegn i én melding eller én posisjon, feiler testen.
 */
class ParityTest {
    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    fun `svarer det samme som TypeScript`(name: String) {
        val html = File(DIR, "$name.html").readText()
        val expected = Json.parse(File(DIR, "$name.json").readText()) as Map<*, *>

        assertEquals(expected["markup"], toJson(Fristil.diagnoseMarkup(html)), "diagnoseMarkup")
        assertEquals(expected["side"], toJson(Fristil.diagnosePage(html)), "diagnosePage")
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
