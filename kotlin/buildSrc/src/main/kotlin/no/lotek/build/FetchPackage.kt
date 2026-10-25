package no.lotek.build

import groovy.json.JsonSlurper
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.MessageDigest
import java.time.Duration
import java.util.Base64

/**
 * Fetches the npm package `@lo-tek/interfaces` for the version from the registry.
 *
 * The Kotlin package is built from what the npm package contains: the core,
 * the CLI, the manifest and the files for the browser. That way
 * `io.github.markusaugust:lo-tek-interfaces` and `@lo-tek/interfaces` with the
 * same version are built from the same files, and the build needs neither
 * Rust nor Bun.
 *
 * The file is compared with `dist.integrity` from the registry, the same
 * check `npm install` does, so a truncated download stops the build.
 */
abstract class FetchPackage : DefaultTask() {
    @get:Input
    abstract val packageVersion: Property<String>

    @get:OutputFile
    abstract val tarball: RegularFileProperty

    @TaskAction
    fun fetch() {
        val version = packageVersion.get()
        // Without timeouts, a hanging network locks the job until GitHub stops it after six hours.
        val client =
            HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(30))
                .build()
        fun get(url: String) = HttpRequest.newBuilder(URI(url)).timeout(Duration.ofMinutes(2)).build()
        val registry = "https://registry.npmjs.org/@lo-tek/interfaces"

        val metadata = client.send(get("$registry/$version"), HttpResponse.BodyHandlers.ofString())
        if (metadata.statusCode() != 200) {
            throw GradleException(
                "@lo-tek/interfaces@$version is not on npm (status ${metadata.statusCode()}). " +
                    "If you build from the repository between two releases, pack the package yourself and pass it with " +
                    "-Plotek.pakke=<path to .tgz>. See kotlin/README.md.",
            )
        }
        val dist = (JsonSlurper().parseText(metadata.body()) as Map<*, *>)["dist"] as Map<*, *>
        val integrity = dist["integrity"] as String
        check(integrity.startsWith("sha512-")) { "The registry gave an integrity that is not sha512: $integrity" }

        val bytes = client.send(get(dist["tarball"] as String), HttpResponse.BodyHandlers.ofByteArray())
        if (bytes.statusCode() != 200) throw GradleException("Got ${bytes.statusCode()} when the tarball for $version was fetched.")

        val actual = "sha512-" + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-512").digest(bytes.body()))
        if (actual != integrity) throw GradleException("The tarball for $version does not have the integrity the registry gave ($integrity).")

        tarball.get().asFile.apply { parentFile.mkdirs() }.writeBytes(bytes.body())
    }
}
