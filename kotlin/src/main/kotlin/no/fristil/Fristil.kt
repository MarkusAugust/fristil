package no.fristil

import com.dylibso.chicory.runtime.ExportFunction
import com.dylibso.chicory.runtime.Instance

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
    fun diagnoseMarkup(html: String): List<Finding> = diagnose(MARKUP, html)

    /**
     * Det `diagnosePage` finner: ordforrådet, og i tillegg at hver id det
     * pekes på finnes, at ingen id står to ganger, og at hvert felt er koblet.
     * Bruk den på HTML-en serveren sender, ikke på en mal.
     */
    fun diagnosePage(html: String): List<Finding> = diagnose(PAGE, html)

    /*
     * En instans har sitt eget minne, og svaret fra et kall ligger der til
     * neste kall. To tråder kan derfor ikke dele en, men hver tråd kan ha sin
     * egen, så kallene ikke venter på hverandre.
     */
    private val core = ThreadLocal.withInitial { Core() }

    private fun diagnose(entry: String, html: String): List<Finding> =
        (Json.parse(core.get().call(entry, html)) as List<*>).map { finding(it as Map<*, *>) }

    private const val MARKUP = "diagnose_markup_raw"
    private const val PAGE = "diagnose_page_raw"

    private fun finding(f: Map<*, *>): Finding =
        Finding(
            start = (f["start"] as Double).toInt(),
            end = (f["end"] as Double).toInt(),
            line = (f["line"] as Double).toInt(),
            column = (f["column"] as Double).toInt(),
            message = f["message"] as String,
            severity = f["severity"] as String,
            rule = f["rule"] as String,
            link = f["link"] as String,
            fix = (f["fix"] as Map<*, *>?)?.let { fix ->
                Fix(
                    title = fix["title"] as String,
                    start = (fix["start"] as Double).toInt(),
                    end = (fix["end"] as Double).toInt(),
                    text = fix["text"] as String,
                    preferred = fix["preferred"] as Boolean?,
                )
            },
        )
}

/** Én instans av modulen, med funksjonene den eksporterer. */
private class Core {
    /*
     * `FristilCore` er modulen kompilert til JVM-bytekode da pakken ble bygget
     * (se `buildSrc/`). Den kjører med JIT-en, ikke i Chicorys tolk, som
     * brukte sekunder på en side dette bruker millisekunder på, og en ny
     * instans koster nesten ingenting.
     */
    private val instance: Instance =
        Instance.builder(FristilCore.load()).withMachineFactory(FristilCore::create).build()
    private val alloc: ExportFunction = instance.export("alloc")
    private val resultPtr: ExportFunction = instance.export("result_ptr")
    private val resultLen: ExportFunction = instance.export("result_len")

    /** Kaller en av funksjonene som tar en tekst, og gir svaret som tekst. */
    fun call(entry: String, text: String): String {
        val bytes = text.toByteArray(Charsets.UTF_8)
        val pointer = alloc.apply(bytes.size.toLong())[0]
        instance.memory().write(pointer.toInt(), bytes)
        instance.export(entry).apply(pointer, bytes.size.toLong())
        return instance.memory().readString(resultPtr.apply()[0].toInt(), resultLen.apply()[0].toInt())
    }
}

/** Ett funn, med de samme feltene som `Finding` i TypeScript, og regel, linje og kolonne. */
data class Finding(
    val start: Int,
    val end: Int,
    val line: Int,
    val column: Int,
    val message: String,
    val severity: String,
    val rule: String,
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
