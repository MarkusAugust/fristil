import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.21"
}

group = "io.github.markusaugust"

/*
 * Samme versjon som npm-pakken, lest fra `package.json`. Kjernen, manifestet,
 * npm og Maven slippes sammen, så `io.github.markusaugust:fristil:0.32.0` og
 * `@fristil/designsystem@0.32.0` er alltid det samme Fristil.
 */
val designsystem = rootDir.resolve("../designsystem")
version = (groovy.json.JsonSlurper().parse(designsystem.resolve("package.json")) as Map<*, *>)["version"] as String

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
val manifestFil = designsystem.resolve("manifest/manifest.json")

/*
 * Modulen bygges fra kildekoden i `kjerne/` hver gang den er endret, så jar-en
 * aldri kan bære en utdatert kjerne. Manifestet er generert og sjekket inn, så
 * dette trenger bare Rust, ikke Bun.
 */
val byggKjerne = tasks.register<Exec>("byggKjerne") {
    workingDir = kjerne
    commandLine("cargo", "build", "--release", "--target", "wasm32-unknown-unknown")
    inputs.dir(kjerne.resolve("src"))
    inputs.file(kjerne.resolve("Cargo.toml"))
    inputs.file(kjerne.resolve("Cargo.lock"))
    inputs.file(kjerne.resolve("rust-toolchain.toml"))
    // Manifestet og fargekontrakten er bygget inn i modulen (`include_str!`).
    inputs.file(manifestFil)
    inputs.file(designsystem.resolve("src/tokens/fargekontrakt.json"))
    outputs.file(kjerneWasm)
}

// Modulen gjøres om til JVM-bytekode her, ikke når den lastes. Se `buildSrc/`.
val kompilerKjerne = tasks.register<no.fristil.build.CompileCore>("kompilerKjerne") {
    dependsOn(byggKjerne)
    wasm.set(kjerneWasm)
    classes.set(layout.buildDirectory.dir("chicory/classes"))
    sources.set(layout.buildDirectory.dir("chicory/sources"))
}

// API-et genereres fra manifestet: verdiene som `enum`-er, og byggefunksjonene som har en tabell.
val genererApi = tasks.register<no.fristil.build.GenerateApi>("genererApi") {
    manifest.set(manifestFil)
    output.set(layout.buildDirectory.dir("generated/fristil"))
}

/*
 * WebJar-en: CSS-en og JavaScript-modulene for nettleseren, med de samme
 * stiene som i npm-pakken, under `META-INF/resources/webjars/fristil/<versjon>/`.
 * Spring Boot, Ktor og Servlet-containere serverer den mappa som den er, så
 * en Kotlin-app trenger verken npm eller et CDN. Det som bare er for Node
 * eller React, holdes utenfor.
 */
val byggNettleserfiler = tasks.register<Exec>("byggNettleserfiler") {
    workingDir = designsystem
    commandLine("bun", "run", "bygg:nettleser")
    inputs.dir(designsystem.resolve("src"))
    inputs.file(designsystem.resolve("tsconfig.json"))
    outputs.file(designsystem.resolve("dist/fristil.css"))
    outputs.file(designsystem.resolve("dist/register.js"))
}

val webjar = tasks.register<Sync>("webjar") {
    dependsOn(byggNettleserfiler)
    into(layout.buildDirectory.dir("webjar"))
    from(designsystem) {
        include("dist/**/*.js", "dist/fristil.css", "src/components/**/*.css", "src/tokens/**/*.css")
        exclude(
            "dist/cli.js", "dist/wasi-host.js", "dist/react.js", "dist/diagnostics/**", "dist/jsx/**",
            // Temaet leser kjernen fra disken, og er for Node, ikke nettleseren.
            "dist/tokens/theme.js", "dist/tokens/theme-check.js",
        )
        into("META-INF/resources/webjars/fristil/$version")
    }
}

sourceSets.main {
    resources.srcDir(webjar)
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
    systemProperty("byggetilfeller", designsystem.resolve("manifest/byggetilfeller.json").absolutePath)
    systemProperty("webjar", layout.buildDirectory.dir("webjar/META-INF/resources/webjars/fristil/$version").get().asFile.absolutePath)
    testLogging { events("failed") }
}
