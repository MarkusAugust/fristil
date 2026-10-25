package no.lotek.build

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
 * Turns the WebAssembly module into JVM bytecode when the package is built.
 *
 * Chicory can compile the module when it is loaded, but that takes about a
 * second, and it has to be done again for every instance. Compiled here, it
 * is an ordinary class in the jar, and a new instance costs almost nothing.
 */
abstract class CompileCore : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val wasm: RegularFileProperty

    /** The classes for the module, and a copy of the module itself without the function bodies. */
    @get:OutputDirectory
    abstract val classes: DirectoryProperty

    /** The Java class that loads the module. */
    @get:OutputDirectory
    abstract val sources: DirectoryProperty

    /** The name of the class, with the package. The core is `no.lotek.LotekCore`. */
    @get:Input
    abstract val className: Property<String>

    init {
        className.convention("no.lotek.LotekCore")
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
        check(interpreted.isEmpty()) { "Chicory could not compile the functions $interpreted in ${className.get()}." }
        generator.generateMetaWasm(interpreted)
        generator.generateSources()
    }
}
