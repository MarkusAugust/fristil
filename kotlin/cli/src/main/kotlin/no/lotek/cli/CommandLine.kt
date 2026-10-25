/**
 * The LO-TEK command line on the JVM: `java -jar lotek.jar` and the Gradle
 * plugin.
 *
 * The commands are written once, in Rust (`core/cli/`), and run here as a
 * WASI module with Chicory, compiled to bytecode when the jar is built. The
 * file does the same as the shell in the npm package
 * (`interfaces/src/cli.ts`), and only what WASI cannot:
 *
 * - opens the file system for the module, so both relative and absolute
 *   paths work;
 * - fetches the addresses `lotek check` gets, since WASI has no network, and
 *   gives the page to the module as a file (see `core/cli/src/fetch.rs`);
 * - says when standard input is a terminal, which WASI cannot see;
 * - gives the module the package's files, which are in the jar (see
 *   `packageDir`).
 */
package no.lotek.cli

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
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Path

private val windows = System.getProperty("os.name").lowercase().startsWith("windows")

/**
 * A path as the WASI module sees it.
 *
 * On Windows every drive is opened as its own folder, `C:\` as `/c`, and
 * the backslashes become slashes. Elsewhere the path is the same.
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

/** An argument for the WASI module: the path in a file or in a `--flag=value`. */
private fun toModule(part: String): String {
    val flag = Regex("""^(--[^=]+=)(.*)$""", RegexOption.DOT_MATCHES_ALL).find(part)
    return if (flag != null) flag.groupValues[1] + forWasi(flag.groupValues[2]) else forWasi(part)
}

/**
 * The answer from an address, in the file the module reads: the address, the
 * status code (0 when nobody answered), the content type or the reason, and
 * the page. The module judges the answer.
 */
private fun fetch(client: HttpClient, address: String): String =
    try {
        val request = HttpRequest.newBuilder(URI(address))
            // As in the executable: a server that never answers must not hang
            // a CI job until it is killed.
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
 * Passes every write on at once. The module buffers itself, per line, and the
 * language server must answer while it runs, not when it exits.
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

/** The command line, run in this process. */
object CommandLine {
    /*
     * The package the command line reads from: the manifest, the colour
     * contract, the rulebooks and the components. The module carries none of
     * them, and the jar has them under `lotek-package/`. WASI reads files and
     * not resources, so in a jar they are unpacked once, to a folder in temp
     * named after the jar's size and modification time, which the next run of
     * the same jar uses again. The folder is moved into place only when it is
     * complete, so two processes starting at the same time do not see half a
     * package. From a folder, as in the tests, the folder is used as it is.
     */
    private val packageDir: Path by lazy {
        val uri = CommandLine::class.java.getResource("/lotek-package/manifest/manifest.json")?.toURI()
            ?: error("lotek-package is missing from the jar")
        if (uri.scheme != "jar") return@lazy Path.of(uri).parent.parent
        // The jar is opened as a file, not through the URI: a file system for
        // the URI may already be open by something else in the same JVM.
        val jarFile = Path.of(CommandLine::class.java.protectionDomain.codeSource.location.toURI())
        val tmp = Path.of(System.getProperty("java.io.tmpdir"))
        val target = tmp.resolve("lotek-package-${Files.size(jarFile)}-${Files.getLastModifiedTime(jarFile).toMillis()}")
        if (Files.isDirectory(target)) return@lazy target
        val partial = Files.createTempDirectory(tmp, "lotek-package-")
        FileSystems.newFileSystem(jarFile).use { jar ->
            val root = jar.getPath("/lotek-package")
            Files.walk(root).use { paths ->
                for (source in paths) {
                    val copy = partial.resolve(root.relativize(source).toString())
                    if (Files.isDirectory(source)) Files.createDirectories(copy) else Files.copy(source, copy)
                }
            }
        }
        try {
            Files.move(partial, target, java.nio.file.StandardCopyOption.ATOMIC_MOVE)
        } catch (_: java.io.IOException) {
            // Another process came first. Its copy is the same.
            partial.toFile().deleteRecursively()
        }
        target
    }

    /**
     * Runs one command, like `listOf("check", "form.html")`, and gives the
     * exit code. Relative paths are read from [workingDirectory]. [terminal]
     * says whether standard input is a terminal, so `check` without files can
     * say so.
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
                if (args[0] != "check" || index == 0 || !address.containsMatchIn(part)) {
                    moduleArgs += toModule(part)
                    continue
                }
                val dir = fetchedDir ?: Files.createTempDirectory("lotek-").also { fetchedDir = it }
                val file = dir.resolve("$index.txt")
                Files.writeString(file, fetch(client, part))
                moduleArgs += "--fetched=${forWasi(file.toString())}"
            }

            val out = Flushing(stdout)
            val err = Flushing(stderr)
            val options =
                WasiOptions.builder()
                    .withStdin(stdin)
                    .withStdout(out)
                    .withStderr(err)
                    .withArguments(listOf("lotek") + moduleArgs)
                    .withEnvironment("LOTEK_WORKDIR", forWasi(workingDirectory.absolutePath))
                    .withEnvironment("LOTEK_PACKAGE", forWasi(packageDir.toString()))
                    .apply {
                        if (terminal) withEnvironment("LOTEK_TERMINAL", "1")
                        // So the messages show the paths as `C:\\…`, not as `/c/…`.
                        if (windows) withEnvironment("LOTEK_WINDOWS", "1")
                        // The whole file system is opened, and the module goes to the
                        // working directory itself.
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
                        Instance.builder(LotekCli.load())
                            .withMachineFactory(LotekCli::create)
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
