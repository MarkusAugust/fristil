import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
}

/*
 * The command line on the JVM: `java -jar lotek.jar check form.html`.
 *
 * The commands are written in Rust (`core/cli/`), and the WASI module comes
 * with the npm package as `core/lotek.wasm`. Chicory runs it, compiled to
 * bytecode here, so the jar answers the same as `npx @lo-tek/interfaces` and
 * the executable from `cargo install`. It needs only Java 17, not Node, not
 * Rust.
 */
group = rootProject.group
version = rootProject.version

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.dylibso.chicory:runtime:1.7.5")
    implementation("com.dylibso.chicory:wasi:1.7.5")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("failed") }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

// The command line and the files it reads, from the npm package the root project has unpacked.
val pakke = rootProject.tasks.named<Sync>("pakkUt").map { it.destinationDir }

val kompilerKommandolinje = tasks.register<no.lotek.build.CompileCore>("kompilerKommandolinje") {
    wasm.set(pakke.map { layout.projectDirectory.file(it.resolve("core/lotek.wasm").absolutePath) })
    className.set("no.lotek.cli.LotekCli")
    classes.set(layout.buildDirectory.dir("chicory/classes"))
    sources.set(layout.buildDirectory.dir("chicory/sources"))
}

/*
 * The package the command line reads from: the manifest, the colour
 * contract, the rulebooks and the source of the components for
 * `lotek takeover`. The module carries none of them, and `CommandLine` gives
 * it the folder as `LOTEK_PACKAGE`.
 */
tasks.processResources {
    from(pakke) {
        include("package.json", "manifest/manifest.json", "manifest/files.json", "src/tokens/color-contract.json", "agent/*.md", "src/components/**")
        into("lotek-pakke")
    }
}

sourceSets.main {
    java.srcDir(kompilerKommandolinje.map { it.sources })
    resources.srcDir(kompilerKommandolinje.map { it.classes })
}

dependencies {
    compileOnly(files(kompilerKommandolinje.map { it.classes }))
}

/*
 * One file with everything in it, so `java -jar lotek.jar` is the whole
 * installation. The plain jar is without the dependencies, and is the one
 * the Gradle plugin uses.
 */
val samletJar = tasks.register<Jar>("samletJar") {
    archiveFileName.set("lotek.jar")
    manifest { attributes("Main-Class" to "no.lotek.cli.MainKt") }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from(sourceSets.main.map { it.output })
    from(configurations.runtimeClasspath.map { classpath -> classpath.map { zipTree(it) } })
    exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA", "META-INF/versions/**/module-info.class", "module-info.class")
}

tasks.assemble { dependsOn(samletJar) }
