import com.vanniktech.maven.publish.MavenPublishBaseExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.21"
    id("com.vanniktech.maven.publish") version "0.37.0"
}

group = "io.github.markusaugust"

// Versjonen står i `gradle.properties`, og er den samme som npm-pakkens.

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

/*
 * Alt pakken bygges av, kommer fra npm-pakken for samme versjon: kjernen,
 * manifestet og filene for nettleseren. Bygget trenger derfor verken Rust
 * eller Bun, og `io.github.markusaugust:fristil` er bygd av nøyaktig de
 * filene `@fristil/designsystem` med samme versjon består av.
 *
 * Uten `-Pfristil.pakke` hentes versjonen fra npm. Mellom to utgivelser er
 * koden her nyere enn det som ligger der, og da pakkes tarballen fra repoet
 * og oppgis med `-Pfristil.pakke=<sti til .tgz>`, slik CI gjør.
 */
val hentPakke = tasks.register<no.fristil.build.FetchPackage>("hentPakke") {
    packageVersion.set(version.toString())
    tarball.set(layout.buildDirectory.file("npm/designsystem-$version.tgz"))
}

/*
 * `fristil.pakke` er tarballen, eller mappa `npm pack` skrev den til. I en
 * mappe brukes fila med versjonen i navnet, så en gammel tarball ved siden
 * av blir ikke tatt med en feiltakelse. Valgt her og ikke med `orElse`, som
 * mister avhengigheten til `hentPakke`.
 */
val lokalPakke = providers.gradleProperty("fristil.pakke").orNull?.let { rootDir.resolve(it) }
val pakkeTgz: Provider<RegularFile> =
    if (lokalPakke != null) {
        val tgz = if (lokalPakke.isDirectory) lokalPakke.resolve("fristil-designsystem-$version.tgz") else lokalPakke
        check(tgz.isFile) { "Fant ikke npm-pakken $tgz. Pakk den med bun --filter @fristil/designsystem pakk." }
        provider { layout.projectDirectory.file(tgz.absolutePath) }
    } else {
        hentPakke.flatMap { it.tarball }
    }

val pakkUt = tasks.register<Sync>("pakkUt") {
    // npm legger alt under `package/` i tarballen.
    from(tarTree(pakkeTgz)) {
        eachFile { relativePath = RelativePath(true, *relativePath.segments.drop(1).toTypedArray()) }
    }
    includeEmptyDirs = false
    into(layout.buildDirectory.dir("fristil-pakke"))
    val forventet = version.toString()
    doLast {
        val pakke = groovy.json.JsonSlurper().parse(destinationDir.resolve("package.json")) as Map<*, *>
        check(pakke["name"] == "@fristil/designsystem" && pakke["version"] == forventet) {
            "Tarballen er ${pakke["name"]}@${pakke["version"]}, men Kotlin-pakken er $forventet. " +
                "Versjonen i kotlin/gradle.properties og designsystem/package.json skal være den samme."
        }
    }
}

val pakke = pakkUt.map { it.destinationDir }
val manifestFil = pakke.map { layout.projectDirectory.file(it.resolve("manifest/manifest.json").absolutePath) }

