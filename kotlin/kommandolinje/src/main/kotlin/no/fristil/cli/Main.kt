/**
 * Kommandolinja til Fristil på JVM-en, `java -jar fristil.jar`.
 *
 * Kommandoene er skrevet én gang, i Rust (`kjerne/cli/`), og kjøres her som
 * en WASI-modul med Chicory, kompilert til bytekode når jar-en bygges. Fila
 * gjør det samme som skallet i npm-pakken (`designsystem/src/cli.ts`), og bare
 * det WASI ikke kan:
 *
 * - åpner filsystemet for modulen, så både relative og absolutte stier virker;
 * - henter adressene `fristil sjekk` får, siden WASI ikke har nettverk, og
 *   gir siden til modulen som en fil (se `kjerne/cli/src/fetch.rs`);
 * - sier fra når standard inn er en terminal, som WASI ikke kan se.
 */
package no.fristil.cli

import com.dylibso.chicory.runtime.ImportValues
import com.dylibso.chicory.runtime.Instance
import com.dylibso.chicory.wasi.WasiExitException
import com.dylibso.chicory.wasi.WasiOptions
import com.dylibso.chicory.wasi.WasiPreview1
import java.io.BufferedOutputStream
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import kotlin.system.exitProcess

private val windows = System.getProperty("os.name").lowercase().startsWith("windows")

/**
 * En sti slik WASI-modulen ser den.
 *
 * På Windows åpnes hver stasjon som sin egen mappe, `C:\` som `/c`, og
 * skråstrekene snus. Andre steder er stien den samme.
 */
private fun forWasi(path: String): String {
    if (!windows) return path
    val absolute = Regex("""^([A-Za-z]):[\\/](.*)$""", RegexOption.DOT_MATCHES_ALL).find(path)
    if (absolute != null) {
        val (drive, rest) = absolute.destructured
        return "/${drive.lowercase()}/${rest.replace('\\', '/')}"
    }
    return path.replace('\\', '/')
}

/** Et argument for WASI-modulen: stien i en fil eller i et `--flagg=verdi`. */
private fun toModule(part: String): String {
    val flag = Regex("""^(--[^=]+=)(.*)$""", RegexOption.DOT_MATCHES_ALL).find(part)
    return if (flag != null) flag.groupValues[1] + forWasi(flag.groupValues[2]) else forWasi(part)
}

/**
 * Svaret fra en adresse, i fila modulen leser: adressen, statuskoden (0 når
 * ingen svarte), innholdstypen eller grunnen, og siden. Vurderingen av svaret
 * gjør modulen.
 */
private fun fetch(client: HttpClient, address: String): String =
    try {
        val request = HttpRequest.newBuilder(URI(address)).GET().build()
        val response = client.send(request, HttpResponse.BodyHandlers.ofByteArray())
        val type = response.headers().firstValue("content-type").orElse("")
        "$address\n${response.statusCode()}\n$type\n${String(response.body(), Charsets.UTF_8)}"
    } catch (error: Exception) {
        val reason = error.message ?: error.javaClass.simpleName
        "$address\n0\n${reason.replace('\n', ' ')}\n"
    }

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
    val args = asWritten(arguments)
    var fetchedDir: Path? = null
    val moduleArgs = mutableListOf<String>()
    val address = Regex("^https?://", RegexOption.IGNORE_CASE)
    val client by lazy { HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build() }
    for ((index, part) in args.withIndex()) {
        if (args[0] != "sjekk" || index == 0 || !address.containsMatchIn(part)) {
            moduleArgs += toModule(part)
            continue
        }
        val dir = fetchedDir ?: Files.createTempDirectory("fristil-").also { fetchedDir = it }
        val file = dir.resolve("$index.txt")
        Files.writeString(file, fetch(client, part))
        moduleArgs += "--hentet=${forWasi(file.toString())}"
    }

    val stdout = BufferedOutputStream(System.out)
    val stderr = BufferedOutputStream(System.err)
    val options =
        WasiOptions.builder()
            .withStdin(System.`in`)
            .withStdout(stdout)
            .withStderr(stderr)
            .withArguments(listOf("fristil") + moduleArgs)
            .withEnvironment("FRISTIL_ARBEIDSMAPPE", forWasi(File("").absolutePath))
            .apply {
                if (interactive()) withEnvironment("FRISTIL_TERMINAL", "1")
                // Hele filsystemet åpnes, og modulen går selv til arbeidsmappa.
                if (windows) {
                    for (root in File.listRoots()) {
                        val drive = root.path.firstOrNull()?.lowercaseChar() ?: continue
                        withDirectory("/$drive", root.toPath())
                    }
                } else {
                    withDirectory("/", Path.of("/"))
                }
            }
            .build()

    val code =
        WasiPreview1.builder().withOptions(options).build().use { wasi ->
            try {
                Instance.builder(FristilCli.load())
                    .withMachineFactory(FristilCli::create)
                    .withImportValues(ImportValues.builder().addFunction(*wasi.toHostFunctions()).build())
                    .build()
                0
            } catch (exit: WasiExitException) {
                exit.exitCode()
            }
        }
    stdout.flush()
    stderr.flush()
    fetchedDir?.toFile()?.deleteRecursively()
    exitProcess(code)
}
