/**
 * LO-TEK i Gradle.
 *
 * ```kotlin
 * plugins {
 *     id("io.github.markusaugust.lo-tek")
 * }
 *
 * lotek {
 *     templates.from(fileTree("src/main/jte"))
 *     themeRecipe = file("lotek.theme.json")
 * }
 * ```
 *
 * `lotekSjekk` kjøres av `check`, og `lotekManifest` av `assemble`.
 * `lotekTema` kjøres når den blir bedt om, eller når en annen oppgave
 * trenger temaet.
 */
package no.lotek.gradle

import no.lotek.cli.CommandLine
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.SkipWhenEmpty
import org.gradle.api.tasks.TaskAction
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File

/** Innstillingene, under `lotek { }`. */
abstract class LotekExtension {
    /** Malene og sidene `lotekSjekk` sjekker. */
    abstract val templates: ConfigurableFileCollection

    /**
     * Sjekk filene som hele sider, med koblingen mellom ledetekster, felt og
     * id-er. Som `lotek sjekk --rendret`. Av som standard, siden en id i en
     * mal kan stå i en annen fil.
     */
    abstract val rendered: Property<Boolean>

    /** Fragmentene `lotek overta` skrev ved siden av kopiene. */
    abstract val manifests: ConfigurableFileCollection

    /** Oppskriften `lotekTema` bygger temaet av, som `lotek tema <fil>`. */
    abstract val themeRecipe: RegularFileProperty

    /** Hvor temaet skrives. Standard: `build/lotek/theme.css`. */
    abstract val themeOutput: RegularFileProperty
}

class LotekPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("lotek", LotekExtension::class.java)
        extension.rendered.convention(false)
        extension.themeOutput.convention(project.layout.buildDirectory.file("lotek/theme.css"))

        val check = project.tasks.register("lotekSjekk", LotekCheck::class.java) { task ->
            task.group = "verification"
            task.description = "Sjekker malene mot LO-TEK, som lotek sjekk."
            task.templates.from(extension.templates)
            task.rendered.set(extension.rendered)
            task.manifests.from(extension.manifests)
            task.workingDirectory.set(project.layout.projectDirectory)
            task.report.set(project.layout.buildDirectory.file("lotek/check.txt"))
        }
        project.tasks.register("lotekTema", LotekTheme::class.java) { task ->
            task.group = "build"
            task.description = "Bygger temaet av oppskriften, som lotek tema."
            task.recipe.set(extension.themeRecipe)
            task.output.set(extension.themeOutput)
            task.workingDirectory.set(project.layout.projectDirectory)
            task.onlyIf("lotek.themeRecipe er satt") { task.recipe.isPresent }
        }
        val manifest = project.tasks.register("lotekManifest", LotekManifest::class.java) { task ->
            task.group = "build"
            task.description = "Skriver manifestet prosjektet sjekkes mot, med fragmentene fra lotek overta."
            task.manifests.from(extension.manifests)
            task.workingDirectory.set(project.layout.projectDirectory)
            task.output.set(project.layout.buildDirectory.file("lotek/manifest.json"))
        }

        project.pluginManager.withPlugin("base") {
            project.tasks.named("check") { it.dependsOn(check) }
            project.tasks.named("assemble") { it.dependsOn(manifest) }
        }
    }
}

/** Kjører én kommando og gir feilkoden og alt den skrev. */
private fun run(args: List<String>, workingDirectory: File): Pair<Int, String> {
    val stdout = ByteArrayOutputStream()
    val stderr = ByteArrayOutputStream()
    val code = CommandLine.run(args, workingDirectory, ByteArrayInputStream(ByteArray(0)), stdout, stderr)
    return code to (stdout.toString(Charsets.UTF_8) + stderr.toString(Charsets.UTF_8)).trim()
}

/** Stien slik den står i en melding: fra prosjektmappa når fila ligger der. */
internal fun shown(file: File, workingDirectory: File): String {
    // På Windows kan fila ligge på en annen stasjon enn prosjektet, og da
    // finnes det ingen relativ sti: `relativize` kaster.
    val relative =
        try {
            workingDirectory.toPath().relativize(file.toPath()).toString()
        } catch (otherRoot: IllegalArgumentException) {
            return file.absolutePath
        }
    return if (relative.startsWith("..")) file.absolutePath else relative
}

/** `lotekSjekk`: malene mot LO-TEK, og mot fragmentene fra `lotek overta`. */
abstract class LotekCheck : DefaultTask() {
    @get:InputFiles
    @get:SkipWhenEmpty
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val templates: ConfigurableFileCollection

    @get:Input
    abstract val rendered: Property<Boolean>

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val manifests: ConfigurableFileCollection

    @get:Internal
    abstract val workingDirectory: DirectoryProperty

    /** Svaret fra siste kjøring, så oppgaven står som oppdatert når ingenting er endret. */
    @get:OutputFile
    abstract val report: RegularFileProperty

    @TaskAction
    fun check() {
        val directory = workingDirectory.get().asFile
        val args = buildList {
            add("sjekk")
            if (rendered.get()) add("--rendret")
            manifests.files.sorted().forEach { add("--manifest=${shown(it, directory)}") }
            templates.files.sorted().forEach { add(shown(it, directory)) }
        }
        val (code, output) = run(args, directory)
        report.get().asFile.writeText("$output\n")
        if (code != 0) throw GradleException("Markupen stemmer ikke med LO-TEK:\n\n$output")
        logger.info(output)
    }
}

/** `lotekTema`: temaet av oppskriften. */
abstract class LotekTheme : DefaultTask() {
    @get:InputFile
    @get:Optional
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val recipe: RegularFileProperty

    @get:OutputFile
    abstract val output: RegularFileProperty

    @get:Internal
    abstract val workingDirectory: DirectoryProperty

    @TaskAction
    fun build() {
        val directory = workingDirectory.get().asFile
        val target = output.get().asFile
        target.parentFile.mkdirs()
        val (code, text) =
            run(listOf("tema", shown(recipe.get().asFile, directory), "--ut=${target.absolutePath}"), directory)
        if (code != 0) throw GradleException("Temaet kunne ikke bygges:\n\n$text")
        logger.info(text)
    }
}

/**
 * `lotekManifest`: manifestet med fragmentene, for editoren og språkserveren.
 *
 * Fila skrives bare når prosjektet har fragmenter. Språkserveren og
 * IntelliJ-pluginen foretrekker `build/lotek/manifest.json` framfor
 * manifestet i npm-pakken, så en fil uten fragmenter ville bare vært en kopi
 * av pakkens, og den ble stående når pakken ble oppdatert. Fjernes det
 * siste fragmentet, slettes fila, ellers ville editoren fortsatt godtatt
 * klassene fra en komponent som ikke finnes lenger.
 */
abstract class LotekManifest : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val manifests: ConfigurableFileCollection

    @get:OutputFile
    abstract val output: RegularFileProperty

    @get:Internal
    abstract val workingDirectory: DirectoryProperty

    @TaskAction
    fun write() {
        val directory = workingDirectory.get().asFile
        if (manifests.isEmpty) {
            val old = output.get().asFile
            if (old.exists() && !old.delete()) throw GradleException("Kunne ikke slette ${old.absolutePath}.")
            return
        }
        val args = buildList {
            add("manifest")
            manifests.files.sorted().forEach { add("--manifest=${shown(it, directory)}") }
            add("--ut=${output.get().asFile.absolutePath}")
        }
        val (code, text) = run(args, directory)
        if (code != 0) throw GradleException("Manifestet kunne ikke skrives:\n\n$text")
        logger.info(text)
    }
}