// Modulen gjøres om til JVM-bytekode her, ikke når den lastes. Se `buildSrc/`.
val kompilerKjerne = tasks.register<no.fristil.build.CompileCore>("kompilerKjerne") {
    wasm.set(pakke.map { layout.projectDirectory.file(it.resolve("kjerne/fristil-kjerne.wasm").absolutePath) })
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
val webjar = tasks.register<Sync>("webjar") {
    into(layout.buildDirectory.dir("webjar"))
    from(pakke) {
        include("dist/**/*.js", "dist/fristil.css", "src/components/**/*.css", "src/tokens/**/*.css")
        exclude(
            "dist/cli.js", "dist/wasi-host.js", "dist/react.js", "dist/diagnostics/**", "dist/jsx/**",
            // Temaet leser kjernen fra disken, og er for Node, ikke nettleseren.
            "dist/tokens/theme.js", "dist/tokens/theme-check.js",
        )
        into("META-INF/resources/webjars/fristil/$version")
    }
}

// Manifestet i pakken, som `Fristil` gir kjernen når en konsument ikke oppgir sitt eget.
tasks.processResources { from(manifestFil) { into("no/fristil") } }

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
    /*
     * Fasiten for paritet og kontrakt er testdata i repoet, ikke en del av
     * npm-pakken, og leses derfor herfra. CI pakker tarballen fra den samme
     * commiten, så de to er alltid like gamle.
     */
    val kjerne = rootDir.resolve("../kjerne")
    val designsystem = rootDir.resolve("../designsystem")
    systemProperty("paritet", kjerne.resolve("paritet").absolutePath)
    // Fiksturene og byggetilfellene leses gjennom en sti, så Gradle ser dem
    // ikke uten dette, og en ny fikstur ville latt testen stå som oppdatert.
    inputs.dir(kjerne.resolve("paritet")).withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(designsystem.resolve("manifest/byggetilfeller.json")).withPathSensitivity(PathSensitivity.NONE)
    inputs.file(manifestFil).withPathSensitivity(PathSensitivity.NONE)
    val manifestSti = manifestFil.map { it.asFile.absolutePath }
    jvmArgumentProviders.add(CommandLineArgumentProvider { listOf("-Dmanifest=${manifestSti.get()}") })
    systemProperty("byggetilfeller", designsystem.resolve("manifest/byggetilfeller.json").absolutePath)
    systemProperty("webjar", layout.buildDirectory.dir("webjar/META-INF/resources/webjars/fristil/$version").get().asFile.absolutePath)
    testLogging { events("failed") }
}

/*
 * Utgivelsen til Maven Central, for alle fire modulene med samme versjon.
 * `publish.yml` kjører den etter at npm-pakken er ute, og bygger da av den
 * publiserte tarballen. Brukernavnet og passordet til Central Portal og
 * signeringsnøkkelen kommer som `ORG_GRADLE_PROJECT_…` fra hemmelighetene.
 *
 * Uten nøkkel signeres ingenting, så `publishToMavenLocal` virker på en
 * maskin uten den. Central avviser en usignert utgivelse uansett.
 */
val signeringsnokkel = providers.gradleProperty("signingInMemoryKey").isPresent
allprojects {
    pluginManager.apply("com.vanniktech.maven.publish")
    extensions.configure<MavenPublishBaseExtension> {
        publishToMavenCentral()
        if (signeringsnokkel) signAllPublications()
        val artefakt = if (project == rootProject) "fristil" else "fristil-${project.name}"
        coordinates(rootProject.group.toString(), artefakt, rootProject.version.toString())
        pom {
            name.set(artefakt)
            description.set(
                when (project.name) {
                    "kotlinx-html" -> "Fristil for kotlinx.html: Tag.fs(…) legger attributtene fra byggefunksjonene på en tagg."
                    "kommandolinje" -> "Kommandolinja til Fristil på JVM-en, som Gradle-pluginen kjører."
                    "gradle-plugin" -> "Gradle-pluginen som sjekker malene mot Fristil og bygger temaet."
                    else -> "Fristil for Kotlin og Java: byggefunksjonene, diagnostikken og CSS-en og web-komponentene som WebJar."
                },
            )
            url.set("https://fristil.sobernetics.no/kotlin/")
            inceptionYear.set("2026")
            licenses {
                license {
                    name.set("MIT")
                    url.set("https://opensource.org/license/mit")
                    distribution.set("repo")
                }
            }
            developers {
                developer {
                    id.set("MarkusAugust")
                    name.set("August Søberg-Klyver")
                    url.set("https://github.com/MarkusAugust")
                }
            }
            scm {
                url.set("https://github.com/MarkusAugust/fristil")
                connection.set("scm:git:https://github.com/MarkusAugust/fristil.git")
                developerConnection.set("scm:git:ssh://git@github.com/MarkusAugust/fristil.git")
            }
        }
    }
}
