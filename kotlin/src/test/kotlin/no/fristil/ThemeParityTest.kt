package no.fristil

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

/**
 * At temaet svarer det samme på JVM-en som i Node og nettleseren.
 *
 * Fasiten i `kjerne/tema/` er den samme `kjerne/scripts/sjekk-kjerne.ts`
 * krever av modulen i Bun: `oppskrifter.json` har hver oppskrift med temaet
 * `buildTheme` skal gi, eller feilen den skal avvise med, og `rapporter.json`
 * har svaret `inspectTheme` skal gi for hvert tema skrevet som CSS ved siden
 * av. Det som testes her er det som ligger rundt modulen: oversettelsen av
 * oppskriften, JSON-en og feltene i [Theme] og [ThemeReport].
 */
class ThemeParityTest {
    @ParameterizedTest(name = "{0}")
    @MethodSource("recipes")
    fun `buildTheme svarer det samme som TypeScript`(name: String) {
        val case = RECIPES.getValue(name) as Map<*, *>
        val recipe = Json.write(case["oppskrift"])
        val expectedError = case["feil"] as String?
        if (expectedError != null) {
            assertEquals(expectedError, assertFailsWith<IllegalArgumentException> { Fristil.buildTheme(recipe) }.message)
            return
        }
        val expected = case["tema"] as Map<*, *>
        val theme = Fristil.buildTheme(recipe)
        assertEquals(expected["light"], theme.light, "light")
        assertEquals(expected["dark"], theme.dark, "dark")
        assertEquals(
            expected["violations"],
            theme.violations.map { mapOf("family" to it.family, "promise" to it.promise, "ratio" to it.ratio, "required" to it.required) },
            "violations",
        )
        assertEquals(expected["css"], theme.css, "css")
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("themes")
    fun `inspectTheme svarer det samme som TypeScript`(name: String) {
        val expected = REPORTS.getValue(name) as Map<*, *>
        val report = Fristil.inspectTheme(File(DIR, "$name.css").readText())
        assertEquals(
            expected["problems"],
            report.problems.map { mapOf("selector" to it.selector, "message" to it.message) },
            "problems",
        )
        assertEquals(
            listOf(expected["blocks"], expected["declarations"], expected["promises"]),
            listOf(report.blocks, report.declarations, report.promises).map { it.toDouble() },
            "tallene",
        )
    }

    @Test
    fun `norske og engelske nøkler gir det samme temaet`() {
        val norwegian = Fristil.buildTheme("""{"aksent": "#7c3aed", "fare": "#b3261e", "form": {"buttonRadius": "0"}}""")
        val english = Fristil.buildTheme("""{"accent": "#7c3aed", "danger": "#b3261e", "shape": {"buttonRadius": "0"}}""")
        assertEquals(english, norwegian)
        assertTrue(norwegian.light.isNotEmpty() && norwegian.violations.isEmpty() && "--fs-button-radius" in norwegian.css)
    }

    @Test
    fun `en oppskrift med en ukjent nøkkel kaster før kjernen ser den`() {
        val error = assertFailsWith<IllegalArgumentException> { Fristil.buildTheme("""{"aksent": "#7c3aed", "acent": "#000", "form": {"radius": "0"}}""") }
        assertEquals("Ukjent nøkkel i oppskriften: acent, form.radius", error.message)
        assertFailsWith<IllegalArgumentException> { Fristil.buildTheme("[]") }
    }

    companion object {
        private val DIR = File(System.getProperty("tema"))

        @Suppress("UNCHECKED_CAST")
        private val RECIPES = Json.parse(File(DIR, "oppskrifter.json").readText()) as Map<String, Any?>

        @Suppress("UNCHECKED_CAST")
        private val REPORTS = Json.parse(File(DIR, "rapporter.json").readText()) as Map<String, Any?>

        @JvmStatic
        fun recipes(): List<String> {
            assertTrue(RECIPES.isNotEmpty() && RECIPES.values.any { (it as Map<*, *>).containsKey("feil") }, "Fasiten skal ha oppskrifter, og minst én som avvises")
            return RECIPES.keys.sorted()
        }

        @JvmStatic
        fun themes(): List<String> {
            val names = REPORTS.keys.sorted()
            assertTrue(names.isNotEmpty(), "Ingen temaer i $DIR")
            for (name in names) assertTrue(File(DIR, "$name.css").exists(), "$name.css mangler ved siden av rapporten")
            return names
        }
    }
}
