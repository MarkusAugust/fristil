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
 * virker. Det er den eneste avhengigheten pakken har.
 */
dependencies {
    implementation("com.dylibso.chicory:runtime:1.7.5")
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

val kjerne = rootDir.resolve("../kjerne")
val kjerneWasm = kjerne.resolve("target/wasm32-unknown-unknown/release/fristil_kjerne.wasm")
val manifestFil = rootDir.resolve("../designsystem/manifest/manifest.json")

/*
 * Modulen bygges fra kildekoden i `kjerne/` hver gang den er endret, så jar-en
 * aldri kan bære en utdatert kjerne. Manifestet er generert og sjekket inn, så
 * dette trenger bare Rust, ikke Bun.
 */
val byggKjerne by tasks.registering(Exec::class) {
    workingDir = kjerne
    commandLine("cargo", "build", "--release", "--target", "wasm32-unknown-unknown")
    inputs.dir(kjerne.resolve("src"))
    inputs.file(kjerne.resolve("Cargo.toml"))
    // Manifestet er bygget inn i modulen.
    inputs.file(manifestFil)
    outputs.file(kjerneWasm)
}

// Modulen gjøres om til JVM-bytekode her, ikke når den lastes. Se `buildSrc/`.
val kompilerKjerne by tasks.registering(no.fristil.build.CompileCore::class) {
    dependsOn(byggKjerne)
    wasm.set(kjerneWasm)
    classes.set(layout.buildDirectory.dir("chicory/classes"))
    sources.set(layout.buildDirectory.dir("chicory/sources"))
}

// API-et genereres fra manifestet: verdiene som `enum`-er, og byggefunksjonene som har en tabell.
val genererApi by tasks.registering(no.fristil.build.GenerateApi::class) {
    manifest.set(manifestFil)
    output.set(layout.buildDirectory.dir("generated/fristil"))
}

sourceSets.main {
    kotlin.srcDir(genererApi)
    java.srcDir(kompilerKjerne.map { it.sources })
    // Klassene for modulen er ferdig kompilert, så de legges i jar-en som de er.
    resources.srcDir(kompilerKjerne.map { it.classes })
}

dependencies {
    compileOnly(files(kompilerKjerne.map { it.classes }))
}

tasks.test {
    useJUnitPlatform()
    systemProperty("paritet", kjerne.resolve("paritet").absolutePath)
    systemProperty("byggetilfeller", rootDir.resolve("../designsystem/manifest/byggetilfeller.json").absolutePath)
    testLogging { events("failed") }
}
