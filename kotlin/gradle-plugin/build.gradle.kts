import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
    `java-gradle-plugin`
}

/*
 * The Gradle plugin: `lotekCheck` checks the templates as part of `check`,
 * `lotekTheme` builds the theme from a recipe, and `lotekManifest` writes
 * the manifest the project is checked against to `build/lotek/manifest.json`
 * when the project has fragments.
 *
 * It runs the CLI in the Gradle process, the same WASI module as
 * `java -jar lotek.jar`, so the answers are the same as in the terminal.
 */
group = rootProject.group
version = rootProject.version
base.archivesName = "lo-tek-gradle-plugin"

repositories {
    mavenCentral()
}

dependencies {
    implementation(project(":cli"))
    testImplementation(kotlin("test"))
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

gradlePlugin {
    plugins {
        create("lotek") {
            id = "io.github.markusaugust.lo-tek"
            implementationClass = "no.lotek.gradle.LotekPlugin"
            displayName = "LO-TEK"
            description = "Checks templates against LO-TEK and builds the theme, with the same core as the editor."
        }
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("failed") }
}
