import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.2.21"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "no.fristil"
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    intellijPlatform {
        intellijIdea(providers.gradleProperty("platformVersion"))
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")

    /*
     * Diagnostikken: Rust-kjernen kompilert til JVM-bytekode, kjørt av
     * Chicory. Kommer fra `../kotlin` gjennom `includeBuild`, så pluginen
     * alltid har den samme kjernen som resten av repoet. IDE-en har sitt
     * eget Kotlin-standardbibliotek, så pakkens utgave holdes utenfor.
     */
    implementation("io.github.markusaugust:fristil:0.1.0-SNAPSHOT") {
        exclude(group = "org.jetbrains.kotlin")
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
}

/*
 * Dataene står i `Klasser.kt`, ikke her.
 *
 * Fila genereres av `editor/scripts/generate.ts` fra den samme
 * `classesData()` som skriver `classes.ts` og `web-types.json`. Den er Kotlin
 * og ikke JSON, så pluginen trenger verken parser eller avhengighet, og
 * kompilatoren leser dataene. Glemmer noen å regenerere, sier CI-steget
 * «Ingenting er ugenerert» fra, som for de andre genererte filene.
 */

intellijPlatform {
    pluginConfiguration {
        // `id`, `name` og `vendor` står i `plugin.xml`. Versjonen og
        // byggrammen settes her, siden de kommer fra `gradle.properties`.
        version = providers.gradleProperty("pluginVersion")
        // Vises på Marketplace og i IDE-en ved oppdatering, og må være på
        // engelsk som beskrivelsen. Skriv en ny linje for hver versjon.
        changeNotes = """
            <b>0.3.0</b>: Diagnostics from Fristil's checker, in HTML files and in
            HTML injected into strings, with quick fixes. The checker is written in
            Rust and runs inside the IDE as WebAssembly, without Node.js.<br>
            <b>0.2.0</b>: Completion for <code>fs-table__sort</code>, the sort button
            in a table header. The session timeout is now described as a frame
            component, and the plugin has the new Fristil icon.<br>
            <b>0.1.0</b>: First release. Completion for Fristil's CSS classes in
            HTML files and in HTML injected into strings.
        """.trimIndent()
        ideaVersion {
            sinceBuild = providers.gradleProperty("sinceBuild")
            untilBuild = provider { null }
        }
    }
    // Tokenet kommer fra hemmeligheten JETBRAINS_MARKETPLACE_TOKEN i
    // `publiser-intellij.yml`. Pluginen signeres ikke med eget sertifikat:
    // uten `signPlugin.certificateChain` og `privateKey` hopper Gradle over
    // signeringen, og Marketplace signerer den selv.
    publishing {
        token = providers.gradleProperty("intellijPlatformPublishingToken")
    }
}
