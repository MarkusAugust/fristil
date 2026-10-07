package no.fristil.sjekk

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
 * Fasiten i `paritet/`, én `.json` per `.html`, er skrevet av `jvm/scripts/bygg.ts` med den
 * samme diagnostikken kjørt i Bun. Avviker ett tegn i én melding eller én
 * posisjon, feiler testen: da er det to implementasjoner, og det er nettopp
 * det dette biblioteket skal unngå.
 */
class ParitetTest {
    private val json = jacksonObjectMapper()

    @ParameterizedTest(name = "{0}")
    @MethodSource("fiksturer")
    fun `svarer det samme som TypeScript`(navn: String) {
        val html = File(MAPPE, "$navn.html").readText()
        val fasit = json.readTree(File(MAPPE, "$navn.json"))

        assertEquals(fasit["markup"], tilJson(Fristil.diagnoseMarkup(html)), "diagnoseMarkup")
        assertEquals(fasit["side"], tilJson(Fristil.diagnosePage(html)), "diagnosePage")
    }

    @org.junit.jupiter.api.Test
    fun `posisjonene peker på riktig tekst i en Kotlin-streng`() {
        val html = File(MAPPE, "09-norske-tegn.html").readText()
        val funn = Fristil.diagnoseMarkup(html).single()
        assertEquals("data-variant=\"sekundær\"", html.substring(funn.start, funn.end))
    }

    // `fix` og `preferred` utelates i JSON når de mangler, som i TypeScript.
    private fun tilJson(funn: List<Funn>): JsonNode =
        json.valueToTree<JsonNode>(funn).onEach { node ->
            (node as com.fasterxml.jackson.databind.node.ObjectNode).apply {
                if (get("fix")?.isNull == true) remove("fix")
                (get("fix") as? com.fasterxml.jackson.databind.node.ObjectNode)?.let {
                    if (it.get("preferred")?.isNull == true) it.remove("preferred")
                }
            }
        }

    companion object {
        private val MAPPE = File("src/test/resources/paritet")

        @JvmStatic
        fun fiksturer(): List<String> {
            val navn = MAPPE.listFiles { f -> f.name.endsWith(".html") }!!.map { it.nameWithoutExtension }.sorted()
            assertTrue(navn.isNotEmpty(), "Ingen fiksturer i $MAPPE")
            return navn
        }
    }
}
