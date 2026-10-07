import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.21"
}

group = "io.github.markusaugust"
version = "0.1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

/*
 * Chicory kjører WebAssembly i ren Java. Ingen JNI, ingen JavaScript, ingen
 * runtime å installere: det er en Maven-avhengighet som virker der JVM-en
 * virker. `compiler` gjør modulen om til JVM-bytekode når den lastes, så den
 * kjører med JIT-en i stedet for i Chicorys tolk, som er flere hundre ganger
 * tregere.
 */
dependencies {
    implementation("com.dylibso.chicory:runtime:1.7.5")
    implementation("com.dylibso.chicory:compiler:1.7.5")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.22.0")
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.13.4")
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

// Java 17 som laveste nivå: det dekker LTS-versjonene de fleste team står på.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

/*
 * Modulen bygges fra kildekoden i `kjerne/` hver gang den er endret, så jar-en
 * aldri kan bære en utdatert kjerne. Ordforrådet i `kjerne/src/ordforrad.rs`
 * er generert og sjekket inn, så dette trenger bare Rust, ikke Bun.
 */
val kjerne = rootDir.resolve("../kjerne")
val wasm = kjerne.resolve("target/wasm32-unknown-unknown/release/fristil_kjerne.wasm")

val byggKjerne by tasks.registering(Exec::class) {
    workingDir = kjerne
    commandLine("cargo", "build", "--release", "--target", "wasm32-unknown-unknown")
    inputs.dir(kjerne.resolve("src"))
    inputs.file(kjerne.resolve("Cargo.toml"))
    outputs.file(wasm)
}

val kjerneRessurs by tasks.registering(Copy::class) {
    dependsOn(byggKjerne)
    from(wasm)
    into(layout.buildDirectory.dir("kjerne/no/fristil"))
    rename { "fristil-kjerne.wasm" }
}

sourceSets.main {
    resources.srcDir(layout.buildDirectory.dir("kjerne"))
}

tasks.processResources {
    dependsOn(kjerneRessurs)
}

tasks.test {
    useJUnitPlatform()
    systemProperty("paritet", kjerne.resolve("paritet").absolutePath)
    testLogging { events("failed") }
}
