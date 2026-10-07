package no.fristil

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
    private val json = jacksonObjectMapper()

    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    fun `svarer det samme som TypeScript`(name: String) {
        val html = File(DIR, "$name.html").readText()
        val expected = json.readTree(File(DIR, "$name.json"))

        assertEquals(expected["markup"], toJson(Fristil.diagnoseMarkup(html)), "diagnoseMarkup")
        assertEquals(expected["side"], toJson(Fristil.diagnosePage(html)), "diagnosePage")
    }

    @org.junit.jupiter.api.Test
    fun `posisjonene peker på riktig tekst i en Kotlin-streng`() {
        val html = File(DIR, "09-norske-tegn.html").readText()
        val finding = Fristil.diagnoseMarkup(html).single()
        assertEquals("data-variant=\"sekundær\"", html.substring(finding.start, finding.end))
    }

    // `fix` og `preferred` utelates i JSON når de mangler, som i TypeScript.
    private fun toJson(findings: List<Finding>): JsonNode =
        json.valueToTree<JsonNode>(findings).onEach { node ->
            (node as com.fasterxml.jackson.databind.node.ObjectNode).apply {
                // Regel, linje og kolonne finnes bare i kjernen, ikke i fasiten fra TypeScript.
                remove(listOf("rule", "line", "column"))
                if (get("fix")?.isNull == true) remove("fix")
                (get("fix") as? com.fasterxml.jackson.databind.node.ObjectNode)?.let {
                    if (it.get("preferred")?.isNull == true) it.remove("preferred")
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
