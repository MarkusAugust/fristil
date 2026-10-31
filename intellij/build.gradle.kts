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
            <b>0.5.0</b>: The checker from <code>@lo-tek/interfaces</code> 0.38.0.
            One rule for a missing name, <code>without-name</code>, an error, replaces
            <code>icon-without-name</code>, <code>control-without-label</code>,
            <code>tab-list-without-name</code> and <code>field-without-label</code>: a
            <code>lotek-ignore-next</code> naming one of them has to name
            <code>without-name</code>. It computes the name as the browser does, and
            says nothing where a binding or a template could give one. A new warning,
            <code>untranslated-text</code>, for LO-TEK's own English texts on a page in
            another language.
            <br><br>
            <b>0.4.0</b>: The first version under this name. It takes over from the
            earlier plugin, and the history starts here. Completion of LO-TEK's CSS
            classes in HTML files and in HTML injected into strings, and diagnostics
            from LO-TEK's checker, with quick fixes. The checker is written in Rust
            and runs inside the IDE as WebAssembly, without Node.js. It checks
            against the project's own manifest when it finds one, so components
            taken over with <code>lotek takeover</code> are known, and completion
            reads the same manifest. Live templates insert each component's markup
            from the documentation, with the id as a variable that
            <code>for</code> and <code>href</code> follow.
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
    from(rootDir.resolve("../interfaces/live-templates.xml")) {
        into("liveTemplates")
        rename { "Lotek.xml" }
    }
}

tasks.test {
    // The tests build a manifest for a project that has taken over components from the one in the package.
    val manifest = rootDir.resolve("../interfaces/manifest/manifest.json")
    systemProperty("manifest", manifest.absolutePath)
    inputs.file(manifest).withPathSensitivity(PathSensitivity.NONE)
}
