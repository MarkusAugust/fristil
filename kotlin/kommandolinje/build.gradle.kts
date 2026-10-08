import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
}

/*
 * Kommandolinja på JVM-en: `java -jar fristil.jar sjekk skjema.html`.
 *
 * Kommandoene er skrevet i Rust (`kjerne/cli/`) og bygges som WASI-modul.
 * Chicory kjører den, kompilert til bytekode her, så jar-en svarer det samme
 * som `npx @fristil/designsystem` og den kjørbare fila fra `cargo install`.
 * Den trenger bare Java 17, ikke Node, ikke Rust.
 */
group = rootProject.group
version = rootProject.version

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.dylibso.chicory:runtime:1.7.5")
    implementation("com.dylibso.chicory:wasi:1.7.5")
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

val kjerne = rootDir.resolve("../kjerne")
val designsystem = rootDir.resolve("../designsystem")
val kommandolinjeWasm = kjerne.resolve("target/wasm32-wasip1/release/fristil.wasm")

val byggKommandolinje = tasks.register<Exec>("byggKommandolinje") {
    workingDir = kjerne
    commandLine("cargo", "build", "--release", "-p", "fristil", "--target", "wasm32-wasip1")
    inputs.dir(kjerne.resolve("src"))
    inputs.dir(kjerne.resolve("cli/src"))
    inputs.file(kjerne.resolve("Cargo.toml"))
    inputs.file(kjerne.resolve("cli/Cargo.toml"))
    inputs.file(kjerne.resolve("cli/build.rs"))
    inputs.file(kjerne.resolve("Cargo.lock"))
    inputs.file(kjerne.resolve("rust-toolchain.toml"))
    // Alt som er bygget inn i modulen: manifestet, fargekontrakten,
    // regelbøkene for agenter, og kildekoden til komponentene og
    // `package.json` for `fristil overta` (se `build.rs`).
    inputs.file(designsystem.resolve("manifest/manifest.json"))
    inputs.file(designsystem.resolve("src/tokens/fargekontrakt.json"))
    inputs.dir(designsystem.resolve("agent"))
    inputs.dir(designsystem.resolve("src/components"))
    inputs.file(designsystem.resolve("package.json"))
    outputs.file(kommandolinjeWasm)
}

val kompilerKommandolinje = tasks.register<no.fristil.build.CompileCore>("kompilerKommandolinje") {
    dependsOn(byggKommandolinje)
    wasm.set(kommandolinjeWasm)
    className.set("no.fristil.cli.FristilCli")
    classes.set(layout.buildDirectory.dir("chicory/classes"))
    sources.set(layout.buildDirectory.dir("chicory/sources"))
}

sourceSets.main {
    java.srcDir(kompilerKommandolinje.map { it.sources })
    resources.srcDir(kompilerKommandolinje.map { it.classes })
}

dependencies {
    compileOnly(files(kompilerKommandolinje.map { it.classes }))
}

/*
 * Én fil med alt i, så `java -jar fristil.jar` er hele installasjonen. Den
 * vanlige jar-en er uten avhengighetene, og er den Gradle-pluginen bruker.
 */
val samletJar = tasks.register<Jar>("samletJar") {
    archiveFileName.set("fristil.jar")
    manifest { attributes("Main-Class" to "no.fristil.cli.MainKt") }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from(sourceSets.main.map { it.output })
    from(configurations.runtimeClasspath.map { classpath -> classpath.map { zipTree(it) } })
    exclude("META-INF/*.SF", "META-INF/*.DSA", "META-INF/*.RSA", "META-INF/versions/**/module-info.class", "module-info.class")
}

tasks.assemble { dependsOn(samletJar) }
