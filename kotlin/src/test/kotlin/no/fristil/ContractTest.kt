package no.fristil

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Kjører hver byggefunksjon mot tilfellene TypeScript har skrevet.
 *
 * `contract/cases.json` er svarene fra `@fristil/designsystem`, generert av
 * `designsystem/scripts/generate-contract.ts`. Gir Kotlin et annet svar på
 * ett eneste tilfelle, feiler testen med inndata, svaret TypeScript ga og
 * svaret Kotlin ga.
 */
class ContractTest {
    private val contract: JsonObject by lazy {
        val path =
            System.getProperty("fristil.contract")
                ?: fail("fristil.contract er ikke satt. Kjør testene med Gradle.")
        Json.parseToJsonElement(File(path).readText()).jsonObject
    }

    @Test
    fun `de lovlige verdiene er de samme som i TypeScript`() {
        val values = contract.getValue("values").jsonObject
        assertSame("requiredMarkers", values, RequiredMarker.entries.map { it.value })
        assertSame("fieldStates", values, FieldState.entries.map { it.value })
        assertSame("inputTypes", values, InputType.entries.map { it.value })
        assertSame("helpTextVariants", values, HelpTextVariant.entries.map { it.value })
        assertSame("errorTextVariants", values, ErrorTextVariant.entries.map { it.value })
    }

    @Test
    fun `hvert tilfelle gir det samme svaret som TypeScript`() {
        val cases = contract.getValue("cases").jsonArray
        val failures = mutableListOf<String>()
        var checked = 0

        for (case in cases) {
            val builder = case.jsonObject.getValue("builder").jsonPrimitive.content
            val options = case.jsonObject.getValue("options").jsonObject
            val expected = normalise(case.jsonObject.getValue("expected"))
            val unknown = options.keys - (KNOWN_OPTIONS[builder] ?: emptySet())
            val actual =
                try {
                    if (unknown.isNotEmpty()) "valg Kotlin ikke leser: $unknown" else run(builder, options)
                } catch (e: Exception) {
                    "kastet ${e::class.simpleName}: ${e.message}"
                }
            // Med rekkefølge: `Attributes` lover samme rekkefølge som TypeScript,
            // og to maps er like uansett rekkefølge.
            if (ordered(actual) != ordered(expected)) {
                failures += "$builder($options)\n  TypeScript: $expected\n  Kotlin:     $actual"
            }
            // Sist i løkka: telleren sier hvor mange som ble sjekket, ikke
            // hvor mange som ble lest.
            checked++
        }

        println("Kontrakten: $checked av ${cases.size} tilfeller sjekket, ${failures.size} ulike.")
        assertTrue(checked > 0 && checked == cases.size, "Sjekket $checked av ${cases.size} tilfeller.")
        if (failures.isNotEmpty()) {
            fail("${failures.size} tilfeller gir et annet svar enn TypeScript:\n\n${failures.take(10).joinToString("\n\n")}")
        }
    }

    private fun assertSame(
        name: String,
        values: JsonObject,
        kotlin: List<String>,
    ) {
        val typescript = values.getValue(name).jsonArray.map { it.jsonPrimitive.content }
        assertEquals(typescript, kotlin, "$name er ulike i TypeScript og Kotlin.")
    }

    /** Kaller byggefunksjonen med samme navn, og gjør svaret om til samme form som JSON-en. */
    private fun run(
        builder: String,
        o: JsonObject,
    ): Any =
        when (builder) {
            "field" ->
                Fs
                    .field(
                        id = o.string("id")!!,
                        help = o.flag("help"),
                        error = o.flag("error"),
                        helpId = o.string("helpId"),
                        errorId = o.string("errorId"),
                        required = o.string("required")?.let { v -> RequiredMarker.entries.single { it.value == v } },
                        optional = o.flag("optional"),
                        invalid = o.flag("invalid"),
                        disabled = o.flag("disabled"),
                        describedBy = o["describedBy"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
                    ).let {
                        mapOf(
                            "label" to it.label.toMap(),
                            "control" to it.control.toMap(),
                            "help" to it.help.toMap(),
                            "error" to it.error.toMap(),
                            "state" to it.state.value,
                        )
                    }
            "input" ->
                Fs
                    .input(
                        type = o.string("type")?.let { v -> InputType.entries.single { it.value == v } } ?: InputType.TEXT,
                        state = o.string("state")?.let { v -> FieldState.entries.single { it.value == v } } ?: FieldState.DEFAULT,
                    ).toMap()
            "label" ->
                Fs
                    .label(
                        required = o.string("required")?.let { v -> RequiredMarker.entries.single { it.value == v } },
                        optional = o.flag("optional"),
                        disabled = o.flag("disabled"),
                    ).toMap()
            "helpText" ->
                Fs
                    .helpText(
                        o.string("variant")?.let { v -> HelpTextVariant.entries.single { it.value == v } }
                            ?: HelpTextVariant.MUTED,
                    ).toMap()
            "errorText" ->
                Fs
                    .errorText(
                        o.string("variant")?.let { v -> ErrorTextVariant.entries.single { it.value == v } }
                            ?: ErrorTextVariant.ERROR,
                    ).toMap()
            else -> fail("Kontrakten har byggefunksjonen $builder, men Kotlin har den ikke.")
        }

    /** Gjør hvert map om til en liste av par, så rekkefølgen teller med. */
    private fun ordered(value: Any): Any =
        when (value) {
            is Map<*, *> -> value.entries.map { it.key to ordered(it.value!!) }
            is List<*> -> value.map { ordered(it!!) }
            else -> value
        }

    /** `true` i JSON er et boolsk attributt som er på, og det er den tomme strengen i Kotlin. */
    private fun normalise(element: JsonElement): Any =
        when (element) {
            is JsonObject -> element.mapValues { normalise(it.value) }
            is JsonArray -> element.map { normalise(it) }
            // `booleanOrNull` leser også strengen "true" som sann, og da ble
            // `aria-disabled="true"` til et boolsk attributt. Bare en ekte
            // JSON-verdi `true`, ikke en streng, er et boolsk attributt.
            is JsonPrimitive -> if (!element.isString && element.booleanOrNull == true) ON else element.content
        }

    private companion object {
        /**
         * Valgene Kotlin leser, per byggefunksjon. Får generatoren et nytt valg
         * Kotlin ikke kjenner, feiler tilfellet i stedet for å bli ignorert og
         * bestå fordi svaret tilfeldigvis var likt.
         */
        val KNOWN_OPTIONS =
            mapOf(
                "field" to
                    setOf(
                        "id", "help", "error", "helpId", "errorId", "required",
                        "optional", "invalid", "disabled", "describedBy",
                    ),
                "input" to setOf("type", "state"),
                "label" to setOf("required", "optional", "disabled"),
                "helpText" to setOf("variant"),
                "errorText" to setOf("variant"),
            )
    }

    private fun JsonObject.string(name: String): String? = this[name]?.jsonPrimitive?.content

    private fun JsonObject.flag(name: String): Boolean = this[name]?.jsonPrimitive?.booleanOrNull ?: false
}
