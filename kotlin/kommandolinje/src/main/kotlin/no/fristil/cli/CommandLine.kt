/**
 * Kommandolinja til Fristil på JVM-en: `java -jar fristil.jar` og
 * Gradle-pluginen.
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
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path

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
        val request = HttpRequest.newBuilder(URI(address))
            // Som den kjørbare fila: en server som aldri svarer, skal ikke
            // henge en CI-jobb til den blir drept.
            .timeout(java.time.Duration.ofSeconds(30))
            .GET()
            .build()
        val response = client.send(request, HttpResponse.BodyHandlers.ofByteArray())
        val type = response.headers().firstValue("content-type").orElse("")
        "$address\n${response.statusCode()}\n$type\n${String(response.body(), Charsets.UTF_8)}"
    } catch (error: Exception) {
        val reason = error.message ?: error.javaClass.simpleName
        "$address\n0\n${reason.replace('\n', ' ')}\n"
    }

/**
 * Sender hver skriving videre med en gang. Modulen buffrer selv, per linje,
 * og språkserveren må svare mens den kjører, ikke når den avslutter.
 */
private class Flushing(private val out: OutputStream) : OutputStream() {
    override fun write(b: Int) {
        out.write(b)
        out.flush()
    }

    override fun write(b: ByteArray, off: Int, len: Int) {
        out.write(b, off, len)
        out.flush()
    }

    override fun flush() = out.flush()
}

/** Kommandolinja, kjørt i denne prosessen. */
object CommandLine {
    /**
     * Kjører én kommando, som `listOf("sjekk", "skjema.html")`, og gir
     * feilkoden. Relative stier leses fra [workingDirectory]. [terminal] sier
     * om standard inn er en terminal, så `sjekk` uten filer kan si fra.
     */
    fun run(
        args: List<String>,
        workingDirectory: File,
        stdin: InputStream,
        stdout: OutputStream,
        stderr: OutputStream,
        terminal: Boolean = false,
    ): Int {
        var fetchedDir: Path? = null
        try {
            val moduleArgs = mutableListOf<String>()
            val address = Regex("^https?://", RegexOption.IGNORE_CASE)
            val client by lazy { HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).connectTimeout(java.time.Duration.ofSeconds(30)).build() }
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

            val out = Flushing(stdout)
            val err = Flushing(stderr)
            val options =
                WasiOptions.builder()
                    .withStdin(stdin)
                    .withStdout(out)
                    .withStderr(err)
                    .withArguments(listOf("fristil") + moduleArgs)
                    .withEnvironment("FRISTIL_ARBEIDSMAPPE", forWasi(workingDirectory.absolutePath))
                    .apply {
                        if (terminal) withEnvironment("FRISTIL_TERMINAL", "1")
                        // Så meldingene viser stiene som `C:\\…`, ikke som `/c/…`.
                        if (windows) withEnvironment("FRISTIL_WINDOWS", "1")
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
            out.flush()
            err.flush()
            return code
        } finally {
            fetchedDir?.toFile()?.deleteRecursively()
        }
    }
}
