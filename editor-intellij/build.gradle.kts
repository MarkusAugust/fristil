import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    kotlin("jvm") version "2.2.21"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "no.lotek"
version = providers.gradleProperty("pluginVersion").get()

/*
 * The version of LO-TEK for Kotlin, from `gradle.properties` in that package.
 * `includeBuild` substitutes the build next to it whatever version is here,
 * but a version requirement that does not exist misled whoever read the
 * file. Once the package is on Maven Central, this is the version the plugin
 * fetches without `includeBuild`.
 */
val lotekVersion =
    Properties()
        .apply { rootDir.resolve("../kotlin/gradle.properties").reader().use { load(it) } }
        .getProperty("version")
        ?: error("Found no version in ../kotlin/gradle.properties.")

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
     * The diagnostics: the Rust core compiled to JVM bytecode, run by
     * Chicory. It comes from `../kotlin` through `includeBuild`, so the
     * plugin always has the same core as the rest of the repository. The IDE
     * has its own Kotlin standard library, so the package's copy is left out.
     */
    implementation("io.github.markusaugust:lo-tek-interfaces:$lotekVersion") {
        exclude(group = "org.jetbrains.kotlin")
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
}

intellijPlatform {
    pluginConfiguration {
        // `id`, `name` and `vendor` are in `plugin.xml`. The version and the
        // build range are set here, since they come from `gradle.properties`.
        version = providers.gradleProperty("pluginVersion")
        // Shown on the Marketplace and in the IDE on update, and must be in
        // English like the description. Write a new line for each version.
        changeNotes = """
            <b>0.4.0</b>: Live templates for every web component, generated from the
            same recipes as the VS Code snippets, with the id as a variable that
            <code>for</code> and <code>href</code> follow. Ten new diagnostics about
            the wiring a template has to write itself: a label not linked to its
            field, a popover panel without an id, a tab without a panel, a tab row
            without a name, and the attributes removed from
            <code>&lt;lt-field&gt;</code>, among others. A quick fix can now make
            several edits at once, such as the field's id and the label's
            <code>for</code>.<br>
            <b>0.3.0</b>: Diagnostics from LO-TEK's checker, in HTML files and in
            HTML injected into strings, with quick fixes. The checker is written in
            Rust and runs inside the IDE as WebAssembly, without Node.js. It checks
            against the project's own manifest when it finds one, as the language
            server does, so components taken over with <code>lotek overta</code>
            are known. Completion reads the same manifest, so it suggests those
            components too and never a class the checker rejects. Files without a
            LO-TEK class are checked as well, for the rules that apply to plain
            HTML, such as an icon button without a name.<br>
            <b>0.2.0</b>: Completion for <code>lt-table__sort</code>, the sort button
            in a table header. The session timeout is now described as a frame
            component, and the plugin has the new LO-TEK icon.<br>
            <b>0.1.0</b>: First release. Completion for LO-TEK's CSS classes in
            HTML files and in HTML injected into strings.
        """.trimIndent()
        ideaVersion {
            sinceBuild = providers.gradleProperty("sinceBuild")
            untilBuild = provider { null }
        }
    }
    // The token comes from the secret JETBRAINS_MARKETPLACE_TOKEN in
    // `publish-intellij.yml`. The plugin is not signed with its own
    // certificate: without `signPlugin.certificateChain` and `privateKey`
    // Gradle skips signing, and the Marketplace signs it itself.
    publishing {
        token = providers.gradleProperty("intellijPlatformPublishingToken")
    }
}

tasks.processResources {
    // The live templates are generated in the design system from the same
    // recipes as the snippets in VS Code. The file is copied in where
    // `plugin.xml` points.
    from(rootDir.resolve("../designsystem/live-templates.xml")) {
        into("liveTemplates")
        rename { "Lotek.xml" }
    }
}

tasks.test {
    // The tests build a manifest for a project that has taken over components from the one in the package.
    val manifest = rootDir.resolve("../designsystem/manifest/manifest.json")
    systemProperty("manifest", manifest.absolutePath)
    inputs.file(manifest).withPathSensitivity(PathSensitivity.NONE)
}
