package no.fristil.build

import com.dylibso.chicory.build.time.compiler.Config
import com.dylibso.chicory.build.time.compiler.Generator
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

/**
 * Gjør WebAssembly-modulen om til JVM-bytekode når pakken bygges.
 *
 * Chicory kan kompilere modulen når den lastes, men det tar rundt et sekund,
 * og det må gjøres på nytt for hver instans. Kompilert her er det en vanlig
 * klasse i jar-en, og en ny instans koster nesten ingenting.
 */
abstract class CompileCore : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val wasm: RegularFileProperty

    /** Klassene for modulen, og en kopi av modulen selv uten funksjonskroppene. */
    @get:OutputDirectory
    abstract val classes: DirectoryProperty

    /** Java-klassen som laster modulen. */
    @get:OutputDirectory
    abstract val sources: DirectoryProperty

    /** Navnet på klassen, med pakken. Kjernen er `no.fristil.FristilCore`. */
    @get:Input
    abstract val className: Property<String>

    init {
        className.convention("no.fristil.FristilCore")
    }

    @TaskAction
    fun compile() {
        classes.get().asFile.apply { deleteRecursively(); mkdirs() }
        sources.get().asFile.apply { deleteRecursively(); mkdirs() }
        val config =
            Config.builder()
                .withWasmFile(wasm.get().asFile.toPath())
                .withName(className.get())
                .withTargetClassFolder(classes.get().asFile.toPath())
                .withTargetWasmFolder(classes.get().asFile.toPath())
                .withTargetSourceFolder(sources.get().asFile.toPath())
                .build()
        val generator = Generator(config)
        val interpreted = generator.generateResources()
        check(interpreted.isEmpty()) { "Chicory kunne ikke kompilere funksjonene $interpreted i ${className.get()}." }
        generator.generateMetaWasm(interpreted)
        generator.generateSources()
    }
}
