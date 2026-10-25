package no.lotek

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

/**
 * That the theme answers the same on the JVM as in Node and the browser.
 *
 * The expected results in `core/theme/` are the same ones
 * `core/scripts/check-core.ts` requires of the module in Bun: `recipes.json`
 * has every recipe with the theme `buildTheme` must give, or the error it
 * must reject with, and `reports.json` has the result `inspectTheme` must
 * give for every theme written as CSS next to it. What is tested here is
 * what surrounds the module: the translation of the recipe, the JSON and the
 * fields of [Theme] and [ThemeReport].
 *
 * No recipe in the expected results gives a non-empty `violations`, and
 * that is not a gap in them: the promises hold by construction, so the core
 * gives none for a recipe it accepts. The fields of [ThemeViolation] are
 * read against `build_theme_raw` in `core/src/lib.rs`, not against a case.
 */
class ThemeParityTest {
    @ParameterizedTest(name = "{0}")
    @MethodSource("recipes")
    fun `buildTheme answers the same as TypeScript`(name: String) {
        val case = RECIPES.getValue(name) as Map<*, *>
        val recipe = Json.write(case["oppskrift"])
        val expectedError = case["feil"] as String?
        if (expectedError != null) {
            assertEquals(expectedError, assertFailsWith<IllegalArgumentException> { Lotek.buildTheme(recipe) }.message)
            return
        }
        val expected = case["theme"] as Map<*, *>
        assertEquals(setOf("light", "dark", "violations", "css"), expected.keys, "the expected results have a field the reader does not compare")
        val theme = Lotek.buildTheme(recipe)
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
    fun `inspectTheme answers the same as TypeScript`(name: String) {
        val expected = REPORTS.getValue(name) as Map<*, *>
        assertEquals(setOf("problems", "blocks", "declarations", "promises"), expected.keys, "the expected results have a field the reader does not compare")
        val report = Lotek.inspectTheme(File(DIR, "$name.css").readText())
        assertEquals(
            expected["problems"],
            report.problems.map { mapOf("selector" to it.selector, "message" to it.message) },
            "problems",
        )
        assertEquals(
            listOf(expected["blocks"], expected["declarations"], expected["promises"]),
            listOf(report.blocks, report.declarations, report.promises).map { it.toDouble() },
            "the counts",
        )
    }

    @Test
    fun `Norwegian keys are unknown keys`() {
        val error = assertFailsWith<IllegalArgumentException> { Lotek.buildTheme("""{"aksent": "#7c3aed", "form": {"buttonRadius": "0"}}""") }
        assertEquals("Unknown key in the recipe: aksent, form", error.message)
    }

    @Test
    fun `a recipe with an unknown key throws before the core sees it`() {
        val error = assertFailsWith<IllegalArgumentException> { Lotek.buildTheme("""{"accent": "#7c3aed", "acent": "#000", "shape": {"radius": "0"}}""") }
        assertEquals("Unknown key in the recipe: acent, shape.radius", error.message)
        // A string or list where an object should have been, as `lotek theme` reports it.
        val text = assertFailsWith<IllegalArgumentException> { Lotek.buildTheme("""{"accent": "#7c3aed", "typography": "Inter"}""") }
        assertEquals("Unknown key in the recipe: typography.0, typography.1, typography.2, typography.3, typography.4", text.message)
        val list = assertFailsWith<IllegalArgumentException> { Lotek.buildTheme("""{"typography": {"weights": [400]}}""") }
        assertEquals("Unknown key in the recipe: typography.weights.0", list.message)
        assertFailsWith<IllegalArgumentException> { Lotek.buildTheme("[]") }
    }

    companion object {
        private val DIR = File(System.getProperty("theme"))

        @Suppress("UNCHECKED_CAST")
        private val RECIPES = Json.parse(File(DIR, "recipes.json").readText()) as Map<String, Any?>

        @Suppress("UNCHECKED_CAST")
        private val REPORTS = Json.parse(File(DIR, "reports.json").readText()) as Map<String, Any?>

        @JvmStatic
        fun recipes(): List<String> {
            assertTrue(RECIPES.isNotEmpty() && RECIPES.values.any { (it as Map<*, *>).containsKey("feil") }, "The expected results must have recipes, and at least one that is rejected")
            return RECIPES.keys.sorted()
        }

        @JvmStatic
        fun themes(): List<String> {
            val names = REPORTS.keys.sorted()
            assertTrue(names.isNotEmpty(), "No themes in $DIR")
            // Both ways: a theme without a report would otherwise never be inspected.
            val css = DIR.listFiles { f -> f.name.endsWith(".css") }!!.map { it.nameWithoutExtension }.sorted()
            assertEquals(css, names, "the themes in $DIR and the reports in reports.json must be the same")
            return names
        }
    }
}
