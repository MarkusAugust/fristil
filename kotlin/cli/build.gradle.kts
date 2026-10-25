import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
}

/*
 * Kommandolinja på JVM-en: `java -jar lotek.jar sjekk form.html`.
 *
 * Kommandoene er skrevet i Rust (`core/cli/`), og WASI-modulen følger med
 * npm-pakken som `core/lotek.wasm`. Chicory kjører den, kompilert til
 * bytekode her, så jar-en svarer det samme som `npx @lo-tek/interfaces` og
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

val kompilerKommandolinje = tasks.register<no.lotek.build.CompileCore>("kompilerKommandolinje") {
    wasm.set(pakke.map { layout.projectDirectory.file(it.resolve("core/lotek.wasm").absolutePath) })
    className.set("no.lotek.cli.LotekCli")
    classes.set(layout.buildDirectory.dir("chicory/classes"))
    sources.set(layout.buildDirectory.dir("chicory/sources"))
}

/*
 * Pakken kommandolinja leser fra: manifestet, fargekontrakten, regelbøkene
 * og kildekoden til komponentene for `lotek overta`. Modulen bærer ingen
 * av dem, og `CommandLine` gir den mappa som `LOTEK_PACKAGE`.
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
 * Én fil med alt i, så `java -jar lotek.jar` er hele installasjonen. Den
 * vanlige jar-en er uten avhengighetene, og er den Gradle-pluginen bruker.
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
