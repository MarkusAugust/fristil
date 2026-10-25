import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    kotlin("jvm") version "2.2.21"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "no.fristil"
version = providers.gradleProperty("pluginVersion").get()

/*
 * Versjonen av Fristil for Kotlin, fra `gradle.properties` i den pakken.
 * `includeBuild` bytter inn bygget ved siden av uansett hvilken versjon som
 * står her, men et versjonskrav som ikke finnes, villedet den som leste fila.
 * Når pakken ligger på Maven Central, er det denne versjonen pluginen henter
 * uten `includeBuild`.
 */
val fristilVersion =
    Properties()
        .apply { rootDir.resolve("../kotlin/gradle.properties").reader().use { load(it) } }
        .getProperty("version")
        ?: error("Fant ingen version i ../kotlin/gradle.properties.")

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
    implementation("io.github.markusaugust:fristil:$fristilVersion") {
        exclude(group = "org.jetbrains.kotlin")
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
}

intellijPlatform {
    pluginConfiguration {
        // `id`, `name` og `vendor` står i `plugin.xml`. Versjonen og
        // byggrammen settes her, siden de kommer fra `gradle.properties`.
        version = providers.gradleProperty("pluginVersion")
        // Vises på Marketplace og i IDE-en ved oppdatering, og må være på
        // engelsk som beskrivelsen. Skriv en ny linje for hver versjon.
        changeNotes = """
            <b>0.4.0</b>: Live templates for every web component, generated from the
            same recipes as the VS Code snippets, with the id as a variable that
            <code>for</code> and <code>href</code> follow. Ten new diagnostics about
            the wiring a template has to write itself: a label not linked to its
            field, a popover panel without an id, a tab without a panel, a tab row
            without a name, and the attributes removed from
            <code>&lt;fs-field&gt;</code>, among others. A quick fix can now make
            several edits at once, such as the field's id and the label's
            <code>for</code>.<br>
            <b>0.3.0</b>: Diagnostics from Fristil's checker, in HTML files and in
            HTML injected into strings, with quick fixes. The checker is written in
            Rust and runs inside the IDE as WebAssembly, without Node.js. It checks
            against the project's own manifest when it finds one, as the language
            server does, so components taken over with <code>fristil overta</code>
            are known. Completion reads the same manifest, so it suggests those
            components too and never a class the checker rejects. Files without a
            Fristil class are checked as well, for the rules that apply to plain
            HTML, such as an icon button without a name.<br>
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

tasks.processResources {
    // Live templates genereres i designsystemet fra de samme oppskriftene
    // som snippetene i VS Code. Fila kopieres inn der `plugin.xml` peker.
    from(rootDir.resolve("../designsystem/live-templates.xml")) {
        into("liveTemplates")
        rename { "Fristil.xml" }
    }
}

tasks.test {
    // Testene bygger et manifest for et overtatt prosjekt av det i pakken.
    val manifest = rootDir.resolve("../designsystem/manifest/manifest.json")
    systemProperty("manifest", manifest.absolutePath)
    inputs.file(manifest).withPathSensitivity(PathSensitivity.NONE)
}
