package no.fristil.build

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
import java.util.Base64

/**
 * Henter npm-pakken `@fristil/designsystem` for versjonen fra registeret.
 *
 * Kotlin-pakken bygges av det npm-pakken inneholder: kjernen, kommandolinja,
 * manifestet og filene for nettleseren. Da er `io.github.markusaugust:fristil`
 * og `@fristil/designsystem` med samme versjon bygd av de samme filene, og
 * bygget trenger verken Rust eller Bun.
 *
 * Fila sammenlignes med `dist.integrity` fra registeret, samme kontroll som
 * `npm install` gjør, så en avkuttet nedlasting stopper bygget.
 */
abstract class FetchPackage : DefaultTask() {
    @get:Input
    abstract val packageVersion: Property<String>

    @get:OutputFile
    abstract val tarball: RegularFileProperty

    @TaskAction
    fun fetch() {
        val version = packageVersion.get()
        val client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build()
        val registry = "https://registry.npmjs.org/@fristil/designsystem"

        val metadata = client.send(HttpRequest.newBuilder(URI("$registry/$version")).build(), HttpResponse.BodyHandlers.ofString())
        if (metadata.statusCode() != 200) {
            throw GradleException(
                "@fristil/designsystem@$version finnes ikke på npm (svar ${metadata.statusCode()}). " +
                    "Bygger du fra repoet mellom to utgivelser, pakk pakken selv og oppgi den med " +
                    "-Pfristil.pakke=<sti til .tgz>. Se kotlin/README.md.",
            )
        }
        val dist = (JsonSlurper().parseText(metadata.body()) as Map<*, *>)["dist"] as Map<*, *>
        val integrity = dist["integrity"] as String
        check(integrity.startsWith("sha512-")) { "Registeret oppga en integritet som ikke er sha512: $integrity" }

        val bytes = client.send(HttpRequest.newBuilder(URI(dist["tarball"] as String)).build(), HttpResponse.BodyHandlers.ofByteArray())
        if (bytes.statusCode() != 200) throw GradleException("Fikk ${bytes.statusCode()} da tarballen for $version ble hentet.")

        val actual = "sha512-" + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-512").digest(bytes.body()))
        if (actual != integrity) throw GradleException("Tarballen for $version har ikke integriteten registeret oppga ($integrity).")

        tarball.get().asFile.apply { parentFile.mkdirs() }.writeBytes(bytes.body())
    }
}
