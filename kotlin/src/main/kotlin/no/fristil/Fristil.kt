package no.fristil

import com.dylibso.chicory.compiler.MachineFactoryCompiler
import com.dylibso.chicory.runtime.ExportFunction
import com.dylibso.chicory.runtime.Instance
import com.dylibso.chicory.wasm.Parser
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue

/**
 * Fristils diagnostikk på JVM-en, uten Node og uten JavaScript.
 *
 * Diagnostikken er skrevet i Rust (`kjerne/`) og kompilert til én
 * WebAssembly-modul. Den samme modulen kjøres av Node og nettleseren. Her
 * kjøres den av Chicory, en WebAssembly-runtime skrevet i ren Java: en
 * vanlig Maven-avhengighet, uten JNI og uten noe å installere.
 *
 * ```kotlin
 * val html = client.get("/soknad").bodyAsText()
 * assertEquals(emptyList(), Fristil.diagnosePage(html))
 * ```
 *
 * Posisjonene er tegnindekser i UTF-16, de samme indeksene en Kotlin-`String`
 * bruker. `html.substring(funn.start, funn.end)` gir derfor nøyaktig teksten
 * funnet gjelder.
 */
object Fristil {
    /** Det `diagnoseMarkup` finner: ordforrådet, for en mal eller et fragment. */
    fun diagnoseMarkup(html: String): List<Finding> = diagnose(markupEntry, html)

    /**
     * Det `diagnosePage` finner: ordforrådet, og i tillegg at hver id det
     * pekes på finnes, at ingen id står to ganger, og at hvert felt er koblet.
     * Bruk den på HTML-en serveren sender, ikke på en mal.
     */
    fun diagnosePage(html: String): List<Finding> = diagnose(pageEntry, html)

    private val json: ObjectMapper =
        jacksonObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    /*
     * Én instans, lest og satt opp én gang. Modulen har ingen importer og
     * ingen tilstand mellom kall utover svaret fra forrige kall, så kallene
     * bare må gå ett om gangen.
     */
    private val instance: Instance by lazy {
        val module =
            Fristil::class.java.getResourceAsStream("fristil-kjerne.wasm")
                ?: error("Fant ikke fristil-kjerne.wasm i jar-en.")
        // Kompilert til JVM-bytekode, ikke tolket: tolken brukte sekunder på
        // en side kompilatoren bruker millisekunder på.
        Instance.builder(module.use { Parser.parse(it) })
            .withMachineFactory(MachineFactoryCompiler::compile)
            .build()
    }

    private val alloc by lazy { instance.export("alloc") }
    private val markupEntry by lazy { instance.export("diagnose_markup_raw") }
    private val pageEntry by lazy { instance.export("diagnose_page_raw") }
    private val resultPtr by lazy { instance.export("result_ptr") }
    private val resultLen by lazy { instance.export("result_len") }

    @Synchronized
    private fun diagnose(entry: ExportFunction, html: String): List<Finding> {
        val bytes = html.toByteArray(Charsets.UTF_8)
        val pointer = alloc.apply(bytes.size.toLong())[0]
        instance.memory().write(pointer.toInt(), bytes)
        entry.apply(pointer, bytes.size.toLong())
        val result =
            instance.memory().readBytes(
                resultPtr.apply()[0].toInt(),
                resultLen.apply()[0].toInt(),
            )
        return json.readValue(result)
    }
}

/** Ett funn, med de samme feltene som `Finding` i TypeScript. */
data class Finding(
    val start: Int,
    val end: Int,
    val message: String,
    val severity: String,
    val link: String,
    val fix: Fix? = null,
)

/** En rettelse: bytt ut teksten fra `start` til `end` med `text`. */
data class Fix(
    val title: String,
    val start: Int,
    val end: Int,
    val text: String,
    val preferred: Boolean? = null,
)
