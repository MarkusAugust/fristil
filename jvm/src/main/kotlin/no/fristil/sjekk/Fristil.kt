package no.fristil.sjekk

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import io.roastedroot.quickjs4j.core.Runner

/**
 * Fristils diagnostikk på JVM-en, uten Node.
 *
 * Koden er ikke skrevet på nytt i Kotlin. Det er den samme diagnostikken som
 * editorutvidelsen og `fristil sjekk` bruker, pakket av `jvm/scripts/bygg.ts`
 * og kjørt i QuickJS. Paritetstesten krever at svarene er identiske med
 * TypeScript-versjonen.
 *
 * ```kotlin
 * val html = client.get("/soknad").bodyAsText()
 * assertEquals(emptyList(), Fristil.diagnosePage(html))
 * ```
 *
 * Posisjonene er tegnindekser i UTF-16, som i JavaScript, og det er de samme
 * indeksene en Kotlin-`String` bruker. `html.substring(funn.start, funn.end)`
 * gir derfor nøyaktig teksten funnet gjelder.
 */
object Fristil {
    /** Det `diagnoseMarkup` finner: ordforrådet, for en mal eller et fragment. */
    fun diagnoseMarkup(html: String): List<Funn> = diagnose("diagnoseMarkup", html)

    /**
     * Det `diagnosePage` finner: ordforrådet, og i tillegg at hver id det
     * pekes på finnes, at ingen id står to ganger, og at hvert felt er koblet.
     * Bruk den på HTML-en serveren sender, ikke på en mal.
     */
    fun diagnosePage(html: String): List<Funn> = diagnose("diagnosePage", html)

    private val json: ObjectMapper =
        jacksonObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

    private val bunten: String by lazy {
        Fristil::class.java.getResourceAsStream("diagnostikk.js")
            ?.use { it.readBytes().toString(Charsets.UTF_8) }
            ?: error("Fant ikke diagnostikk.js i jar-en. Kjør bun jvm/scripts/bygg.ts.")
    }

    /*
     * Bunten kompileres til QuickJS-bytekode én gang. Hvert kall får sin egen
     * motor, så kall fra flere tråder ikke deler tilstand, og bare det lille
     * kallet kompileres på nytt.
     */
    private val kompilert: ByteArray by lazy { Runner.builder().build().use { it.compile(bunten) } }

    // Navnet er ASCII med vilje: `readValue` lager en klasse oppkalt etter
    // funksjonen, og en klassefil med «ø» i navnet feiler i et miljø uten
    // UTF-8 som standard.
    private fun diagnose(funksjon: String, html: String): List<Funn> {
        // HTML-en sendes inn som en JSON-streng, som også er en gyldig
        // JavaScript-streng: ingen tegn i markupen kan bryte ut av den.
        val kall = "console.log(JSON.stringify(FristilDiagnostikk.$funksjon(${json.writeValueAsString(html)})))"
        val ut =
            Runner.builder().build().use { runner ->
                runner.exec(kompilert)
                runner.compileAndExec(kall)
                runner.stdout()
            }
        return json.readValue(ut.trim())
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
