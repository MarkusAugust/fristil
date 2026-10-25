import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
    `java-gradle-plugin`
}

/*
 * Gradle-pluginen: `lotekSjekk` sjekker malene som en del av `check`,
 * `lotekTema` bygger temaet av en oppskrift, og `lotekManifest` skriver
 * manifestet prosjektet sjekkes mot til `build/lotek/manifest.json` når
 * prosjektet har fragmenter.
 *
 * Den kjører kommandolinja i Gradle-prosessen, den samme WASI-modulen som
 * `java -jar lotek.jar`, så svarene er de samme som i terminalen.
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
            description = "Sjekker malene mot LO-TEK og bygger temaet, med den samme kjernen som editoren."
        }
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("failed") }
}
