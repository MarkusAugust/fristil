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
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_21) }
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
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
        id = "no.fristil.intellij"
        name = "Fristil"
        version = providers.gradleProperty("pluginVersion")
        vendor {
            name = "MarkusAugust"
            url = "https://github.com/MarkusAugust/fristil"
        }
        ideaVersion {
            sinceBuild = providers.gradleProperty("sinceBuild")
            untilBuild = provider { null }
        }
    }
}
