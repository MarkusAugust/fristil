/**
 * `java -jar fristil.jar`: kommandolinja fra terminalen. Selve kjøringen står
 * i [CommandLine].
 */
package no.fristil.cli

import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess

/**
 * Om kommandolinja kjøres fra en terminal.
 *
 * Java 17 har en konsoll bare når både inn og ut er en terminal, og det holder
 * for å vise hintet til den som skrev kommandoen uten filer. Fra Java 22 har
 * den alltid en, og `isTerminal()` svarer i stedet.
 */
private fun interactive(): Boolean {
    val console = System.console() ?: return false
    return try {
        console.javaClass.getMethod("isTerminal").invoke(console) as Boolean
    } catch (missing: NoSuchMethodException) {
        true
    }
}

/**
 * Argumentene slik de ble skrevet.
 *
 * JVM-en leser argumentene med tegnsettet til locale-innstillingen, og uten
 * en (`LANG` tom, som i mange containere) blir `--knapp-hjørner` til
 * `--knapp-hj??rner`. På Linux ligger de rå bytene i `/proc/self/cmdline`, og
 * leses derfra som UTF-8 når tegnsettet er et annet.
 */
private fun asWritten(args: Array<String>): List<String> {
    val encoding = System.getProperty("sun.jnu.encoding") ?: return args.toList()
    if (Charsets.UTF_8.aliases().plus("UTF-8").any { it.equals(encoding, ignoreCase = true) }) return args.toList()
    val raw = try {
        Files.readAllBytes(Path.of("/proc/self/cmdline"))
    } catch (unavailable: Exception) {
        return args.toList()
    }
    // Hvert argument avsluttes med en nullbyte, også det siste.
    val all = String(raw, Charsets.UTF_8).removeSuffix("\u0000").split('\u0000')
    // Argumentene til programmet står sist, etter `java` og flaggene til JVM-en.
    if (all.size < args.size) return args.toList()
    return all.takeLast(args.size)
}

fun main(arguments: Array<String>) {
    val code = CommandLine.run(asWritten(arguments), File(""), System.`in`, System.out, System.err, interactive())
    exitProcess(code)
}
