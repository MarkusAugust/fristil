import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
}

/*
 * Kommandolinja på JVM-en: `java -jar fristil.jar sjekk skjema.html`.
 *
 * Kommandoene er skrevet i Rust (`kjerne/cli/`), og WASI-modulen følger med
 * npm-pakken som `kjerne/fristil.wasm`. Chicory kjører den, kompilert til
 * bytekode her, så jar-en svarer det samme som `npx @fristil/designsystem` og
 * den kjørbare fila fra `cargo install`. Den trenger bare Java 17, ikke Node,
 * ikke Rust.
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

// Kommandolinja og filene den leser, fra npm-pakken rotprosjektet har pakket ut.
val pakke = rootProject.tasks.named<Sync>("pakkUt").map { it.destinationDir }

val kompilerKommandolinje = tasks.register<no.fristil.build.CompileCore>("kompilerKommandolinje") {
    wasm.set(pakke.map { layout.projectDirectory.file(it.resolve("kjerne/fristil.wasm").absolutePath) })
    className.set("no.fristil.cli.FristilCli")
    classes.set(layout.buildDirectory.dir("chicory/classes"))
    sources.set(layout.buildDirectory.dir("chicory/sources"))
}

/*
 * Pakken kommandolinja leser fra: manifestet, fargekontrakten, regelbøkene
 * og kildekoden til komponentene for `fristil overta`. Modulen bærer ingen
 * av dem, og `CommandLine` gir den mappa som `FRISTIL_PACKAGE`.
 */
tasks.processResources {
    from(pakke) {
        include("package.json", "manifest/manifest.json", "manifest/filer.json", "src/tokens/fargekontrakt.json", "agent/*.md", "src/components/**")
        into("fristil-pakke")
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
