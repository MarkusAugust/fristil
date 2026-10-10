import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm")
    `java-gradle-plugin`
}

/*
 * Gradle-pluginen: `fristilSjekk` sjekker malene som en del av `check`,
 * `fristilTema` bygger temaet av en oppskrift, og `fristilManifest` skriver
 * manifestet prosjektet sjekkes mot til `build/fristil/manifest.json` når
 * prosjektet har fragmenter.
 *
 * Den kjører kommandolinja i Gradle-prosessen, den samme WASI-modulen som
 * `java -jar fristil.jar`, så svarene er de samme som i terminalen.
 */
group = rootProject.group
version = rootProject.version
base.archivesName = "fristil-gradle-plugin"

repositories {
    mavenCentral()
}

dependencies {
    implementation(project(":kommandolinje"))
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
        create("fristil") {
            id = "io.github.markusaugust.fristil"
            implementationClass = "no.fristil.gradle.FristilPlugin"
            displayName = "Fristil"
            description = "Sjekker malene mot Fristil og bygger temaet, med den samme kjernen som editoren."
        }
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging { events("failed") }
}
