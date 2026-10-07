package no.fristil.sjekk

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
    fun diagnoseMarkup(html: String): List<Funn> = diagnose(markup, html)

    /**
     * Det `diagnosePage` finner: ordforrådet, og i tillegg at hver id det
     * pekes på finnes, at ingen id står to ganger, og at hvert felt er koblet.
     * Bruk den på HTML-en serveren sender, ikke på en mal.
     */
    fun diagnosePage(html: String): List<Funn> = diagnose(side, html)

    private val json: ObjectMapper =
        jacksonObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    /*
     * Én instans, lest og satt opp én gang. Modulen har ingen importer og
     * ingen tilstand mellom kall utover svaret fra forrige kall, så kallene
     * bare må gå ett om gangen.
     */
    private val instans: Instance by lazy {
        val modul =
            Fristil::class.java.getResourceAsStream("fristil-kjerne.wasm")
                ?: error("Fant ikke fristil-kjerne.wasm i jar-en.")
        // Kompilert til JVM-bytekode, ikke tolket: tolken brukte sekunder på
        // en side kompilatoren bruker millisekunder på.
        Instance.builder(modul.use { Parser.parse(it) })
            .withMachineFactory(MachineFactoryCompiler::compile)
            .build()
    }

    private val alloc by lazy { instans.export("alloc") }
    private val markup by lazy { instans.export("diagnose_markup_raw") }
    private val side by lazy { instans.export("diagnose_page_raw") }
    private val svarPeker by lazy { instans.export("result_ptr") }
    private val svarLengde by lazy { instans.export("result_len") }

    // Navnet er ASCII med vilje: `readValue` lager en klasse oppkalt etter
    // funksjonen, og en klassefil med «ø» i navnet feiler i et miljø uten
    // UTF-8 som standard.
    @Synchronized
    private fun diagnose(funksjon: ExportFunction, html: String): List<Funn> {
        val bytes = html.toByteArray(Charsets.UTF_8)
        val peker = alloc.apply(bytes.size.toLong())[0]
        instans.memory().write(peker.toInt(), bytes)
        funksjon.apply(peker, bytes.size.toLong())
        val ut =
            instans.memory().readBytes(
                svarPeker.apply()[0].toInt(),
                svarLengde.apply()[0].toInt(),
            )
        return json.readValue(ut)
    }
}

/** Ett funn, med de samme feltene som `Finding` i TypeScript. */
data class Funn(
    val start: Int,
    val end: Int,
    val message: String,
    val severity: String,
    val link: String,
    val fix: Rettelse? = null,
)

/** En rettelse: bytt ut teksten fra `start` til `end` med `text`. */
data class Rettelse(
    val title: String,
    val start: Int,
    val end: Int,
    val text: String,
    val preferred: Boolean? = null,
)
