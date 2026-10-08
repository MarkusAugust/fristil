package no.fristil

import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

/**
 * At hver byggefunksjon i Kotlin svarer det `fs` i TypeScript svarer.
 *
 * Byggetilfellene i `designsystem/manifest/byggetilfeller.json` er skrevet av
 * `generate-manifest.ts`: hvert valg alene, og kombinasjonene av dem, med
 * svaret fra TypeScript. Både de genererte og de håndskrevne
 * byggefunksjonene prøves mot alle.
 */
class ContractTest {
    @ParameterizedTest(name = "{0}")
    @MethodSource("builders")
    fun `svarer det samme som TypeScript`(builder: String) {
        val cases = CASES.filter { it["builder"] == builder }
        assertTrue(cases.isNotEmpty(), "Ingen byggetilfeller for $builder")
        for (case in cases) {
            val options = case["options"] as Map<String, Any?>
            assertEquals(normalize(case["expected"]), normalize(Dispatch.call(builder, options)), "$builder($options)")
        }
    }

    @Test
    fun `hver byggefunksjon har byggetilfeller`() {
        assertEquals(Dispatch.names.sorted(), CASES.map { it["builder"] as String }.distinct().sorted())
    }

    @Test
    fun `attributtene skrives som HTML`() {
        val felt = Fs.field(id = "epost", invalid = true, error = true)
        assertEquals("""id="epost-error"""", felt.error.toHtml())
        assertEquals("""class="fs-label" for="epost"""", felt.label.toHtml())
        assertEquals(
            """class="fs-button" data-variant="secondary" title="a &amp; &quot;b&quot;"""",
            (Fs.button(variant = ButtonVariant.SECONDARY) + mapOf("title" to "a & \"b\"")).toHtml(),
        )
        assertEquals("hidden", Attributes(mapOf("hidden" to "")).toHtml())
    }

    @Test
    fun `tall skrives som i JavaScript`() {
        assertEquals("3", jsNumber(3))
        assertEquals("3", jsNumber(3.0))
        assertEquals("0.5", jsNumber(0.5))
        assertEquals("-2", jsNumber(-2))
    }

    companion object {
        @Suppress("UNCHECKED_CAST")
        private val CASES: List<Map<String, Any?>> by lazy {
            val file = File(System.getProperty("byggetilfeller"))
            (Json.parse(file.readText()) as Map<String, Any?>)["cases"] as List<Map<String, Any?>>
        }

        @JvmStatic
        fun builders(): List<String> = Dispatch.names

        /**
         * Svaret fra TypeScript har `true` for et flagg, Kotlin har den tomme
         * teksten, slik HTML skriver det. Ellers er formen den samme.
         */
        private fun normalize(value: Any?): Any? =
            when (value) {
                true -> ""
                is Map<*, *> -> value.entries.associate { (k, v) -> k to normalize(v) }
                is List<*> -> value.map(::normalize)
                else -> value
            }
    }
}
